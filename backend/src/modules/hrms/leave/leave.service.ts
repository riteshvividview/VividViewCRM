import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ApproveLeaveDto, LeaveDecision } from './dto/approve-leave.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): PrismaAny { return this.prisma; }

  // ── Leave Types ─────────────────────────────────────────────────────────────

  async createLeaveType(dto: CreateLeaveTypeDto, user: AuthenticatedUser) {
    return this.db.hr_leave_types.create({
      data: {
        workspace_id: user.workspaceId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        days_per_year: dto.days_per_year,
        carry_forward_limit: dto.carry_forward_limit ?? 0,
        is_paid: dto.is_paid ?? true,
        requires_approval: dto.requires_approval ?? true,
        applicable_gender: dto.applicable_gender ?? 'all',
      },
    });
  }

  async getLeaveTypes(workspaceId: string) {
    return this.db.hr_leave_types.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  // ── Leave Applications ──────────────────────────────────────────────────────

  async apply(employeeId: string, dto: ApplyLeaveDto, user: AuthenticatedUser) {
    const leaveType = await this.db.hr_leave_types.findFirst({
      where: { id: dto.leave_type_id, workspace_id: user.workspaceId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const from = new Date(dto.from_date);
    const to = new Date(dto.to_date);
    if (to < from) throw new BadRequestException('to_date must be after from_date');

    const msPerDay = 86400000;
    const daysCount = dto.is_half_day ? 0.5 : Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;

    // Check balance
    const year = from.getFullYear();
    const balance = await this.db.hr_leave_balances.findFirst({
      where: { employee_id: employeeId, leave_type_id: dto.leave_type_id, year },
    });

    const available = balance
      ? Number(balance.total_days) + Number(balance.carried_forward_days) - Number(balance.used_days) - Number(balance.pending_days)
      : Number(leaveType.days_per_year);

    if (daysCount > available) {
      throw new BadRequestException(`Insufficient leave balance. Available: ${available}, Requested: ${daysCount}`);
    }

    const application = await this.db.hr_leave_applications.create({
      data: {
        workspace_id: user.workspaceId,
        employee_id: employeeId,
        leave_type_id: dto.leave_type_id,
        from_date: from,
        to_date: to,
        days_count: daysCount,
        is_half_day: dto.is_half_day ?? false,
        half_day_date: dto.half_day_date ? new Date(dto.half_day_date) : undefined,
        reason: dto.reason,
        status: leaveType.requires_approval ? 'pending' : 'approved',
      },
    });

    // Update pending balance
    if (balance) {
      await this.db.hr_leave_balances.update({
        where: { id: balance.id },
        data: { pending_days: { increment: daysCount }, updated_at: new Date() },
      });
    } else {
      await this.db.hr_leave_balances.create({
        data: {
          workspace_id: user.workspaceId,
          employee_id: employeeId,
          leave_type_id: dto.leave_type_id,
          year,
          total_days: Number(leaveType.days_per_year),
          pending_days: daysCount,
          used_days: 0,
          carried_forward_days: 0,
        },
      });
    }

    return application;
  }

  async getApplications(workspaceId: string, filters: { employee_id?: string; status?: string; year?: number }) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.employee_id) where['employee_id'] = filters.employee_id;
    if (filters.status) where['status'] = filters.status;
    if (filters.year) {
      where['from_date'] = { gte: new Date(`${filters.year}-01-01`) };
    }

    return this.db.hr_leave_applications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        hr_leave_types: { select: { name: true, code: true, is_paid: true } },
        hr_employees: {
          include: { profiles: { select: { full_name: true, avatar_url: true } } },
        },
      },
    });
  }

  async decide(applicationId: string, dto: ApproveLeaveDto, actor: AuthenticatedUser) {
    const application = await this.db.hr_leave_applications.findFirst({
      where: { id: applicationId, workspace_id: actor.workspaceId },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== 'pending') {
      throw new BadRequestException('Only pending applications can be approved or rejected');
    }

    const isApproved = dto.decision === LeaveDecision.APPROVE;

    await this.db.hr_leave_applications.update({
      where: { id: applicationId },
      data: {
        status: dto.decision,
        approved_by: actor.id,
        approved_at: new Date(),
        rejection_reason: dto.rejection_reason,
        updated_at: new Date(),
      },
    });

    // Update balance
    const year = new Date(application.from_date).getFullYear();
    const balance = await this.db.hr_leave_balances.findFirst({
      where: { employee_id: application.employee_id, leave_type_id: application.leave_type_id, year },
    });

    if (balance) {
      await this.db.hr_leave_balances.update({
        where: { id: balance.id },
        data: {
          pending_days: { decrement: Number(application.days_count) },
          ...(isApproved && { used_days: { increment: Number(application.days_count) } }),
          updated_at: new Date(),
        },
      });
    }
  }

  async getBalances(employeeId: string, year: number, workspaceId: string) {
    const leaveTypes = await this.db.hr_leave_types.findMany({ where: { workspace_id: workspaceId } });
    const balances = await this.db.hr_leave_balances.findMany({
      where: { employee_id: employeeId, year },
    });

    return leaveTypes.map((lt: Record<string, unknown>) => {
      const bal = balances.find((b: Record<string, unknown>) => b['leave_type_id'] === lt['id']);
      return {
        leave_type: lt,
        total: bal ? Number(bal['total_days']) + Number(bal['carried_forward_days']) : Number(lt['days_per_year']),
        used: bal ? Number(bal['used_days']) : 0,
        pending: bal ? Number(bal['pending_days']) : 0,
        available: bal
          ? Number(bal['total_days']) + Number(bal['carried_forward_days']) - Number(bal['used_days']) - Number(bal['pending_days'])
          : Number(lt['days_per_year']),
      };
    });
  }
}
