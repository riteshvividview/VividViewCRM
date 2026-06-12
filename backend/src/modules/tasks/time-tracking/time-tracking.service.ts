import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

@Injectable()
export class TimeTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async startTimer(taskId: string, dto: StartTimerDto, user: AuthenticatedUser) {
    const task = await this.prisma.tasks.findFirst({
      where: { id: taskId, workspace_id: user.workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const running = await this.prisma.task_time_entries.findFirst({
      where: { user_id: user.id, ended_at: null },
      select: { id: true, task_id: true },
    });
    if (running) {
      throw new ConflictException('You already have a running timer. Stop it before starting a new one.');
    }

    return this.prisma.task_time_entries.create({
      data: {
        task_id: taskId,
        workspace_id: user.workspaceId,
        user_id: user.id,
        started_at: new Date(),
        description: dto.description,
        is_billable: dto.is_billable ?? false,
        is_manual: false,
      },
    });
  }

  async stopTimer(userId: string, workspaceId: string) {
    const entry = await this.prisma.task_time_entries.findFirst({
      where: { user_id: userId, workspace_id: workspaceId, ended_at: null },
    });
    if (!entry) throw new NotFoundException('No running timer found');

    const endedAt = new Date();
    const durationMinutes = Math.round(
      (endedAt.getTime() - new Date(entry.started_at).getTime()) / 60000,
    );

    return this.prisma.task_time_entries.update({
      where: { id: entry.id },
      data: { ended_at: endedAt, duration_minutes: durationMinutes, updated_at: new Date() },
    });
  }

  async getRunningTimer(userId: string, workspaceId: string) {
    return this.prisma.task_time_entries.findFirst({
      where: { user_id: userId, workspace_id: workspaceId, ended_at: null },
      include: { tasks: { select: { id: true, title: true } } },
    });
  }

  async createManual(taskId: string, dto: CreateTimeEntryDto, user: AuthenticatedUser) {
    const task = await this.prisma.tasks.findFirst({
      where: { id: taskId, workspace_id: user.workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const startedAt = new Date(dto.started_at);
    const endedAt = new Date(dto.ended_at);
    if (endedAt <= startedAt) {
      throw new ConflictException('ended_at must be after started_at');
    }

    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    return this.prisma.task_time_entries.create({
      data: {
        task_id: taskId,
        workspace_id: user.workspaceId,
        user_id: user.id,
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        description: dto.description,
        is_billable: dto.is_billable ?? false,
        is_manual: true,
      },
    });
  }

  async update(entryId: string, dto: UpdateTimeEntryDto, user: AuthenticatedUser) {
    const entry = await this.prisma.task_time_entries.findFirst({
      where: { id: entryId, workspace_id: user.workspaceId },
      select: { id: true, user_id: true, started_at: true, ended_at: true },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.user_id !== user.id) throw new ForbiddenException('You can only edit your own time entries');

    const startedAt = dto.started_at ? new Date(dto.started_at) : new Date(entry.started_at);
    const endedAt = dto.ended_at
      ? new Date(dto.ended_at)
      : entry.ended_at
        ? new Date(entry.ended_at)
        : null;

    const durationMinutes = endedAt
      ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
      : null;

    return this.prisma.task_time_entries.update({
      where: { id: entryId },
      data: {
        ...(dto.started_at && { started_at: startedAt }),
        ...(dto.ended_at && { ended_at: endedAt }),
        ...(durationMinutes !== null && { duration_minutes: durationMinutes }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_billable !== undefined && { is_billable: dto.is_billable }),
        updated_at: new Date(),
      },
    });
  }

  async delete(entryId: string, user: AuthenticatedUser) {
    const entry = await this.prisma.task_time_entries.findFirst({
      where: { id: entryId, workspace_id: user.workspaceId },
      select: { id: true, user_id: true },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.user_id !== user.id) throw new ForbiddenException('You can only delete your own time entries');
    await this.prisma.task_time_entries.delete({ where: { id: entryId } });
  }

  async getTaskEntries(taskId: string, workspaceId: string) {
    return this.prisma.task_time_entries.findMany({
      where: { task_id: taskId, workspace_id: workspaceId },
      orderBy: { started_at: 'desc' },
      include: {
        users: { select: { id: true, raw_user_meta_data: true } },
      },
    });
  }

  async getReport(
    workspaceId: string,
    filters: { user_id?: string; project_id?: string; from_date?: string; to_date?: string; is_billable?: boolean },
  ) {
    const where: Record<string, unknown> = { workspace_id: workspaceId, ended_at: { not: null } };
    if (filters.user_id) where['user_id'] = filters.user_id;
    if (filters.is_billable !== undefined) where['is_billable'] = filters.is_billable;
    if (filters.from_date || filters.to_date) {
      where['started_at'] = {
        ...(filters.from_date && { gte: new Date(filters.from_date) }),
        ...(filters.to_date && { lte: new Date(filters.to_date) }),
      };
    }

    const entries = await this.prisma.task_time_entries.findMany({
      where,
      include: {
        tasks: { select: { id: true, title: true, project_id: true } },
        users: { select: { id: true, raw_user_meta_data: true } },
      },
    });

    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
    const billableMinutes = entries
      .filter((e) => e.is_billable)
      .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

    return { total_minutes: totalMinutes, billable_minutes: billableMinutes, entries };
  }
}
