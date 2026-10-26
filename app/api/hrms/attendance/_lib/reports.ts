import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultShift, dayOfWeek, noPunchStatus, istToday, type Shift } from "./helpers";

export interface MonthlyReportFilter {
  departmentId?: string | null;
  employeeIds?: string[] | null;
}

export interface DayRecord {
  status: string;
  late_minutes: number;
  is_regularized: boolean;
  is_unpaid_leave: boolean;
}

export interface EmployeeMonthlyReport {
  employee: {
    id: string;
    employee_code: string;
    designation: string | null;
    department: { id: string | null; name: string } | null;
    profile: { full_name: string; avatar_url: string | null } | null;
  };
  counts: Record<string, number>;
  /** dateStr -> day status/late info, only for days up to today (future days are omitted). */
  daily: Record<string, DayRecord>;
  working_days: number;
  present_days: number;
  attendance_percentage: number;
  total_work_minutes: number;
  total_overtime_minutes: number;
  total_late_minutes: number;
  /** Approved-leave days whose leave type is marked unpaid (hr_leave_types.is_paid = false) — used for payroll LOP. */
  unpaid_leave_days: number;
}

/**
 * Computes per-employee monthly attendance counts/percentages/daily breakdown for a
 * given workspace + year/month. Shared by the Reports and Analytics endpoints.
 * For the current (in-progress) month, days after today (IST) are excluded from
 * counts/working_days so attendance percentage reflects only elapsed days.
 */
