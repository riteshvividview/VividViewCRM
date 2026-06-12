import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { MarkAttendanceDto, RegularizeAttendanceDto } from './dto/mark-attendance.dto';
import { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): PrismaAny { return this.prisma; }

  async mark(dto: MarkAttendanceDto, user: AuthenticatedUser) {
    const existing = await this.db.hr_attendance.findFirst({
      where: { employee_id: dto.employee_id, date: new Date(dto.date) },
    });
    if (existing) {
      return this.db.hr_attendance.update({
        where: { id: existing.id },
        data: {
          ...(dto.check_in !== undefined && { check_in: new Date(dto.check_in) }),
          ...(dto.check_out !== undefined && { check_out: new Date(dto.check_out) }),
          ...(dto.check_in_location !== undefined && { check_in_location: dto.check_in_location as Prisma.InputJsonValue }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          status: this.computeStatus(dto),
          work_minutes: this.computeWorkMinutes(dto.check_in, dto.check_out),
          updated_at: new Date(),
        },
      });
    }

    return this.db.hr_attendance.create({
      data: {
        workspace_id: user.workspaceId,
        employee_id: dto.employee_id,
        date: new Date(dto.date),
        check_in: dto.check_in ? new Date(dto.check_in) : undefined,
        check_out: dto.check_out ? new Date(dto.check_out) : undefined,
        check_in_location: dto.check_in_location as Prisma.InputJsonValue | undefined,
        status: this.computeStatus(dto),
        work_minutes: this.computeWorkMinutes(dto.check_in, dto.check_out),
        notes: dto.notes,
      },
    });
  }

  async selfCheckIn(employeeId: string, location: { lat: number; lng: number } | undefined, user: AuthenticatedUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.db.hr_attendance.findFirst({
      where: { employee_id: employeeId, date: today },
    });

    if (existing?.check_in) throw new ConflictException('Already checked in today');

    if (existing) {
      return this.db.hr_attendance.update({
        where: { id: existing.id },
        data: {
          check_in: new Date(),
          check_in_location: location as Prisma.InputJsonValue | undefined,
          status: 'present',
          updated_at: new Date(),
        },
      });
    }

    return this.db.hr_attendance.create({
      data: {
        workspace_id: user.workspaceId,
        employee_id: employeeId,
        date: today,
        check_in: new Date(),
        check_in_location: location as Prisma.InputJsonValue | undefined,
        status: 'present',
      },
    });
  }

  async selfCheckOut(employeeId: string, location: { lat: number; lng: number } | undefined, user: AuthenticatedUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.db.hr_attendance.findFirst({ where: { employee_id: employeeId, date: today } });
    if (!record?.check_in) throw new NotFoundException('No check-in found for today');
    if (record.check_out) throw new ConflictException('Already checked out today');

    const checkOut = new Date();
    const workMinutes = Math.round((checkOut.getTime() - new Date(record.check_in).getTime()) / 60000);

    return this.db.hr_attendance.update({
      where: { id: record.id },
      data: {
        check_out: checkOut,
        check_out_location: location as Prisma.InputJsonValue | undefined,
        work_minutes: workMinutes,
        overtime_minutes: Math.max(0, workMinutes - 480),
        updated_at: new Date(),
      },
    });
  }

  async getForDate(workspaceId: string, date: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.db.hr_attendance.findMany({
        where: { workspace_id: workspaceId, date: new Date(date) },
        skip,
        take: limit,
        include: {
          hr_employees: {
            include: { profiles: { select: { full_name: true, avatar_url: true } } },
          },
        },
      }),
      this.db.hr_attendance.count({ where: { workspace_id: workspaceId, date: new Date(date) } }),
    ]);
    return { items, total, page, limit };
  }

  async getForEmployee(employeeId: string, workspaceId: string, fromDate: string, toDate: string) {
    return this.db.hr_attendance.findMany({
      where: {
        employee_id: employeeId,
        workspace_id: workspaceId,
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      orderBy: { date: 'desc' },
    });
  }

  async regularize(id: string, dto: RegularizeAttendanceDto, user: AuthenticatedUser) {
    const record = await this.db.hr_attendance.findFirst({
      where: { id, workspace_id: user.workspaceId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    return this.db.hr_attendance.update({
      where: { id },
      data: {
        ...(dto.check_in && { check_in: new Date(dto.check_in) }),
        ...(dto.check_out && { check_out: new Date(dto.check_out) }),
        is_regularized: true,
        regularization_reason: dto.reason,
        work_minutes: this.computeWorkMinutes(dto.check_in, dto.check_out),
        updated_at: new Date(),
      },
    });
  }

  async getSummary(workspaceId: string, date: string) {
    const d = new Date(date);
    const [present, absent, late, onLeave] = await Promise.all([
      this.db.hr_attendance.count({ where: { workspace_id: workspaceId, date: d, status: 'present' } }),
      this.db.hr_attendance.count({ where: { workspace_id: workspaceId, date: d, status: 'absent' } }),
      this.db.hr_attendance.count({ where: { workspace_id: workspaceId, date: d, status: 'late' } }),
      this.db.hr_attendance.count({ where: { workspace_id: workspaceId, date: d, status: 'on_leave' } }),
    ]);
    return { present, absent, late, on_leave: onLeave, date };
  }

  private computeStatus(dto: MarkAttendanceDto): string {
    if (!dto.check_in) return 'absent';
    const checkInHour = new Date(dto.check_in).getHours();
    if (checkInHour >= 10) return 'late';
    return 'present';
  }

  private computeWorkMinutes(checkIn?: string, checkOut?: string): number {
    if (!checkIn || !checkOut) return 0;
    return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
  }
}
