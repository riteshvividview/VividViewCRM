import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";
import { computeMonthlyReports } from "../_lib/reports";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Payroll Integration Readiness — per-employee monthly payable-days / loss-of-pay (LOP)
 * breakdown, ready to feed into an external payroll system. HR/super_admin only.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const departmentId = request.nextUrl.searchParams.get("department_id");

  const nowIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  const year = Number(request.nextUrl.searchParams.get("year")) || Number(nowIST[0]);
  const month = Number(request.nextUrl.searchParams.get("month")) || Number(nowIST[1]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const [reports, closureRes] = await Promise.all([
    computeMonthlyReports(admin, ctx.workspaceId, year, month, { departmentId: departmentId || undefined }),
    admin.from("hr_attendance_monthly_closures").select("status, processed_at").eq("workspace_id", ctx.workspaceId).eq("year", year).eq("month", month).maybeSingle(),
  ]);

  const rows = reports.map((r) => {
    const paidLeaveDays = (r.counts.on_leave ?? 0) - r.unpaid_leave_days;
    const lopDays = round1((r.counts.absent ?? 0) + r.unpaid_leave_days + (r.counts.half_day ?? 0) * 0.5);
    const payableDays = round1(r.working_days - lopDays);
    return {
      employee: r.employee,
      working_days: r.working_days,
      present_days: r.present_days,
      paid_leave_days: paidLeaveDays,
      unpaid_leave_days: r.unpaid_leave_days,
      half_day_count: r.counts.half_day ?? 0,
      late_count: r.counts.late ?? 0,
      lop_days: lopDays,
      payable_days: payableDays,
      overtime_hours: round1(r.total_overtime_minutes / 60),
      attendance_percentage: r.attendance_percentage,
    };
  });

  return NextResponse.json({
    year, month,
    closure_status: closureRes.data?.status ?? "not_processed",
    processed_at: closureRes.data?.processed_at ?? null,
    rows,
  });
}