export async function computeMonthlyReports(
  admin: SupabaseClient,
  workspaceId: string,
  year: number,
  month: number,
  filter: MonthlyReportFilter = {}
): Promise<EmployeeMonthlyReport[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const today = istToday();
  const isCurrentMonth = today >= monthStart && today <= monthEnd;
  const lastDay = isCurrentMonth ? Number(today.split("-")[2]) : daysInMonth;

  let employeeQuery = admin
    .from("hr_employees")
    .select("id, employee_code, designation, department_id, hr_departments!department_id(name), profiles(full_name, avatar_url)")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("employee_code");
  if (filter.departmentId) employeeQuery = employeeQuery.eq("department_id", filter.departmentId);
  if (filter.employeeIds) employeeQuery = employeeQuery.in("id", filter.employeeIds);

  const { data: employees } = await employeeQuery;
  if (!employees || employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);

  const [attendanceRes, holidaysRes, leavesRes, assignmentsRes, defaultShift] = await Promise.all([
    admin.from("hr_attendance").select("employee_id, date, status, work_minutes, overtime_minutes, late_minutes, is_regularized").eq("workspace_id", workspaceId).gte("date", monthStart).lte("date", monthEnd).in("employee_id", employeeIds),
    admin.from("hr_holidays").select("date, department_ids").eq("workspace_id", workspaceId).gte("date", monthStart).lte("date", monthEnd),
    admin.from("hr_leave_applications").select("employee_id, from_date, to_date, hr_leave_types(is_paid)").eq("workspace_id", workspaceId).eq("status", "approved").lte("from_date", monthEnd).gte("to_date", monthStart).in("employee_id", employeeIds),
    admin.from("hr_shift_assignments").select("employee_id, effective_from, effective_to, hr_shifts(*)").eq("workspace_id", workspaceId).lte("effective_from", monthEnd).or(`effective_to.is.null,effective_to.gte.${monthStart}`).in("employee_id", employeeIds).order("effective_from", { ascending: true }),
    getDefaultShift(admin, workspaceId),
  ]);

  const attendanceByEmployee = new Map<string, Map<string, { status: string; work_minutes: number; overtime_minutes: number; late_minutes: number; is_regularized: boolean }>>();
  for (const a of attendanceRes.data ?? []) {
    const map = attendanceByEmployee.get(a.employee_id) ?? new Map();
    map.set(a.date, { status: a.status, work_minutes: a.work_minutes ?? 0, overtime_minutes: a.overtime_minutes ?? 0, late_minutes: a.late_minutes ?? 0, is_regularized: !!a.is_regularized });
    attendanceByEmployee.set(a.employee_id, map);
  }

  const leavesByEmployee = new Map<string, { from_date: string; to_date: string; is_paid: boolean }[]>();
  for (const l of (leavesRes.data ?? []) as unknown as Array<{ employee_id: string; from_date: string; to_date: string; hr_leave_types: { is_paid: boolean } | { is_paid: boolean }[] | null }>) {
    const list = leavesByEmployee.get(l.employee_id) ?? [];
    const leaveType = Array.isArray(l.hr_leave_types) ? l.hr_leave_types[0] : l.hr_leave_types;
    list.push({ from_date: l.from_date, to_date: l.to_date, is_paid: leaveType?.is_paid ?? true });
    leavesByEmployee.set(l.employee_id, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentsByEmployee = new Map<string, any[]>();
  for (const a of (assignmentsRes.data ?? []) as Array<{ employee_id: string } & Record<string, unknown>>) {
    const list = assignmentsByEmployee.get(a.employee_id) ?? [];
    list.push(a);
    assignmentsByEmployee.set(a.employee_id, list);
  }

  const holidays = (holidaysRes.data ?? []) as { date: string; department_ids: string[] | null }[];
  const holidaysByDate = new Map<string, { department_ids: string[] | null }[]>();
  for (const h of holidays) {
    const list = holidaysByDate.get(h.date) ?? [];
    list.push({ department_ids: h.department_ids });
    holidaysByDate.set(h.date, list);
  }

  return employees.map((emp) => {
    const attendanceByDate = attendanceByEmployee.get(emp.id) ?? new Map();
    const leaves = leavesByEmployee.get(emp.id) ?? [];
    const assignments = assignmentsByEmployee.get(emp.id) ?? [];

    const resolveShift = (dateStr: string): Shift | null => {
      const match = assignments.find(
        (a) => a.effective_from <= dateStr && (!a.effective_to || a.effective_to >= dateStr)
      );
      return (match?.hr_shifts as Shift) ?? defaultShift;
    };

    const counts: Record<string, number> = {
      present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, holiday: 0, weekend: 0, work_from_home: 0,
    };
    const daily: Record<string, DayRecord> = {};
    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalLateMinutes = 0;
    let workingDays = 0;
    let unpaidLeaveDays = 0;

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const attendance = attendanceByDate.get(dateStr);
      const shift = resolveShift(dateStr);
      const isWeekendDay = !shift ? false : !shift.working_days.includes(dayOfWeek(dateStr));
      const holidaysToday = holidaysByDate.get(dateStr) ?? [];
      const isHolidayDay = holidaysToday.some(
        (h) => !h.department_ids?.length || (!!emp.department_id && h.department_ids.includes(emp.department_id))
      );
      const leaveMatch = leaves.find((l) => l.from_date <= dateStr && l.to_date >= dateStr);
      const onLeave = !!leaveMatch;

      const status = attendance?.status ?? noPunchStatus({ isHoliday: isHolidayDay, isWeekend: isWeekendDay, isOnLeave: onLeave });

      if (status in counts) counts[status]++;
      if (!isWeekendDay && !isHolidayDay) workingDays++;

      if (attendance) {
        totalWorkMinutes += attendance.work_minutes;
        totalOvertimeMinutes += attendance.overtime_minutes;
        totalLateMinutes += attendance.late_minutes;
      }

      const isUnpaidLeave = status === "on_leave" && !!leaveMatch && !leaveMatch.is_paid;
      if (isUnpaidLeave) unpaidLeaveDays++;

      daily[dateStr] = { status, late_minutes: attendance?.late_minutes ?? 0, is_regularized: attendance?.is_regularized ?? false, is_unpaid_leave: isUnpaidLeave };
    }

    const presentDays = counts.present + counts.late + counts.half_day + counts.work_from_home;
    const attendancePercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 1000) / 10 : 0;

    return {
      employee: {
        id: emp.id,
        employee_code: emp.employee_code,
        designation: emp.designation,
        department: emp.department_id ? { id: emp.department_id, name: (emp.hr_departments as unknown as { name: string } | null)?.name ?? "" } : null,
        profile: emp.profiles as unknown as { full_name: string; avatar_url: string | null } | null,
      },
      counts,
      daily,
      working_days: workingDays,
      present_days: presentDays,
      attendance_percentage: attendancePercentage,
      total_work_minutes: totalWorkMinutes,
      total_overtime_minutes: totalOvertimeMinutes,
      total_late_minutes: totalLateMinutes,
      unpaid_leave_days: unpaidLeaveDays,
    };
  });
}
