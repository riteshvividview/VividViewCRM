import { SupabaseClient } from "@supabase/supabase-js";
import {
  type Shift,
  getActiveShifts,
  getDefaultShift,
  computeCheckIn,
  computeCheckOut,
  noPunchStatus,
  pickShiftByTime,
  dayOfWeek,
  tsToISTMinutes,
  istToday,
  writeAuditLog,
} from "./helpers";

/** Largest inclusive date range (in days) a single processing run may cover. */
export const MAX_PROCESS_DAYS = 31;

export interface ProcessingSummary {
  from_date: string;
  to_date: string;
  dates_processed: number;
  employees_processed: number;
  records_created: number;
  records_updated: number;
  exceptions_created: number;
  skipped_future_dates: number;
}

interface AttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  work_mode: string;
  status: string;
  is_auto_generated: boolean | null;
  is_regularized: boolean | null;
  shift_id: string | null;
}

function dateRange(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const dates: string[] = [];
  const cur = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cur.getTime() <= end.getTime()) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Auto Attendance Calculation + Reprocessing engine.
 *
 * For every (employee, date) in range (excluding today/future):
 * - If a real punch exists, recomputes late/early-leave/overtime/half-day/status
 *   from the current shift configuration (Attendance Reprocessing), using the
 *   same shift-resolution rules as check-in (Auto Shift Detection). A punch with
 *   no check-out raises a `missing_checkout` exception.
 * - If no real punch exists, computes the day's status (absent/holiday/weekend/
 *   on_leave) and persists it (Auto Attendance Calculation / Auto Status
 *   Calculation). Re-running updates previously auto-generated rows if holidays
 *   or leave were added later. A computed `absent` day raises an
 *   `auto_marked_absent` exception (Attendance Exception Handling).
 */
