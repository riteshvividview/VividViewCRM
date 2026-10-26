import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isMonthClosed, isValidDateString, istToday, isoToISTTime, writeAuditLog } from "../_lib/helpers";
import { notifyHR } from "../_lib/notifications";

const CORRECTABLE_FIELDS = ["check_in", "check_out", "status", "work_mode"] as const;
const VALID_STATUSES = ["present", "late", "half_day", "work_from_home", "on_leave", "holiday", "weekend", "absent"];
const VALID_WORK_MODES = ["office", "work_from_home"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Role-aware list of attendance correction requests: own (employee),
 *  own + direct reports (team_lead), or all (HR/super_admin). */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const statusFilter = request.nextUrl.searchParams.get("status") ?? "pending";
  const employeeIdFilter = request.nextUrl.searchParams.get("employee_id");

  let query = admin
    .from("hr_attendance_corrections")
    .select("*, hr_employees(employee_code, designation, profiles(full_name, avatar_url))")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") query = query.eq("status", statusFilter);

  if (isHR(ctx.role)) {
    if (employeeIdFilter) query = query.eq("employee_id", employeeIdFilter);
  } else if (ctx.role === "team_lead") {
    if (!ctx.employeeId) return NextResponse.json({ corrections: [] });
    const { data: reports } = await admin
      .from("hr_employees")
      .select("id")
      .eq("reporting_manager_id", ctx.employeeId)
      .eq("workspace_id", ctx.workspaceId);
    const teamIds = [ctx.employeeId, ...((reports ?? []).map((r) => r.id))];
    query = query.in("employee_id", teamIds);
  } else {
    if (!ctx.employeeId) return NextResponse.json({ corrections: [] });
    query = query.eq("employee_id", ctx.employeeId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ corrections: data ?? [] });
}

/** Employee self-service: request a correction for own attendance on a past/today date. */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });

  const body = await request.json();
  const date: string = body.date ?? "";
  const field: string = body.field ?? "";
  const requestedValue: string = (body.requested_value ?? "").toString().trim();
  const reason: string = (body.reason ?? "").toString().trim();

  if (!isValidDateString(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (date > istToday()) return NextResponse.json({ error: "Cannot request a correction for a future date" }, { status: 400 });
  if (!CORRECTABLE_FIELDS.includes(field as typeof CORRECTABLE_FIELDS[number])) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 });

  if ((field === "check_in" || field === "check_out") && !TIME_RE.test(requestedValue)) {
    return NextResponse.json({ error: "Time must be in HH:MM (24-hour) format" }, { status: 400 });
  }
  if (field === "status" && !VALID_STATUSES.includes(requestedValue)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }
  if (field === "work_mode" && !VALID_WORK_MODES.includes(requestedValue)) {
    return NextResponse.json({ error: "Invalid work mode value" }, { status: 400 });
  }

  const admin = adminClient();

  if (await isMonthClosed(admin, ctx.workspaceId, date)) {
    return NextResponse.json({ error: "This month has been closed for payroll processing. Contact HR to reopen it before requesting corrections." }, { status: 409 });
  }

  const { data: existing } = await admin
    .from("hr_attendance")
    .select("id, check_in, check_out, status, work_mode")
    .eq("employee_id", ctx.employeeId)
    .eq("date", date)
    .maybeSingle();

  const { data: dup } = await admin
    .from("hr_attendance_corrections")
    .select("id")
    .eq("employee_id", ctx.employeeId)
    .eq("date", date)
    .eq("field", field)
    .eq("status", "pending")
    .maybeSingle();
  if (dup) return NextResponse.json({ error: "A correction request for this field and date is already pending" }, { status: 409 });

  let oldValue: string | null = null;
  if (existing) {
    if (field === "check_in") oldValue = existing.check_in ? isoToISTTime(existing.check_in) : null;
    else if (field === "check_out") oldValue = existing.check_out ? isoToISTTime(existing.check_out) : null;
    else if (field === "status") oldValue = existing.status ?? null;
    else if (field === "work_mode") oldValue = existing.work_mode ?? null;
  }

  if (oldValue === requestedValue) {
    return NextResponse.json({ error: "Requested value is the same as the current value" }, { status: 400 });
  }

  const { data: correction, error } = await admin
    .from("hr_attendance_corrections")
    .insert({
      workspace_id: ctx.workspaceId,
      employee_id: ctx.employeeId,
      attendance_id: existing?.id ?? null,
      date,
      field,
      old_value: oldValue,
      new_value: requestedValue,
      reason,
      status: "pending",
      requested_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "attendance_correction",
    entity_id: correction.id,
    action: "requested",
    description: `Requested correction of ${field} for ${date} (${oldValue ?? "—"} → ${requestedValue})`,
    changes: { field, old_value: oldValue, new_value: requestedValue, reason },
    performed_by: ctx.userId,
  });

  const { data: requester } = await admin
    .from("hr_employees")
    .select("employee_code, profiles(full_name)")
    .eq("id", ctx.employeeId)
    .maybeSingle();
  const requesterName = (requester?.profiles as unknown as { full_name: string } | null)?.full_name ?? requester?.employee_code ?? "An employee";

  await notifyHR(admin, ctx.workspaceId, {
    type: "attendance_correction_request",
    title: "New attendance correction request",
    body: `${requesterName} requested a correction to ${field.replace(/_/g, " ")} for ${date}.`,
    entity_type: "attendance_correction",
    entity_id: correction.id,
  });

  return NextResponse.json({ correction });
}
