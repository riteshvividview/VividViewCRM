import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";
import { computeMonthlyReports, type EmployeeMonthlyReport } from "../_lib/reports";

const TREND_STATUSES = ["present", "late", "half_day", "absent", "on_leave", "work_from_home", "holiday", "weekend"] as const;
const COMPLIANCE_STATUSES = new Set(["late", "half_day", "absent"]);
const MAX_COMPLIANCE_RECORDS = 1000;
const MAX_LATECOMERS = 10;

/**
 * Role-aware monthly attendance analytics for the HR Attendance Dashboard,
 * Team Attendance Dashboard, and Attendance/Compliance reports:
 * HR/super_admin get a workspace-wide view (optionally filtered by department),
 * team_lead get a view scoped to themselves + their direct reports.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const nowIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  const year = Number(request.nextUrl.searchParams.get("year")) || Number(nowIST[0]);
  const month = Number(request.nextUrl.searchParams.get("month")) || Number(nowIST[1]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  let scope: "workspace" | "team";
  let employeeIds: string[] | undefined;
  let departmentId: string | undefined;

  if (isHR(ctx.role)) {
    scope = "workspace";
    departmentId = request.nextUrl.searchParams.get("department_id") || undefined;
  } else if (ctx.role === "team_lead") {
    scope = "team";
    if (!ctx.employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });
    const { data: reports } = await admin
      .from("hr_employees")
      .select("id")
      .eq("reporting_manager_id", ctx.employeeId)
      .eq("workspace_id", ctx.workspaceId);
    employeeIds = [ctx.employeeId, ...((reports ?? []).map((r) => r.id))];
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reports = await computeMonthlyReports(admin, ctx.workspaceId, year, month, { departmentId, employeeIds });

  // Daily trend: sum status counts across all in-scope employees, per date.
  const trendByDate = new Map<string, Record<string, number>>();
  for (const r of reports) {
    for (const [date, day] of Object.entries(r.daily)) {
      const bucket = trendByDate.get(date) ?? Object.fromEntries(TREND_STATUSES.map((s) => [s, 0]));
      if (day.status in bucket) bucket[day.status]++;
      trendByDate.set(date, bucket);
    }
  }
  const daily_trend = Array.from(trendByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // Department breakdown (HR scope only).
  let department_breakdown: Array<{ department_id: string | null; department_name: string; employee_count: number; attendance_percentage: number }> = [];
  if (scope === "workspace") {
    const byDept = new Map<string, { name: string; employees: number; present: number; working: number }>();
    for (const r of reports) {
      const key = r.employee.department?.id ?? "none";
      const name = r.employee.department?.name || "Unassigned";
      const entry = byDept.get(key) ?? { name, employees: 0, present: 0, working: 0 };
      entry.employees++;
      entry.present += r.present_days;
      entry.working += r.working_days;
      byDept.set(key, entry);
    }
    department_breakdown = Array.from(byDept.entries()).map(([id, d]) => ({
      department_id: id === "none" ? null : id,
      department_name: d.name,
      employee_count: d.employees,
      attendance_percentage: d.working > 0 ? Math.round((d.present / d.working) * 1000) / 10 : 0,
    })).sort((a, b) => a.department_name.localeCompare(b.department_name));
  }

  // Top latecomers, by total late minutes this month.
  const top_latecomers = reports
    .filter((r) => r.total_late_minutes > 0)
    .sort((a, b) => b.total_late_minutes - a.total_late_minutes)
    .slice(0, MAX_LATECOMERS)
    .map((r) => ({ employee: r.employee, late_count: r.counts.late ?? 0, total_late_minutes: r.total_late_minutes }));

  // Compliance records: every late / half-day / absent day, with regularization status.
  const compliance_records: Array<{
    employee: EmployeeMonthlyReport["employee"];
    date: string;
    status: string;
    late_minutes: number;
    is_regularized: boolean;
  }> = [];
  for (const r of reports) {
    for (const [date, day] of Object.entries(r.daily)) {
      if (!COMPLIANCE_STATUSES.has(day.status)) continue;
      compliance_records.push({ employee: r.employee, date, status: day.status, late_minutes: day.late_minutes, is_regularized: day.is_regularized });
    }
  }
  compliance_records.sort((a, b) => b.date.localeCompare(a.date));

  // Summary totals.
  const summary = {
    employee_count: reports.length,
    avg_attendance_percentage: reports.length > 0 ? Math.round((reports.reduce((sum, r) => sum + r.attendance_percentage, 0) / reports.length) * 10) / 10 : 0,
    total_present: reports.reduce((sum, r) => sum + (r.counts.present ?? 0), 0),
    total_late: reports.reduce((sum, r) => sum + (r.counts.late ?? 0), 0),
    total_half_day: reports.reduce((sum, r) => sum + (r.counts.half_day ?? 0), 0),
    total_absent: reports.reduce((sum, r) => sum + (r.counts.absent ?? 0), 0),
    total_on_leave: reports.reduce((sum, r) => sum + (r.counts.on_leave ?? 0), 0),
    total_work_from_home: reports.reduce((sum, r) => sum + (r.counts.work_from_home ?? 0), 0),
    total_late_minutes: reports.reduce((sum, r) => sum + r.total_late_minutes, 0),
    total_overtime_minutes: reports.reduce((sum, r) => sum + r.total_overtime_minutes, 0),
  };

  return NextResponse.json({
    year, month, scope,
    summary,
    daily_trend,
    department_breakdown,
    top_latecomers,
    reports: reports.map((r) => ({
      employee: r.employee,
      counts: r.counts,
      working_days: r.working_days,
      present_days: r.present_days,
      attendance_percentage: r.attendance_percentage,
      total_work_minutes: r.total_work_minutes,
      total_overtime_minutes: r.total_overtime_minutes,
      total_late_minutes: r.total_late_minutes,
    })),
    compliance_records: compliance_records.slice(0, MAX_COMPLIANCE_RECORDS),
  });
}
