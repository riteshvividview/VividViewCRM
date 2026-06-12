import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';

@Injectable()
export class SprintService {
  constructor(private readonly prisma: PrismaService) {}

  async create(boardId: string, dto: CreateSprintDto, user: AuthenticatedUser) {
    const board = await this.prisma.task_boards.findFirst({
      where: { id: boardId, workspace_id: user.workspaceId },
      select: { id: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    return this.prisma.task_sprints.create({
      data: {
        board_id: boardId,
        workspace_id: user.workspaceId,
        name: dto.name,
        goal: dto.goal,
        status: 'draft',
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        capacity_points: dto.capacity_points,
        created_by: user.id,
      },
    });
  }

  async findAll(boardId: string, workspaceId: string) {
    return this.prisma.task_sprints.findMany({
      where: { board_id: boardId, workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { tasks: true } } },
    });
  }

  async findActive(boardId: string, workspaceId: string) {
    return this.prisma.task_sprints.findFirst({
      where: { board_id: boardId, workspace_id: workspaceId, status: 'active' },
    });
  }

  async update(id: string, dto: UpdateSprintDto, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.task_sprints.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.goal !== undefined && { goal: dto.goal }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date !== undefined && { end_date: new Date(dto.end_date) }),
        ...(dto.capacity_points !== undefined && { capacity_points: dto.capacity_points }),
        ...(dto.retrospective !== undefined && { retrospective: dto.retrospective }),
        updated_at: new Date(),
      },
    });
  }

  async start(id: string, user: AuthenticatedUser) {
    const sprint = await this.assertExists(id, user.workspaceId);

    const activeSprint = await this.prisma.task_sprints.findFirst({
      where: { board_id: sprint.board_id, workspace_id: user.workspaceId, status: 'active' },
      select: { id: true, name: true },
    });
    if (activeSprint) {
      throw new ConflictException(`Sprint "${activeSprint.name}" is already active on this board`);
    }

    return this.prisma.task_sprints.update({
      where: { id },
      data: {
        status: 'active',
        start_date: sprint.start_date ?? new Date(),
        updated_at: new Date(),
      },
    });
  }

  async complete(id: string, dto: CompleteSprintDto, user: AuthenticatedUser) {
    const sprint = await this.assertExists(id, user.workspaceId);
    if (sprint.status !== 'active') {
      throw new ConflictException('Only an active sprint can be completed');
    }

    const incompleteTasks = await this.prisma.tasks.findMany({
      where: {
        sprint_id: id,
        workspace_id: user.workspaceId,
        status: { notIn: ['done', 'cancelled'] },
      },
      select: { id: true, title: true },
    });

    const completedPoints = await this.prisma.tasks.aggregate({
      where: { sprint_id: id, workspace_id: user.workspaceId, status: 'done' },
      _sum: { story_points: true },
    });

    if (incompleteTasks.length > 0 && dto.move_incomplete_to === 'backlog') {
      await this.prisma.tasks.updateMany({
        where: { id: { in: incompleteTasks.map((t) => t.id) } },
        data: { sprint_id: null, column_id: null },
      });
    }

    const completedSprint = await this.prisma.task_sprints.update({
      where: { id },
      data: {
        status: 'completed',
        velocity: completedPoints._sum.story_points ?? 0,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { sprint: completedSprint, incomplete_tasks: incompleteTasks };
  }

  async getVelocity(id: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    const [total, completed] = await Promise.all([
      this.prisma.tasks.aggregate({
        where: { sprint_id: id, workspace_id: workspaceId },
        _sum: { story_points: true },
        _count: true,
      }),
      this.prisma.tasks.aggregate({
        where: { sprint_id: id, workspace_id: workspaceId, status: 'done' },
        _sum: { story_points: true },
        _count: true,
      }),
    ]);
    return {
      total_points: total._sum.story_points ?? 0,
      completed_points: completed._sum.story_points ?? 0,
      total_tasks: total._count,
      completed_tasks: completed._count,
    };
  }

  private async assertExists(id: string, workspaceId: string) {
    const sprint = await this.prisma.task_sprints.findFirst({
      where: { id, workspace_id: workspaceId },
    });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }
}
