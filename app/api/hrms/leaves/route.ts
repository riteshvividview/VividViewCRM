import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isValidDateString, isMonthClosed } from "../attendance/_lib/helpers";
import { notifyHR, notifyUsers } from "../attendance/_lib/notifications";
import { PENDING_STATUSES, adjustBalance, countLeaveDays, markAttendanceOnLeave } from "./_lib";

/**
 * Apply for leave. Employees apply for themselves; HR may apply on behalf of anyone.
 * Status, day count and balance checks are decided here, never by the browser.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hr = isHR(ctx.role);
  const admin = adminClient();

  const body = await request.json().catch(() => ({}));
  const employeeId: string | null = hr && body.employee_id ? body.employee_id : ctx.employeeId;
  if (!employeeId) return NextResponse.json({ error: "Your account is not linked to an employee record. Ask HR to add you." }, { status: 400 });

  const from: string = body.from_date ?? "";
  const isHalfDay = !!body.is_half_day;
  const to: string = isHalfDay ? from : body.to_date || from;
  if (!isValidDateString(from) || !isValidDateString(to)) return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  if (to < from) return NextResponse.json({ error: "End date is before start date" }, { status: 400 });
  if (await isMonthClosed(admin, ctx.workspaceId, from)) {
    return NextResponse.json({ error: "Attendance for that month is closed. Contact HR." }, { status: 409 });
  }

  const [{ data: employee }, { data: leaveType }] = await Promise.all([
    admin.from("hr_employees").select("id, user_id, reporting_manager_id, status, profiles(full_name)")
      .eq("id", employeeId).eq("workspace_id", ctx.workspaceId).maybeSingle(),
    admin.from("hr_leave_types").select("*").eq("id", body.leave_type_id ?? "").eq("workspace_id", ctx.workspaceId).maybeSingle(),
  ]);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!leaveType) return NextResponse.json({ error: "Select a valid leave type" }, { status: 400 });

  if (leaveType.max_consecutive_days && !isHalfDay) {
    const span = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
    if (span > Number(leaveType.max_consecutive_days)) {
      return NextResponse.json({ error: `${leaveType.name} allows at most ${leaveType.max_consecutive_days} consecutive days` }, { status: 400 });
    }
  }
  if (!hr && leaveType.min_advance_notice_days) {
    const notice = (new Date(from).getTime() - Date.now()) / 86400000;
    if (notice < Number(leaveType.min_advance_notice_days) - 1) {
      return NextResponse.json({ error: `${leaveType.name} must be applied ${leaveType.min_advance_notice_days} day(s) in advance` }, { status: 400 });
    }
  }

  const { days, dates } = await countLeaveDays(admin, ctx.workspaceId, leaveType, from, to, isHalfDay);
  if (days <= 0) return NextResponse.json({ error: "The selected dates are all weekends or holidays" }, { status: 400 });

  // No overlapping active request
  const { data: overlap } = await admin.from("hr_leave_applications").select("id")
    .eq("employee_id", employeeId).in("status", [...PENDING_STATUSES, "approved"])
    .lte("from_date", to).gte("to_date", from).limit(1);
  if (overlap?.length) return NextResponse.json({ error: "You already have leave applied for some of these dates" }, { status: 409 });

  const year = Number(from.slice(0, 4));
  const { data: balance } = await admin.from("hr_leave_balances").select("total_days, used_days, pending_days, carried_forward_days")
    .eq("employee_id", employeeId).eq("leave_type_id", leaveType.id).eq("year", year).maybeSingle();
  if (balance && !leaveType.allow_negative_balance) {
    const available = Number(balance.total_days ?? 0) + Number(balance.carried_forward_days ?? 0)
      - Number(balance.used_days ?? 0) - Number(balance.pending_days ?? 0);
    if (days > available) {
      return NextResponse.json({ error: `Insufficient balance: ${available} day(s) available` }, { status: 400 });
    }
  }

  // approval_levels: none | l1_only (manager) | l1_and_l2 (manager → HR) | l2_only (HR)
  const levels: string = leaveType.approval_levels ?? (leaveType.requires_approval ? "l1_only" : "none");
  const autoApprove = levels === "none" || !leaveType.requires_approval || (hr && body.employee_id && body.employee_id !== ctx.employeeId);
  const pendingStatus = levels === "l2_only" || !employee.reporting_manager_id ? "pending_l2" : "pending_l1";
  const now = new Date().toISOString();
  const { data: app, error } = await admin.from("hr_leave_applications").insert({
    workspace_id: ctx.workspaceId,
    employee_id: employeeId,
    leave_type_id: leaveType.id,
    from_date: from,
    to_date: to,
    days_count: days,
    is_half_day: isHalfDay,
    half_day_date: isHalfDay ? from : null,
    half_day_session: isHalfDay ? body.half_day_session ?? null : null,
    reason: typeof body.reason === "string" ? body.reason.trim() || null : null,
    notify_team_members: !!body.notify_team_members,
    status: autoApprove ? "approved" : pendingStatus,
    approved_by: autoApprove ? ctx.userId : null,
    approved_at: autoApprove ? now : null,
  }).select("id, status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (autoApprove) {
    await adjustBalance(admin, employeeId, leaveType.id, year, { used: days });
    await markAttendanceOnLeave(admin, ctx.workspaceId, employeeId, dates);
  } else {
    await adjustBalance(admin, employeeId, leaveType.id, year, { pending: days });
    const name = (Array.isArray(employee.profiles) ? employee.profiles[0] : employee.profiles)?.full_name ?? "An employee";
    const notice = {
      type: "leave_request" as const,
      title: "Leave request",
      body: `${name} applied for ${days} day(s) of ${leaveType.name} (${from}${to !== from ? ` → ${to}` : ""})`,
      entity_type: "leave_application",
      entity_id: app.id,
    };
    if (pendingStatus === "pending_l1" && employee.reporting_manager_id) {
      const { data: mgr } = await admin.from("hr_employees").select("user_id").eq("id", employee.reporting_manager_id).maybeSingle();
      await notifyUsers(admin, ctx.workspaceId, [mgr?.user_id], notice).catch(() => {});
    }
    if (pendingStatus === "pending_l2" || levels === "l1_only") await notifyHR(admin, ctx.workspaceId, notice).catch(() => {});
  }

  return NextResponse.json({ application: app, days });
}
