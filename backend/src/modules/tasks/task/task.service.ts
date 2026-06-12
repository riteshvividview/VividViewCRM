import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { ActivityService } from '../activity/activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(dto: CreateTaskDto, user: AuthenticatedUser) {
    const task = await this.prisma.tasks.create({
      data: {
        workspace_id: user.workspaceId,
        title: dto.title,
        description: dto.description ?? '',
        status: dto.status ?? 'todo',
        priority: dto.priority ?? 'medium',
        project_id: dto.project_id,
        board_id: dto.board_id,
        sprint_id: dto.sprint_id,
        column_id: dto.column_id,
        parent_task_id: dto.parent_task_id,
        assignee_id: dto.assignee_id,
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        story_points: dto.story_points,
        estimated_hours: dto.estimated_hours,
        tags: dto.tags ?? [],
        linked_entity_type: dto.linked_entity_type,
        linked_entity_id: dto.linked_entity_id,
        created_by: user.id,
      },
    });

    if (dto.assignee_ids?.length) {
      await this.prisma.task_assignees.createMany({
        data: dto.assignee_ids.map((userId) => ({
          task_id: task.id,
          user_id: userId,
          assigned_by: user.id,
        })),
        skipDuplicates: true,
      });
    } else if (dto.assignee_id) {
      await this.prisma.task_assignees.createMany({
        data: [{ task_id: task.id, user_id: dto.assignee_id, assigned_by: user.id }],
        skipDuplicates: true,
      });
    }

    if (dto.label_ids?.length) {
      await this.prisma.task_label_assignments.createMany({
        data: dto.label_ids.map((labelId) => ({
          task_id: task.id,
          label_id: labelId,
          assigned_by: user.id,
        })),
        skipDuplicates: true,
      });
    }

    void this.activity.log({
      taskId: task.id,
      workspaceId: user.workspaceId,
      actorId: user.id,
      action: 'created',
    });

    return this.findById(task.id, user.workspaceId);
  }

  async findAll(workspaceId: string, filters: FilterTasksDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspace_id: workspaceId };

    if (filters.project_id) where['project_id'] = filters.project_id;
    if (filters.board_id) where['board_id'] = filters.board_id;
    if (filters.sprint_id) where['sprint_id'] = filters.sprint_id;
    if (filters.column_id) where['column_id'] = filters.column_id;
    if (filters.assignee_id) where['assignee_id'] = filters.assignee_id;
    if (filters.parent_task_id !== undefined) where['parent_task_id'] = filters.parent_task_id;
    if (filters.has_no_assignee) where['assignee_id'] = null;

    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim());
      where['status'] = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (filters.priority) {
      const priorities = filters.priority.split(',').map((p) => p.trim());
      where['priority'] = priorities.length === 1 ? priorities[0] : { in: priorities };
    }
    if (filters.due_before || filters.due_after) {
      where['due_date'] = {
        ...(filters.due_before && { lte: new Date(filters.due_before) }),
        ...(filters.due_after && { gte: new Date(filters.due_after) }),
      };
    }
    if (filters.is_overdue) {
      where['due_date'] = { lt: new Date() };
      where['status'] = { notIn: ['done', 'cancelled'] };
    }
    if (filters.search) {
      where['OR'] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = filters.sortBy ?? 'created_at';
    const sortOrder = filters.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.tasks.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy === 'position'
          ? [{ column_id: 'asc' }, { position: 'asc' }]
          : { [sortBy]: sortOrder },
        include: {
          task_assignees: {
            include: {
              users_task_assignees_user_idTousers: {
                select: { id: true, raw_user_meta_data: true },
              },
            },
          },
          task_label_assignments: {
            include: { task_labels: { select: { id: true, name: true, color: true } } },
          },
          _count: { select: { task_comments: true, other_tasks: true } },
        },
      }),
      this.prisma.tasks.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        task_assignees: {
          include: {
            users_task_assignees_user_idTousers: {
              select: { id: true, raw_user_meta_data: true },
            },
          },
        },
        task_watchers: {
          include: {
            users: { select: { id: true, raw_user_meta_data: true } },
          },
        },
        task_label_assignments: {
          include: { task_labels: { select: { id: true, name: true, color: true } } },
        },
        task_projects: { select: { id: true, name: true, color: true } },
        task_boards: { select: { id: true, name: true, type: true } },
        task_sprints: { select: { id: true, name: true, status: true } },
        task_board_columns: { select: { id: true, name: true } },
        _count: {
          select: { task_comments: true, other_tasks: true, task_time_entries: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const timeSum = await this.prisma.task_time_entries.aggregate({
      where: { task_id: id, workspace_id: workspaceId, ended_at: { not: null } },
      _sum: { duration_minutes: true },
    });

    return { ...task, time_tracked_minutes: timeSum._sum.duration_minutes ?? 0 };
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    const existing = await this.prisma.tasks.findFirst({
      where: { id, workspace_id: user.workspaceId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Task not found');

    const data: Record<string, unknown> = { updated_at: new Date() };
    const activityChanges: Array<{ field: string; old: unknown; new: unknown }> = [];

    const fields = [
      'title', 'description', 'priority', 'due_date', 'start_date',
      'story_points', 'estimated_hours', 'assignee_id', 'sprint_id',
      'column_id', 'project_id', 'board_id', 'position', 'tags',
      'linked_entity_type', 'linked_entity_id',
    ] as const;

    for (const field of fields) {
      if (dto[field as keyof typeof dto] !== undefined) {
        data[field] = dto[field as keyof typeof dto];
      }
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      data['status'] = dto.status;
      if (dto.status === 'done') data['completed_at'] = new Date();
      activityChanges.push({ field: 'status', old: existing.status, new: dto.status });
    }

    if (dto.due_date) data['due_date'] = new Date(dto.due_date);
    if (dto.start_date) data['start_date'] = new Date(dto.start_date);

    const updated = await this.prisma.tasks.update({ where: { id }, data });

    for (const change of activityChanges) {
      void this.activity.log({
        taskId: id,
        workspaceId: user.workspaceId,
        actorId: user.id,
        action: `${change.field}_changed`,
        fieldName: change.field,
        oldValue: change.old,
        newValue: change.new,
      });
    }

    return updated;
  }

  async move(id: string, dto: MoveTaskDto, user: AuthenticatedUser) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, workspace_id: user.workspaceId },
      select: { id: true, column_id: true, sprint_id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.tasks.update({
      where: { id },
      data: {
        column_id: dto.column_id,
        position: dto.position,
        ...(dto.sprint_id !== undefined && { sprint_id: dto.sprint_id }),
        updated_at: new Date(),
      },
    });

    void this.activity.log({
      taskId: id,
      workspaceId: user.workspaceId,
      actorId: user.id,
      action: 'moved',
      metadata: { from_column: task.column_id, to_column: dto.column_id },
    });

    return updated;
  }

  async delete(id: string, user: AuthenticatedUser) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, workspace_id: user.workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.tasks.delete({ where: { id } });
  }

  async assign(id: string, userIds: string[], assigner: AuthenticatedUser) {
    await this.assertExists(id, assigner.workspaceId);
    await this.prisma.task_assignees.createMany({
      data: userIds.map((userId) => ({
        task_id: id, user_id: userId, assigned_by: assigner.id,
      })),
      skipDuplicates: true,
    });
    void this.activity.log({
      taskId: id, workspaceId: assigner.workspaceId, actorId: assigner.id,
      action: 'assigned', metadata: { user_ids: userIds },
    });
  }

  async unassign(id: string, userId: string, assigner: AuthenticatedUser) {
    await this.assertExists(id, assigner.workspaceId);
    await this.prisma.task_assignees.delete({ where: { task_id_user_id: { task_id: id, user_id: userId } } });
  }

  async watch(id: string, userId: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    await this.prisma.task_watchers.createMany({
      data: [{ task_id: id, user_id: userId }],
      skipDuplicates: true,
    });
  }

  async unwatch(id: string, userId: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    await this.prisma.task_watchers.delete({ where: { task_id_user_id: { task_id: id, user_id: userId } } });
  }

  async applyLabel(id: string, labelId: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.task_label_assignments.createMany({
      data: [{ task_id: id, label_id: labelId, assigned_by: user.id }],
      skipDuplicates: true,
    });
  }

  async removeLabel(id: string, labelId: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.task_label_assignments.delete({
      where: { task_id_label_id: { task_id: id, label_id: labelId } },
    });
  }

  private async assertExists(id: string, workspaceId: string) {
    const task = await this.prisma.tasks.findFirst({
      where: { id, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }
}
