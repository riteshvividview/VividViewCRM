import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto, user: AuthenticatedUser) {
    return this.prisma.contacts.create({
      data: {
        workspace_id: user.workspaceId,
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        role: dto.role,
        status: dto.status ?? 'Active',
        notes: dto.notes,
      },
    });
  }

  async findAll(workspaceId: string, filters: { search?: string; company?: string; status?: string }, page = 1, limit = 50) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.status) where['status'] = filters.status;
    if (filters.company) where['company'] = { contains: filters.company, mode: 'insensitive' };
    if (filters.search) {
      where['OR'] = [
        { full_name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.contacts.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
      this.prisma.contacts.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const c = await this.prisma.contacts.findFirst({ where: { id, workspace_id: workspaceId } });
    if (!c) throw new NotFoundException('Contact not found');
    return c;
  }

  async update(id: string, dto: Partial<CreateContactDto>, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.contacts.update({ where: { id }, data: { ...dto } });
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.contacts.delete({ where: { id } });
  }

  private async assertExists(id: string, workspaceId: string) {
    const c = await this.prisma.contacts.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true } });
    if (!c) throw new NotFoundException('Contact not found');
  }
}
