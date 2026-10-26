import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, getDefaultShift, dayOfWeek, noPunchStatus, type Shift } from "../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const employeeIdParam = request.nextUrl.searchParams.get("employee_id");

  let employeeId = ctx.employeeId;
  let departmentId = ctx.departmentId;

  if (employeeIdParam && employeeIdParam !== ctx.employeeId) {
    if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: emp } = await admin
      .from("hr_employees")
      .select("id, department_id")
      .eq("id", employeeIdParam)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    employeeId = emp.id;
    departmentId = emp.department_id;
  }

  if (!employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });

  const nowIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  const year = Number(request.nextUrl.searchParams.get("year")) || Number(nowIST[0]);
  const month = Number(request.nextUrl.searchParams.get("month")) || Number(nowIST[1]);

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [attendanceRes, holidaysRes, leavesRes, assignmentsRes, defaultShift] = await Promise.all([
    admin.from("hr_attendance").select("*").eq("workspace_id", ctx.workspaceId).eq("employee_id", employeeId).gte("date", monthStart).lte("date", monthEnd),
    admin.from("hr_holidays").select("date, name, department_ids").eq("workspace_id", ctx.workspaceId).gte("date", monthStart).lte("date", monthEnd),
    admin.from("hr_leave_applications").select("from_date, to_date").eq("workspace_id", ctx.workspaceId).eq("employee_id", employeeId).eq("status", "approved").lte("from_date", monthEnd).gte("to_date", monthStart),
    admin.from("hr_shift_assignments").select("effective_from, effective_to, hr_shifts(*)").eq("workspace_id", ctx.workspaceId).eq("employee_id", employeeId).lte("effective_from", monthEnd).or(`effective_to.is.null,effective_to.gte.${monthStart}`).order("effective_from", { ascending: true }),
    getDefaultShift(admin, ctx.workspaceId),
  ]);

  const attendanceByDate = new Map((attendanceRes.data ?? []).map((a) => [a.date, a]));

  const holidaysByDate = new Map<string, { name: string; department_ids: string[] | null }[]>();
  for (const h of holidaysRes.data ?? []) {
    const list = holidaysByDate.get(h.date) ?? [];
    list.push({ name: h.name, department_ids: h.department_ids });
    holidaysByDate.set(h.date, list);
  }

  const leaves = leavesRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (assignmentsRes.data ?? []) as any[];

  function resolveShift(dateStr: string): Shift | null {
    const match = assignments.find(
      (a) => a.effective_from <= dateStr && (!a.effective_to || a.effective_to >= dateStr)
    );
    return (match?.hr_shifts as Shift) ?? defaultShift;
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month)}-${pad(d)}`;
    const attendance = attendanceByDate.get(dateStr);
    const shift = resolveShift(dateStr);
    const isWeekendDay = !shift ? false : !shift.working_days.includes(dayOfWeek(dateStr));
    const holidaysToday = holidaysByDate.get(dateStr) ?? [];
    const isHolidayDay = holidaysToday.some(
      (h) => !h.department_ids?.length || (!!departmentId && h.department_ids.includes(departmentId))
    );
    const onLeave = leaves.some((l) => l.from_date <= dateStr && l.to_date >= dateStr);

    const status = attendance?.status ?? noPunchStatus({ isHoliday: isHolidayDay, isWeekend: isWeekendDay, isOnLeave: onLeave });

    days.push({
      date: dateStr,
      status,
      check_in: attendance?.check_in ?? null,
      check_out: attendance?.check_out ?? null,
      work_minutes: attendance?.work_minutes ?? 0,
      late_minutes: attendance?.late_minutes ?? 0,
      overtime_minutes: attendance?.overtime_minutes ?? 0,
      total_break_minutes: attendance?.total_break_minutes ?? 0,
      is_holiday: isHolidayDay,
      holiday_name: holidaysToday[0]?.name ?? null,
      is_weekend: isWeekendDay,
      shift: shift ? { id: shift.id, name: shift.name, code: shift.code } : null,
    });
  }

  return NextResponse.json({ employee_id: employeeId, year, month, days });
}
