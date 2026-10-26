import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, istToday, writeAuditLog } from "../../attendance/_lib/helpers";
import { notifyUsers } from "../../attendance/_lib/notifications";
import { PENDING_STATUSES, adjustBalance, clearAttendanceOnLeave, countLeaveDays, markAttendanceOnLeave } from "../_lib";

type Params = { params: Promise<{ id: string }> };

/**
 * POST { action: "approve" | "reject" | "cancel", reason? }
 *  - approve/reject: HR (super_admin for HR-level applicants) or the applicant's reporting manager
 *  - cancel: the applicant (pending, or approved leave not yet started) or HR
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const { data: leave } = await admin.from("hr_leave_applications")
    .select("*, hr_leave_types(name, weekends_counted, holidays_counted, approval_levels), employee:hr_employees!employee_id(id, user_id, reporting_manager_id, profiles(role))")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!leave) return NextResponse.json({ error: "Leave application not found" }, { status: 404 });

  const emp = leave.employee as { id: string; user_id: string | null; reporting_manager_id: string | null; profiles: { role?: string } | { role?: string }[] | null };
  const applicantRole = (Array.isArray(emp.profiles) ? emp.profiles[0] : emp.profiles)?.role ?? "employee";
  const isOwn = !!ctx.employeeId && emp.id === ctx.employeeId;
  const isManager = !!ctx.employeeId && emp.reporting_manager_id === ctx.employeeId;
  const hr = isHR(ctx.role);
  const year = Number(String(leave.from_date).slice(0, 4));
  const days = Number(leave.days_count);
  const now = new Date().toISOString();

  if (action === "approve" || action === "reject") {
    if (!PENDING_STATUSES.includes(leave.status)) return NextResponse.json({ error: "This request has already been decided" }, { status: 409 });
    const applicantIsHR = applicantRole === "hr" || applicantRole === "super_admin";
    const hrCanDecide = ctx.role === "super_admin" || (hr && !applicantIsHR);
    // L1 (pending / pending_l1): reporting manager or HR. L2 (pending_l2): HR only.
    const atL2 = leave.status === "pending_l2";
    const allowed = !isOwn && (hrCanDecide || (!atL2 && isManager && !applicantIsHR));
    if (!allowed) return NextResponse.json({ error: atL2 ? "This request is awaiting HR approval" : "You are not allowed to decide this request" }, { status: 403 });
    if (action === "reject" && !reason) return NextResponse.json({ error: "A reason is required to reject" }, { status: 400 });

    // Manager approval on a two-level leave type forwards it to HR instead of finalising.
    const twoLevel = leave.hr_leave_types?.approval_levels === "l1_and_l2";
    if (action === "approve" && twoLevel && !atL2 && !hrCanDecide) {
      await admin.from("hr_leave_applications").update({ status: "pending_l2", approver_l1_id: ctx.userId, approver_l1_at: now, updated_at: now }).eq("id", id);
      const { notifyHR } = await import("../../attendance/_lib/notifications");
      await notifyHR(admin, ctx.workspaceId, {
        type: "leave_request", title: "Leave awaiting HR approval",
        body: `A ${leave.hr_leave_types?.name ?? "leave"} request (${leave.from_date} → ${leave.to_date}) was approved by the manager and needs HR approval`,
        entity_type: "leave_application", entity_id: id,
      }).catch(() => {});
      return NextResponse.json({ ok: true, status: "pending_l2" });
    }

    const level = atL2 ? { approver_l2_id: ctx.userId, approver_l2_at: now } : { approver_l1_id: ctx.userId, approver_l1_at: now };
    const update = action === "approve"
      ? { status: "approved", approved_by: ctx.userId, approved_at: now, ...level, updated_at: now }
      : { status: "rejected", rejection_reason: reason, ...(atL2 ? { l2_rejection_reason: reason } : { l1_rejection_reason: reason }), ...level, updated_at: now };
    const { error } = await admin.from("hr_leave_applications").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (action === "approve") {
      await adjustBalance(admin, emp.id, leave.leave_type_id, year, { pending: -days, used: days });
      const { dates } = await countLeaveDays(admin, ctx.workspaceId, leave.hr_leave_types ?? {}, leave.from_date, leave.to_date, leave.is_half_day);
      await markAttendanceOnLeave(admin, ctx.workspaceId, emp.id, dates);
    } else {
      await adjustBalance(admin, emp.id, leave.leave_type_id, year, { pending: -days });
    }

    await notifyUsers(admin, ctx.workspaceId, [emp.user_id], {
      type: "leave_decision",
      title: action === "approve" ? "Leave approved" : "Leave rejected",
      body: `Your ${leave.hr_leave_types?.name ?? "leave"} (${leave.from_date} → ${leave.to_date}) was ${action === "approve" ? "approved" : `rejected: ${reason}`}`,
      entity_type: "leave_application",
      entity_id: id,
    }).catch(() => {});
  } else if (action === "cancel") {
    const started = leave.from_date <= istToday();
    const ownCancellable = isOwn && (PENDING_STATUSES.includes(leave.status) || (leave.status === "approved" && !started));
    if (!hr && !ownCancellable) return NextResponse.json({ error: "This leave can no longer be cancelled" }, { status: 403 });
    if (!PENDING_STATUSES.includes(leave.status) && leave.status !== "approved") {
      return NextResponse.json({ error: "Only pending or approved leave can be cancelled" }, { status: 409 });
    }

    const { error } = await admin.from("hr_leave_applications").update({
      status: "cancelled", cancelled_by: ctx.userId, cancelled_at: now, cancel_reason: reason || null, updated_at: now,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (leave.status === "approved") {
      await adjustBalance(admin, emp.id, leave.leave_type_id, year, { used: -days });
      await clearAttendanceOnLeave(admin, emp.id, leave.from_date, leave.to_date);
    } else {
      await adjustBalance(admin, emp.id, leave.leave_type_id, year, { pending: -days });
    }
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "leave_application", entity_id: id, action, description: reason || null, performed_by: ctx.userId,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
