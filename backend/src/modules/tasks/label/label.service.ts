import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateLabelDto } from './dto/create-label.dto';

@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabelDto, user: AuthenticatedUser) {
    const exists = await this.prisma.task_labels.findFirst({
      where: { workspace_id: user.workspaceId, name: dto.name },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Label "${dto.name}" already exists in this workspace`);

    return this.prisma.task_labels.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        color: dto.color ?? '#6366f1',
        created_by: user.id,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.task_labels.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { task_label_assignments: true } } },
    });
  }

  async update(id: string, dto: Partial<CreateLabelDto>, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.task_labels.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.task_labels.delete({ where: { id } });
  }

  private async assertExists(id: string, workspaceId: string) {
    const label = await this.prisma.task_labels.findFirst({
      where: { id, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!label) throw new NotFoundException('Label not found');
  }
}
