import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

const PF_RATE = 0.12;
const ESI_RATE = 0.0075;
const ESI_THRESHOLD = 21000;
const PT_SLAB = 200; // Professional tax (simplistic flat rate for now)

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): PrismaAny { return this.prisma; }

  async createRun(dto: CreatePayrollRunDto, user: AuthenticatedUser) {
    const exists = await this.db.hr_payroll_runs.findFirst({
      where: { workspace_id: user.workspaceId, month: dto.month, year: dto.year },
    });
    if (exists) throw new ConflictException(`Payroll for ${dto.month}/${dto.year} already exists`);

    return this.db.hr_payroll_runs.create({
      data: {
        workspace_id: user.workspaceId,
        month: dto.month,
        year: dto.year,
        status: 'draft',
      },
    });
  }

  async getRuns(workspaceId: string) {
    return this.db.hr_payroll_runs.findMany({
      where: { workspace_id: workspaceId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async processRun(runId: string, user: AuthenticatedUser) {
    const run = await this.db.hr_payroll_runs.findFirst({
      where: { id: runId, workspace_id: user.workspaceId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'draft') throw new ConflictException('Only draft runs can be processed');

    await this.db.hr_payroll_runs.update({
      where: { id: runId },
      data: { status: 'processing' },
    });

    const employees = await this.db.hr_employees.findMany({
      where: { workspace_id: user.workspaceId, status: 'active' },
    });

    const daysInMonth = new Date(run.year, run.month, 0).getDate();
    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const emp of employees) {
      const ctc = Number(emp.salary_ctc) || 0;
      const basic = Number(emp.salary_basic) || ctc * 0.4;
      const hra = basic * 0.4;
      const specialAllowance = ctc / 12 - basic - hra;

      // Attendance-based LOP
      const attendance = await this.db.hr_attendance.findMany({
        where: {
          employee_id: emp.id,
          date: {
            gte: new Date(run.year, run.month - 1, 1),
            lte: new Date(run.year, run.month, 0),
          },
          status: { notIn: ['absent'] },
        },
      });
      const daysWorked = attendance.length;
      const daysLop = Math.max(0, daysInMonth - daysWorked);
      const lopDeduction = daysLop > 0 ? (basic / daysInMonth) * daysLop : 0;

      const grossSalary = Math.max(0, (ctc / 12) - lopDeduction);
      const pfEmployee = Math.min(basic * PF_RATE, 1800);
      const esiEmployee = grossSalary <= ESI_THRESHOLD ? grossSalary * ESI_RATE : 0;
      const professionalTax = PT_SLAB;
      const totalDed = pfEmployee + esiEmployee + professionalTax;
      const netSalary = grossSalary - totalDed;

      totalGross += grossSalary;
      totalDeductions += totalDed;
      totalNet += netSalary;

      await this.db.hr_payslips.upsert({
        where: { employee_id_month_year: { employee_id: emp.id, month: run.month, year: run.year } },
        create: {
          workspace_id: user.workspaceId,
          employee_id: emp.id,
          payroll_run_id: runId,
          month: run.month,
          year: run.year,
          days_in_month: daysInMonth,
          days_worked: daysWorked,
          days_lop: daysLop,
          basic_salary: basic,
          hra,
          special_allowance: Math.max(0, specialAllowance),
          gross_salary: grossSalary,
          pf_employee: pfEmployee,
          pf_employer: Math.min(basic * PF_RATE, 1800),
          esi_employee: esiEmployee,
          professional_tax: professionalTax,
          total_deductions: totalDed,
          net_salary: netSalary,
          status: 'draft',
        },
        update: {
          days_worked: daysWorked, days_lop: daysLop, gross_salary: grossSalary,
          net_salary: netSalary, total_deductions: totalDed, updated_at: new Date(),
        },
      });
    }

    return this.db.hr_payroll_runs.update({
      where: { id: runId },
      data: {
        status: 'completed',
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        employee_count: employees.length,
        processed_at: new Date(),
      },
    });
  }

  async getPayslips(runId: string, workspaceId: string) {
    return this.db.hr_payslips.findMany({
      where: { payroll_run_id: runId, workspace_id: workspaceId },
      include: {
        hr_employees: {
          include: { profiles: { select: { full_name: true } } },
        },
      },
      orderBy: { net_salary: 'desc' },
    });
  }

  async getEmployeePayslips(employeeId: string, workspaceId: string) {
    return this.db.hr_payslips.findMany({
      where: { employee_id: employeeId, workspace_id: workspaceId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
