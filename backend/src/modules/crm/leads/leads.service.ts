import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto, user: AuthenticatedUser) {
    return this.prisma.leads.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        source: dto.source,
        status: dto.status ?? 'New',
        score: dto.score ?? 0,
        assigned_to: dto.assigned_to,
        assigned_name: dto.assigned_name,
        notes: dto.notes,
        created_by: user.id,
      },
    });
  }

  async findAll(workspaceId: string, filters: {
    status?: string; source?: string; assigned_to?: string;
    search?: string; min_score?: number;
  }, page = 1, limit = 50) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.status) where['status'] = filters.status;
    if (filters.source) where['source'] = filters.source;
    if (filters.assigned_to) where['assigned_to'] = filters.assigned_to;
    if (filters.min_score !== undefined) where['score'] = { gte: filters.min_score };
    if (filters.search) {
      where['OR'] = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.leads.findMany({
        where, skip, take: limit,
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { deals: true } } },
      }),
      this.prisma.leads.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const lead = await this.prisma.leads.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        deals: { select: { id: true, title: true, stage: true, value: true } },
        lead_activities: { orderBy: { created_at: 'desc' }, take: 20 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: Partial<CreateLeadDto>, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.leads.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.assigned_to !== undefined && { assigned_to: dto.assigned_to }),
        ...(dto.assigned_name !== undefined && { assigned_name: dto.assigned_name }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.leads.delete({ where: { id } });
  }

  async addActivity(leadId: string, type: string, content: string, user: AuthenticatedUser) {
    await this.assertExists(leadId, user.workspaceId);
    return this.prisma.lead_activities.create({
      data: { lead_id: leadId, type, content, created_by: user.id },
    });
  }

  async getStats(workspaceId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.leads.count({ where: { workspace_id: workspaceId } }),
      this.prisma.leads.groupBy({
        by: ['status'],
        where: { workspace_id: workspaceId },
        _count: { _all: true },
      }),
    ]);
    return { total, by_status: byStatus.map((s) => ({ status: s.status, count: s._count._all })) };
  }

  private async assertExists(id: string, workspaceId: string) {
    const l = await this.prisma.leads.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true } });
    if (!l) throw new NotFoundException('Lead not found');
  }
}
