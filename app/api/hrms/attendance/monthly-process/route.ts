import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, istToday, writeAuditLog } from "../_lib/helpers";
import { runAttendanceProcessing } from "../_lib/automation";
import { computeMonthlyReports } from "../_lib/reports";
import { notifyHR } from "../_lib/notifications";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(daysInMonth)}` };
}

function parseYearMonth(yearParam: string | null, monthParam: string | null) {
  const today = istToday().split("-").map(Number);
  const year = Number(yearParam) || today[0];
  const month = Number(monthParam) || today[1];
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

async function buildSummary(admin: ReturnType<typeof adminClient>, workspaceId: string, year: number, month: number) {
  const reports = await computeMonthlyReports(admin, workspaceId, year, month);
  return {
    employee_count: reports.length,
    total_present: reports.reduce((s, r) => s + (r.counts.present ?? 0), 0),
    total_late: reports.reduce((s, r) => s + (r.counts.late ?? 0), 0),
    total_half_day: reports.reduce((s, r) => s + (r.counts.half_day ?? 0), 0),
    total_absent: reports.reduce((s, r) => s + (r.counts.absent ?? 0), 0),
    total_on_leave: reports.reduce((s, r) => s + (r.counts.on_leave ?? 0), 0),
    total_unpaid_leave: reports.reduce((s, r) => s + r.unpaid_leave_days, 0),
    total_work_from_home: reports.reduce((s, r) => s + (r.counts.work_from_home ?? 0), 0),
    total_overtime_minutes: reports.reduce((s, r) => s + r.total_overtime_minutes, 0),
    total_late_minutes: reports.reduce((s, r) => s + r.total_late_minutes, 0),
    avg_attendance_percentage: reports.length > 0 ? Math.round((reports.reduce((s, r) => s + r.attendance_percentage, 0) / reports.length) * 10) / 10 : 0,
  };
}

/** Status + preview for a given month: whether it's closed, and an aggregate summary for HR review. */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ym = parseYearMonth(request.nextUrl.searchParams.get("year"), request.nextUrl.searchParams.get("month"));
  if (!ym) return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  const { year, month } = ym;

  const admin = adminClient();
  const { end } = monthBounds(year, month);
  const today = istToday();

  const { data: closure } = await admin
    .from("hr_attendance_monthly_closures")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  const preview = await buildSummary(admin, ctx.workspaceId, year, month);

  return NextResponse.json({
    year, month,
    is_elapsed: end < today,
    closure: closure ?? null,
    preview,
  });
}

/** Closes (locks) or reopens a month for payroll processing. HR/super_admin only. */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const ym = parseYearMonth(String(body.year ?? ""), String(body.month ?? ""));
  if (!ym) return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  const { year, month } = ym;
  const action: string = body.action ?? "";
  if (!["close", "reopen"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const admin = adminClient();
  const { start, end } = monthBounds(year, month);
  const today = istToday();
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const nowISO = new Date().toISOString();

  const { data: existing } = await admin
    .from("hr_attendance_monthly_closures")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (action === "close") {
    if (existing?.status === "closed") return NextResponse.json({ error: "This month is already closed" }, { status: 400 });
    if (end >= today) return NextResponse.json({ error: "Cannot close a month that hasn't fully elapsed yet" }, { status: 400 });

    try {
      await runAttendanceProcessing(admin, ctx.workspaceId, start, end, ctx.userId);
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const summary = await buildSummary(admin, ctx.workspaceId, year, month);

    const { data: closure, error } = await admin
      .from("hr_attendance_monthly_closures")
      .upsert({
        workspace_id: ctx.workspaceId, year, month, status: "closed",
        summary, processed_by: ctx.userId, processed_at: nowISO,
        reopened_by: null, reopened_at: null, updated_at: nowISO,
      }, { onConflict: "workspace_id,year,month" })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog(admin, ctx.workspaceId, {
      entity_type: "attendance_monthly_processing", entity_id: closure.id, action: "closed",
      description: `Closed attendance for ${monthLabel} (${summary.employee_count} employees) — ready for payroll export`,
      changes: summary,
      performed_by: ctx.userId,
    });

    await notifyHR(admin, ctx.workspaceId, {
      type: "attendance_monthly_processed",
      title: `Attendance closed for ${monthLabel}`,
      body: `Monthly attendance processing completed for ${summary.employee_count} employees. Payroll data is now ready for export.`,
      entity_type: "attendance_monthly_processing",
      entity_id: closure.id,
    });

    return NextResponse.json({ closure });
  }

  // reopen
  if (!existing || existing.status !== "closed") return NextResponse.json({ error: "This month is not closed" }, { status: 400 });

  const { data: closure, error } = await admin
    .from("hr_attendance_monthly_closures")
    .update({ status: "open", reopened_by: ctx.userId, reopened_at: nowISO, updated_at: nowISO })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "attendance_monthly_processing", entity_id: closure.id, action: "reopened",
    description: `Reopened attendance for ${monthLabel}`,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ closure });
}
