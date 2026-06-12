import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateDealDto } from './dto/create-deal.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDealDto, user: AuthenticatedUser) {
    return this.prisma.deals.create({
      data: {
        workspace_id: user.workspaceId,
        title: dto.title,
        lead_id: dto.lead_id,
        stage: dto.stage ?? 'Av. Leads',
        value: dto.value ?? 0,
        currency: dto.currency ?? 'INR',
        close_date: dto.close_date ? new Date(dto.close_date) : undefined,
        assigned_to: dto.assigned_to,
        assigned_name: dto.assigned_name,
        company: dto.company,
        contact_name: dto.contact_name,
        location: dto.location,
        notes: dto.notes,
        created_by: user.id,
      },
    });
  }

  async findAll(workspaceId: string, filters: {
    stage?: string; assigned_to?: string; search?: string;
  }, page = 1, limit = 50) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.stage) where['stage'] = filters.stage;
    if (filters.assigned_to) where['assigned_to'] = filters.assigned_to;
    if (filters.search) {
      where['OR'] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.deals.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
      this.prisma.deals.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const deal = await this.prisma.deals.findFirst({
      where: { id, workspace_id: workspaceId },
      include: { deal_activities: { orderBy: { created_at: 'desc' } } },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async update(id: string, dto: Partial<CreateDealDto>, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.deals.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.value !== undefined && { value: new Prisma.Decimal(dto.value) }),
        ...(dto.close_date !== undefined && { close_date: new Date(dto.close_date) }),
        ...(dto.assigned_to !== undefined && { assigned_to: dto.assigned_to }),
        ...(dto.assigned_name !== undefined && { assigned_name: dto.assigned_name }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        
        updated_at: new Date(),
      },
    });
  }

  async addActivity(dealId: string, type: string, content: string, user: AuthenticatedUser) {
    await this.assertExists(dealId, user.workspaceId);
    return this.prisma.deal_activities.create({
      data: { deal_id: dealId, type, content, created_by: user.id },
    });
  }

  async getPipeline(workspaceId: string) {
    const result = await this.prisma.deals.groupBy({
      by: ['stage'],
      where: { workspace_id: workspaceId },
      _count: { _all: true },
      _sum: { value: true },
    });
    return result.map((r) => ({
      stage: r.stage,
      count: r._count._all,
      value: Number(r._sum.value ?? 0),
    }));
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.deals.delete({ where: { id } });
  }

  private async assertExists(id: string, workspaceId: string) {
    const d = await this.prisma.deals.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true } });
    if (!d) throw new NotFoundException('Deal not found');
  }
}
