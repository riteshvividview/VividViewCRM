import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, status?: string, page = 1, limit = 20) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (status) where['status'] = status;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.campaigns.findMany({
        where, skip, take: limit,
        orderBy: { created_at: 'desc' },
        include: { email_templates: { select: { id: true, name: true } } },
      }),
      this.prisma.campaigns.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string, workspaceId: string) {
    const c = await this.prisma.campaigns.findFirst({
      where: { id, workspace_id: workspaceId },
      include: { email_templates: true },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async create(dto: {
    name: string; subject: string; preview_text?: string;
    template_id?: string; audience_config?: object;
  }, user: AuthenticatedUser) {
    return this.prisma.campaigns.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        subject: dto.subject,
        preview_text: dto.preview_text ?? '',
        status: 'draft',
        template_id: dto.template_id,
        audience_config: dto.audience_config as Prisma.InputJsonValue ?? {},
        created_by: user.id,
      },
    });
  }

  async updateStatus(id: string, status: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.campaigns.update({ where: { id }, data: { status, updated_at: new Date() } });
  }

  async getStats(workspaceId: string) {
    return this.prisma.campaigns.groupBy({
      by: ['status'],
      where: { workspace_id: workspaceId },
      _count: { _all: true },
    });
  }

  private async assertExists(id: string, workspaceId: string) {
    const c = await this.prisma.campaigns.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true } });
    if (!c) throw new NotFoundException('Campaign not found');
  }
}
