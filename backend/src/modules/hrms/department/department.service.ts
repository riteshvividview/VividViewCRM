import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): PrismaAny { return this.prisma; }

  async create(dto: CreateDepartmentDto, user: AuthenticatedUser) {
    return this.db.hr_departments.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        code: dto.code,
        head_employee_id: dto.head_employee_id,
        parent_department_id: dto.parent_department_id,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.db.hr_departments.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { hr_employees: true } },
      },
    });
  }

  async update(id: string, dto: Partial<CreateDepartmentDto>, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.db.hr_departments.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.head_employee_id !== undefined && { head_employee_id: dto.head_employee_id }),
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.db.hr_departments.delete({ where: { id } });
  }

  private async assertExists(id: string, workspaceId: string) {
    const d = await this.db.hr_departments.findFirst({
      where: { id, workspace_id: workspaceId }, select: { id: true },
    });
    if (!d) throw new NotFoundException('Department not found');
  }
}
