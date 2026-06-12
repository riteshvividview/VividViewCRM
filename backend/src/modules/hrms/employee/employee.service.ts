import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { encryptField, decryptField } from '@common/utils/hash.util';
import { AppConfigService } from '@config/config.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  private get db(): PrismaAny { return this.prisma; }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    const exists = await this.db.hr_employees.findFirst({
      where: { workspace_id: user.workspaceId, employee_code: dto.employee_code },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Employee code ${dto.employee_code} already exists`);

    const key = this.config.dataEncryptionKey;
    return this.db.hr_employees.create({
      data: {
        workspace_id: user.workspaceId,
        employee_code: dto.employee_code,
        user_id: dto.user_id,
        department_id: dto.department_id,
        designation: dto.designation,
        employment_type: dto.employment_type ?? 'full_time',
        reporting_manager_id: dto.reporting_manager_id,
        date_of_joining: new Date(dto.date_of_joining),
        probation_end_date: dto.probation_end_date ? new Date(dto.probation_end_date) : undefined,
        work_location: dto.work_location ?? 'office',
        salary_ctc: dto.salary_ctc ?? 0,
        salary_basic: dto.salary_basic ?? 0,
        pan_number: dto.pan_number ? encryptField(dto.pan_number, key) : undefined,
        aadhaar_number: dto.aadhaar_number ? encryptField(dto.aadhaar_number, key) : undefined,
        uan_number: dto.uan_number,
        bank_account_number: dto.bank_account_number ? encryptField(dto.bank_account_number, key) : undefined,
        bank_ifsc: dto.bank_ifsc,
        bank_name: dto.bank_name,
        emergency_contact_name: dto.emergency_contact_name,
        emergency_contact_phone: dto.emergency_contact_phone,
        status: 'active',
      },
    });
  }

  async findAll(
    workspaceId: string,
    filters: { department_id?: string; status?: string; search?: string; employment_type?: string },
    page = 1, limit = 20,
  ) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.department_id) where['department_id'] = filters.department_id;
    if (filters.status) where['status'] = filters.status;
    if (filters.employment_type) where['employment_type'] = filters.employment_type;
    if (filters.search) {
      where['OR'] = [
        { designation: { contains: filters.search, mode: 'insensitive' } },
        { employee_code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.db.hr_employees.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date_of_joining: 'desc' },
        include: {
          hr_departments: { select: { id: true, name: true } },
          profiles: { select: { full_name: true, avatar_url: true } },
        },
      }),
      this.db.hr_employees.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const employee = await this.db.hr_employees.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        hr_departments: true,
        profiles: { select: { full_name: true, avatar_url: true, email: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Decrypt sensitive fields before returning
    const key = this.config.dataEncryptionKey;
    return {
      ...employee,
      pan_number: employee.pan_number ? decryptField(employee.pan_number, key) : null,
      aadhaar_number: employee.aadhaar_number ? decryptField(employee.aadhaar_number, key) : null,
      bank_account_number: employee.bank_account_number ? decryptField(employee.bank_account_number, key) : null,
    };
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    const key = this.config.dataEncryptionKey;

    return this.db.hr_employees.update({
      where: { id },
      data: {
        ...(dto.department_id !== undefined && { department_id: dto.department_id }),
        ...(dto.designation !== undefined && { designation: dto.designation }),
        ...(dto.employment_type !== undefined && { employment_type: dto.employment_type }),
        ...(dto.reporting_manager_id !== undefined && { reporting_manager_id: dto.reporting_manager_id }),
        ...(dto.date_of_joining !== undefined && { date_of_joining: new Date(dto.date_of_joining) }),
        ...(dto.date_of_exit !== undefined && { date_of_exit: new Date(dto.date_of_exit) }),
        ...(dto.probation_end_date !== undefined && { probation_end_date: new Date(dto.probation_end_date) }),
        ...(dto.work_location !== undefined && { work_location: dto.work_location }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.salary_ctc !== undefined && { salary_ctc: dto.salary_ctc }),
        ...(dto.salary_basic !== undefined && { salary_basic: dto.salary_basic }),
        ...(dto.pan_number !== undefined && { pan_number: encryptField(dto.pan_number, key) }),
        ...(dto.aadhaar_number !== undefined && { aadhaar_number: encryptField(dto.aadhaar_number, key) }),
        ...(dto.uan_number !== undefined && { uan_number: dto.uan_number }),
        ...(dto.bank_account_number !== undefined && { bank_account_number: encryptField(dto.bank_account_number, key) }),
        ...(dto.bank_ifsc !== undefined && { bank_ifsc: dto.bank_ifsc }),
        ...(dto.bank_name !== undefined && { bank_name: dto.bank_name }),
        ...(dto.emergency_contact_name !== undefined && { emergency_contact_name: dto.emergency_contact_name }),
        ...(dto.emergency_contact_phone !== undefined && { emergency_contact_phone: dto.emergency_contact_phone }),
        updated_at: new Date(),
      },
    });
  }

  async getStats(workspaceId: string) {
    const [total, active, onNotice, onLeaveToday] = await Promise.all([
      this.db.hr_employees.count({ where: { workspace_id: workspaceId } }),
      this.db.hr_employees.count({ where: { workspace_id: workspaceId, status: 'active' } }),
      this.db.hr_employees.count({ where: { workspace_id: workspaceId, status: 'on_notice' } }),
      this.db.hr_leave_applications.count({
        where: {
          workspace_id: workspaceId,
          status: 'approved',
          from_date: { lte: new Date() },
          to_date: { gte: new Date() },
        },
      }),
    ]);
    return { total, active, on_notice: onNotice, on_leave_today: onLeaveToday };
  }

  private async assertExists(id: string, workspaceId: string) {
    const e = await this.db.hr_employees.findFirst({
      where: { id, workspace_id: workspaceId }, select: { id: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
  }
}
