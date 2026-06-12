import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    return this.prisma.task_projects.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'active',
        visibility: dto.visibility ?? 'workspace',
        team_id: dto.team_id,
        color: dto.color ?? '#6366f1',
        icon: dto.icon,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        owner_id: user.id,
        created_by: user.id,
      },
    });
  }

  async findAll(
    workspaceId: string,
    filters: { status?: string; team_id?: string; search?: string; include_archived?: boolean },
    page = 1,
    limit = 20,
  ) {
    const where: Record<string, unknown> = {
      workspace_id: workspaceId,
      ...(!filters.include_archived && { archived_at: null }),
      ...(filters.status && { status: filters.status }),
      ...(filters.team_id && { team_id: filters.team_id }),
      ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' } }),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.task_projects.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { created_at: 'desc' }],
        include: {
          teams: { select: { id: true, name: true, color: true } },
          _count: { select: { task_boards: true, tasks: true } },
        },
      }),
      this.prisma.task_projects.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const project = await this.prisma.task_projects.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        teams: { select: { id: true, name: true, color: true } },
        task_boards: {
          where: { archived_at: null },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, type: true, is_private: true },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.task_projects.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.team_id !== undefined && { team_id: dto.team_id }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date !== undefined && { end_date: new Date(dto.end_date) }),
        updated_at: new Date(),
      },
    });
  }

  async archive(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.task_projects.update({
      where: { id },
      data: { archived_at: new Date(), updated_at: new Date() },
    });
  }

  async getStats(id: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    const [total, todo, in_progress, done] = await Promise.all([
      this.prisma.tasks.count({ where: { project_id: id, workspace_id: workspaceId } }),
      this.prisma.tasks.count({ where: { project_id: id, workspace_id: workspaceId, status: 'todo' } }),
      this.prisma.tasks.count({ where: { project_id: id, workspace_id: workspaceId, status: 'in_progress' } }),
      this.prisma.tasks.count({ where: { project_id: id, workspace_id: workspaceId, status: 'done' } }),
    ]);
    return { total, todo, in_progress, done, other: total - todo - in_progress - done };
  }

  private async assertExists(id: string, workspaceId: string) {
    const exists = await this.prisma.task_projects.findFirst({
      where: { id, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Project not found');
  }
}