export async function runAttendanceProcessing(
  admin: SupabaseClient,
  workspaceId: string,
  fromDate: string,
  toDate: string,
  triggeredBy: string,
  employeeId?: string | null
): Promise<ProcessingSummary> {
  const today = istToday();
  const allDates = dateRange(fromDate, toDate);
  const dates = allDates.filter((d) => d < today);
  const skippedFutureDates = allDates.length - dates.length;

  const empty = (employeesProcessed: number): ProcessingSummary => ({
    from_date: fromDate,
    to_date: toDate,
    dates_processed: dates.length,
    employees_processed: employeesProcessed,
    records_created: 0,
    records_updated: 0,
    exceptions_created: 0,
    skipped_future_dates: skippedFutureDates,
  });

  if (dates.length === 0) return empty(0);

  let empQuery = admin
    .from("hr_employees")
    .select("id, department_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (employeeId) empQuery = empQuery.eq("id", employeeId);
  const { data: employeesData } = await empQuery;
  const employees = employeesData ?? [];
  if (employees.length === 0) return empty(0);

  const employeeIds = employees.map((e) => e.id);
  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  const [holidaysRes, leavesRes, assignmentsRes, existingRes, defaultShift, allActiveShifts] = await Promise.all([
    admin.from("hr_holidays").select("date, department_ids").eq("workspace_id", workspaceId).gte("date", rangeStart).lte("date", rangeEnd),
    admin.from("hr_leave_applications").select("employee_id, from_date, to_date").eq("workspace_id", workspaceId).eq("status", "approved").lte("from_date", rangeEnd).gte("to_date", rangeStart).in("employee_id", employeeIds),
    admin.from("hr_shift_assignments").select("employee_id, effective_from, effective_to, hr_shifts(*)").eq("workspace_id", workspaceId).lte("effective_from", rangeEnd).or(`effective_to.is.null,effective_to.gte.${rangeStart}`).in("employee_id", employeeIds).order("effective_from", { ascending: true }),
    admin.from("hr_attendance").select("*").eq("workspace_id", workspaceId).gte("date", rangeStart).lte("date", rangeEnd).in("employee_id", employeeIds),
    getDefaultShift(admin, workspaceId),
    getActiveShifts(admin, workspaceId),
  ]);

  const holidaysByDate = new Map<string, { department_ids: string[] | null }[]>();
  for (const h of holidaysRes.data ?? []) {
    const list = holidaysByDate.get(h.date) ?? [];
    list.push({ department_ids: h.department_ids });
    holidaysByDate.set(h.date, list);
  }

  const leavesByEmployee = new Map<string, { from_date: string; to_date: string }[]>();
  for (const l of leavesRes.data ?? []) {
    const list = leavesByEmployee.get(l.employee_id) ?? [];
    list.push({ from_date: l.from_date, to_date: l.to_date });
    leavesByEmployee.set(l.employee_id, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentsByEmployee = new Map<string, any[]>();
  for (const a of (assignmentsRes.data ?? []) as Array<{ employee_id: string } & Record<string, unknown>>) {
    const list = assignmentsByEmployee.get(a.employee_id) ?? [];
    list.push(a);
    assignmentsByEmployee.set(a.employee_id, list);
  }

  const existingRows = (existingRes.data ?? []) as AttendanceRow[];
  const existingByKey = new Map<string, AttendanceRow>();
  for (const row of existingRows) existingByKey.set(`${row.employee_id}_${row.date}`, row);

  const breaksByAttendance = new Map<string, number>();
  const attendanceIdsWithBreaks = existingRows.filter((r) => r.check_in && r.check_out).map((r) => r.id);
  if (attendanceIdsWithBreaks.length > 0) {
    const { data: breaksData } = await admin
      .from("hr_attendance_breaks")
      .select("attendance_id, break_start, break_end")
      .in("attendance_id", attendanceIdsWithBreaks);
    for (const b of breaksData ?? []) {
      if (!b.break_end) continue;
      const mins = Math.max(0, (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
      breaksByAttendance.set(b.attendance_id, (breaksByAttendance.get(b.attendance_id) ?? 0) + mins);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findAssignedShift(assignments: any[], dateStr: string): Shift | null {
    const match = assignments.find((a) => a.effective_from <= dateStr && (!a.effective_to || a.effective_to >= dateStr));
    return (match?.hr_shifts as Shift) ?? null;
  }

  const nowISO = new Date().toISOString();
  const updates: { id: string; fields: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const insertExceptionIdx: number[] = [];
  const exceptionsForExisting: { attendance_id: string; employee_id: string; date: string; exception_type: string; description: string }[] = [];

  let recordsCreated = 0;
  let recordsUpdated = 0;

  for (const emp of employees) {
    const assignments = assignmentsByEmployee.get(emp.id) ?? [];
    const leaves = leavesByEmployee.get(emp.id) ?? [];

    for (const dateStr of dates) {
      const existing = existingByKey.get(`${emp.id}_${dateStr}`);
      const assignedShift = findAssignedShift(assignments, dateStr);

      if (existing?.check_in) {
        // A manually-approved correction (is_regularized) is locked from automated
        // recompute — HR has finalized this record.
        if (existing.is_regularized) continue;

        const checkInMinutes = tsToISTMinutes(existing.check_in);
        const shift =
          assignedShift ??
          (allActiveShifts.length > 1 ? pickShiftByTime(allActiveShifts, checkInMinutes) : allActiveShifts[0]) ??
          defaultShift;
        if (!shift) continue;

        const { late_minutes, status: checkInStatus } = computeCheckIn(shift, checkInMinutes);

        if (existing.check_out) {
          const totalBreakMinutes = breaksByAttendance.get(existing.id) ?? 0;
          const rawMinutes = Math.max(0, (new Date(existing.check_out).getTime() - new Date(existing.check_in).getTime()) / 60000);
          const workMinutes = Math.max(0, Math.round(rawMinutes - totalBreakMinutes));
          const checkOutMinutes = tsToISTMinutes(existing.check_out);
          const { status, overtime_minutes, early_leave_minutes } = computeCheckOut(shift, workMinutes, checkOutMinutes, existing.work_mode, late_minutes);

          updates.push({
            id: existing.id,
            fields: {
              shift_id: shift.id, late_minutes, status, overtime_minutes, early_leave_minutes,
              work_minutes: workMinutes, total_break_minutes: Math.round(totalBreakMinutes), processed_at: nowISO,
            },
          });
        } else {
          updates.push({ id: existing.id, fields: { shift_id: shift.id, late_minutes, status: checkInStatus, processed_at: nowISO } });
          exceptionsForExisting.push({
            attendance_id: existing.id, employee_id: emp.id, date: dateStr,
            exception_type: "missing_checkout",
            description: `No check-out recorded for ${dateStr}`,
          });
        }
        recordsUpdated++;
        continue;
      }

      // No real punch for this day.
      const shiftForDay = assignedShift ?? defaultShift ?? allActiveShifts[0] ?? null;
      const isWeekendDay = shiftForDay ? !shiftForDay.working_days.includes(dayOfWeek(dateStr)) : false;
      const holidaysToday = holidaysByDate.get(dateStr) ?? [];
      const isHolidayDay = holidaysToday.some(
        (h) => !h.department_ids?.length || (!!emp.department_id && h.department_ids.includes(emp.department_id))
      );
      const isOnLeaveDay = leaves.some((l) => l.from_date <= dateStr && l.to_date >= dateStr);
      const computedStatus = noPunchStatus({ isHoliday: isHolidayDay, isWeekend: isWeekendDay, isOnLeave: isOnLeaveDay });

      if (existing) {
        // A manually-approved correction (is_regularized) on a no-punch day must not
        // be silently overwritten by reprocessing — skip status recompute entirely.
        if (existing.is_auto_generated && !existing.is_regularized && existing.status !== computedStatus) {
          updates.push({ id: existing.id, fields: { status: computedStatus, shift_id: shiftForDay?.id ?? null, processed_at: nowISO } });
          recordsUpdated++;
        }
        if (existing.is_auto_generated && !existing.is_regularized && computedStatus === "absent") {
          exceptionsForExisting.push({
            attendance_id: existing.id, employee_id: emp.id, date: dateStr,
            exception_type: "auto_marked_absent",
            description: `Auto-marked absent for ${dateStr} (no punch recorded)`,
          });
        }
        continue;
      }

      inserts.push({
        workspace_id: workspaceId, employee_id: emp.id, date: dateStr, status: computedStatus,
        shift_id: shiftForDay?.id ?? null, work_mode: "office", source: "system",
        is_auto_generated: true, processed_at: nowISO,
        late_minutes: 0, overtime_minutes: 0, early_leave_minutes: 0, work_minutes: 0, total_break_minutes: 0,
      });
      recordsCreated++;
      if (computedStatus === "absent") insertExceptionIdx.push(inserts.length - 1);
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates.map((u) => admin.from("hr_attendance").update(u.fields).eq("id", u.id)));
  }

  let insertedRows: { id: string; employee_id: string; date: string }[] = [];
  if (inserts.length > 0) {
    const { data, error } = await admin.from("hr_attendance").insert(inserts).select("id, employee_id, date");
    if (error) throw new Error(error.message);
    insertedRows = data ?? [];
  }

  const exceptionsToWrite = [...exceptionsForExisting];
  for (const idx of insertExceptionIdx) {
    const ins = inserts[idx];
    const row = insertedRows.find((r) => r.employee_id === ins.employee_id && r.date === ins.date);
    if (row) {
      exceptionsToWrite.push({
        attendance_id: row.id, employee_id: ins.employee_id as string, date: ins.date as string,
        exception_type: "auto_marked_absent",
        description: `Auto-marked absent for ${ins.date} (no punch recorded)`,
      });
    }
  }

  let exceptionsCreated = 0;
  if (exceptionsToWrite.length > 0) {
    const rows = exceptionsToWrite.map((e) => ({ ...e, workspace_id: workspaceId, status: "open" }));
    const { data, error } = await admin
      .from("hr_attendance_exceptions")
      .upsert(rows, { onConflict: "attendance_id,exception_type", ignoreDuplicates: true })
      .select("id");
    if (!error) exceptionsCreated = data?.length ?? 0;
  }

  const summary: ProcessingSummary = {
    from_date: fromDate,
    to_date: toDate,
    dates_processed: dates.length,
    employees_processed: employees.length,
    records_created: recordsCreated,
    records_updated: recordsUpdated,
    exceptions_created: exceptionsCreated,
    skipped_future_dates: skippedFutureDates,
  };

  await writeAuditLog(admin, workspaceId, {
    entity_type: "attendance_processing",
    action: "process",
    description: `Processed attendance for ${fromDate} to ${toDate} (${employees.length} employees): ${recordsCreated} created, ${recordsUpdated} updated, ${exceptionsCreated} exceptions`,
    changes: summary as unknown as Record<string, unknown>,
    performed_by: triggeredBy,
  });

  return summary;
}
