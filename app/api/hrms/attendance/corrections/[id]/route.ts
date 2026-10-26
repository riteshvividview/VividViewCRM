import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isMonthClosed, istDateTimeToISO, writeAuditLog } from "../../_lib/helpers";
import { runAttendanceProcessing } from "../../_lib/automation";
import { notifyUsers } from "../../_lib/notifications";

/** Requester cancels their own pending request, or HR approves/rejects it. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action: string = body.action ?? "";
  if (!["approve", "reject", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: correction, error: fetchError } = await admin
    .from("hr_attendance_corrections")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  if (!correction) return NextResponse.json({ error: "Correction request not found" }, { status: 404 });
  if (correction.status !== "pending") return NextResponse.json({ error: "This request has already been reviewed" }, { status: 400 });

  const nowISO = new Date().toISOString();

  if (action === "cancel") {
    if (correction.requested_by !== ctx.userId && !isHR(ctx.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data, error } = await admin
      .from("hr_attendance_corrections")
      .update({ status: "cancelled", updated_at: nowISO })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog(admin, ctx.workspaceId, {
      entity_type: "attendance_correction", entity_id: id, action: "cancelled",
      description: `Cancelled correction of ${correction.field} for ${correction.date}`,
      performed_by: ctx.userId,
    });
    return NextResponse.json({ correction: data });
  }

  // approve / reject — HR only
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const reviewNote: string | null = body.review_note ?? null;

  const { data: requesterEmp } = await admin
    .from("hr_employees")
    .select("user_id")
    .eq("id", correction.employee_id)
    .maybeSingle();

  if (action === "reject") {
    const { data, error } = await admin
      .from("hr_attendance_corrections")
      .update({ status: "rejected", reviewed_by: ctx.userId, reviewed_at: nowISO, review_note: reviewNote, updated_at: nowISO })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog(admin, ctx.workspaceId, {
      entity_type: "attendance_correction", entity_id: id, action: "rejected",
      description: `Rejected correction of ${correction.field} for ${correction.date}`,
      changes: { field: correction.field, old_value: correction.old_value, new_value: correction.new_value, note: reviewNote },
      performed_by: ctx.userId,
    });

    await notifyUsers(admin, ctx.workspaceId, [requesterEmp?.user_id], {
      type: "attendance_correction_decision",
      title: "Attendance correction rejected",
      body: `Your request to update ${correction.field.replace(/_/g, " ")} for ${correction.date} was rejected${reviewNote ? `: ${reviewNote}` : "."}`,
      entity_type: "attendance_correction",
      entity_id: id,
    });

    return NextResponse.json({ correction: data });
  }

  // action === "approve"
  if (await isMonthClosed(admin, ctx.workspaceId, correction.date)) {
    return NextResponse.json({ error: "This month has been closed for payroll processing. Reopen it before approving corrections." }, { status: 409 });
  }

  let attendanceId = correction.attendance_id as string | null;
  const isPunchField = correction.field === "check_in" || correction.field === "check_out";

  if (attendanceId) {
    const fields: Record<string, unknown> = { updated_at: nowISO };
    fields[correction.field] = isPunchField
      ? istDateTimeToISO(correction.date, correction.new_value)
      : correction.new_value;
    const { error: updErr } = await admin.from("hr_attendance").update(fields).eq("id", attendanceId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  } else {
    const insertFields: Record<string, unknown> = {
      workspace_id: ctx.workspaceId, employee_id: correction.employee_id, date: correction.date,
      status: "absent", work_mode: "office", source: "manual", is_auto_generated: false,
    };
    insertFields[correction.field] = isPunchField
      ? istDateTimeToISO(correction.date, correction.new_value)
      : correction.new_value;
    const { data: inserted, error: insErr } = await admin.from("hr_attendance").insert(insertFields).select("id").single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    attendanceId = inserted.id;
  }

  // Recompute status/late/work minutes from the corrected punch before locking the
  // record — reprocessing only recomputes while is_regularized is still false.
  if (isPunchField) {
    await runAttendanceProcessing(admin, ctx.workspaceId, correction.date, correction.date, ctx.userId, correction.employee_id);
  }

  await admin
    .from("hr_attendance")
    .update({ is_regularized: true, regularization_reason: correction.reason, updated_at: nowISO })
    .eq("id", attendanceId);

  const { data, error } = await admin
    .from("hr_attendance_corrections")
    .update({ status: "approved", reviewed_by: ctx.userId, reviewed_at: nowISO, review_note: reviewNote, attendance_id: attendanceId, updated_at: nowISO })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "attendance_correction", entity_id: id, action: "approved",
    description: `Approved correction of ${correction.field} for ${correction.date}: ${correction.old_value ?? "—"} → ${correction.new_value}`,
    changes: { field: correction.field, old_value: correction.old_value, new_value: correction.new_value, attendance_id: attendanceId, note: reviewNote },
    performed_by: ctx.userId,
  });

  await notifyUsers(admin, ctx.workspaceId, [requesterEmp?.user_id], {
    type: "attendance_correction_decision",
    title: "Attendance correction approved",
    body: `Your request to update ${correction.field.replace(/_/g, " ")} for ${correction.date} was approved.`,
    entity_type: "attendance_correction",
    entity_id: id,
  });

  return NextResponse.json({ correction: data });
}
