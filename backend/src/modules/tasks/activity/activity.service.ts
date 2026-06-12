import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';

export interface ActivityLogParams {
  taskId: string;
  workspaceId: string;
  actorId: string | null;
  action: string;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: ActivityLogParams): Promise<void> {
    try {
      await this.prisma.task_activity_log.create({
        data: {
          task_id: params.taskId,
          workspace_id: params.workspaceId,
          actor_id: params.actorId,
          action: params.action,
          field_name: params.fieldName,
          old_value: params.oldValue !== undefined ? (params.oldValue as Prisma.InputJsonValue) : undefined,
          new_value: params.newValue !== undefined ? (params.newValue as Prisma.InputJsonValue) : undefined,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write activity log: ${(err as Error).message}`);
    }
  }

  async findByTask(taskId: string, workspaceId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.task_activity_log.findMany({
        where: { task_id: taskId, workspace_id: workspaceId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          users: { select: { id: true, raw_user_meta_data: true } },
        },
      }),
      this.prisma.task_activity_log.count({ where: { task_id: taskId, workspace_id: workspaceId } }),
    ]);
    return { items, total, page, limit };
  }
}
