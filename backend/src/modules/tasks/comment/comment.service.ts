import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { ActivityService } from '../activity/activity.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(taskId: string, dto: CreateCommentDto, author: AuthenticatedUser) {
    const task = await this.prisma.tasks.findFirst({
      where: { id: taskId, workspace_id: author.workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: taskId,
        workspace_id: author.workspaceId,
        author_id: author.id,
        body: dto.body,
        parent_comment_id: dto.parent_comment_id,
      },
      include: {
        users: { select: { id: true, raw_user_meta_data: true } },
      },
    });

    const mentionedIds = this.parseMentions(dto.body);
    if (mentionedIds.length > 0) {
      await this.prisma.task_mentions.createMany({
        data: mentionedIds.map((userId) => ({
          comment_id: comment.id,
          task_id: taskId,
          workspace_id: author.workspaceId,
          mentioned_user_id: userId,
        })),
        skipDuplicates: true,
      });
    }

    void this.activity.log({
      taskId,
      workspaceId: author.workspaceId,
      actorId: author.id,
      action: 'commented',
    });

    return comment;
  }

  async findAll(taskId: string, workspaceId: string, page = 1, limit = 50) {
    await this.assertTaskExists(taskId, workspaceId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.task_comments.findMany({
        where: { task_id: taskId, workspace_id: workspaceId, parent_comment_id: null, deleted_at: null },
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
        include: {
          users: { select: { id: true, raw_user_meta_data: true } },
          other_task_comments: {
            where: { deleted_at: null },
            orderBy: { created_at: 'asc' },
            include: {
              users: { select: { id: true, raw_user_meta_data: true } },
            },
          },
        },
      }),
      this.prisma.task_comments.count({
        where: { task_id: taskId, workspace_id: workspaceId, parent_comment_id: null, deleted_at: null },
      }),
    ]);

    return { items, total, page, limit };
  }

  async update(commentId: string, dto: UpdateCommentDto, author: AuthenticatedUser) {
    const comment = await this.prisma.task_comments.findFirst({
      where: { id: commentId, workspace_id: author.workspaceId, deleted_at: null },
      select: { id: true, author_id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.author_id !== author.id) throw new ForbiddenException('You can only edit your own comments');

    return this.prisma.task_comments.update({
      where: { id: commentId },
      data: { body: dto.body, edited_at: new Date(), updated_at: new Date() },
    });
  }

  async delete(commentId: string, actor: AuthenticatedUser) {
    const comment = await this.prisma.task_comments.findFirst({
      where: { id: commentId, workspace_id: actor.workspaceId, deleted_at: null },
      select: { id: true, author_id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const isOwner = comment.author_id === actor.id;
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN';
    if (!isOwner && !isAdmin) throw new ForbiddenException('Insufficient permission to delete this comment');

    await this.prisma.task_comments.update({
      where: { id: commentId },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }

  /** Extract user IDs from @uuid-style mentions in comment body */
  private parseMentions(body: string): string[] {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return [...new Set(body.match(uuidPattern) ?? [])];
  }

  private async assertTaskExists(taskId: string, workspaceId: string) {
    const task = await this.prisma.tasks.findFirst({
      where: { id: taskId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }
}
