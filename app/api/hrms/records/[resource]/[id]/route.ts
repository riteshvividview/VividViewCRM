import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../../attendance/_lib/helpers";
import { RESOURCES } from "../../_config";
import { pickFields } from "../../_lib";

type Params = { params: Promise<{ resource: string; id: string }> };

async function load(resource: string, id: string) {
  const cfg = RESOURCES[resource];
  if (!cfg) return { error: NextResponse.json({ error: "Unknown resource" }, { status: 404 }) };
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = adminClient();
  const { data: existing } = await admin
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const ownerCols = ["employee_id", ...(cfg.extraOwnerColumns ?? [])];
  let isOwner = !!ctx.employeeId && ownerCols.some((c) => existing[c] === ctx.employeeId);
  // A review is written by its reviewer; the reviewee only writes their own self-review.
  if (resource === "reviews") {
    isOwner = !!ctx.employeeId && (existing.reviewer_employee_id === ctx.employeeId ||
      (existing.review_type === "self" && existing.employee_id === ctx.employeeId));
  }
  return { cfg, ctx, admin, existing, isOwner, hr: isHR(ctx.role) };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { resource, id } = await params;
  const r = await load(resource, id);
  if ("error" in r) return r.error;
  const { cfg, ctx, admin, existing, isOwner, hr } = r;

  const body = await request.json().catch(() => ({}));
  let update: Record<string, unknown>;

  if (hr) {
    update = pickFields(body, cfg.fields);
  } else {
    if (!isOwner || !cfg.ownerFields) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const gate = cfg.ownerEditableWhen;
    if (gate && !gate.values.includes(existing[gate.field])) {
      return NextResponse.json({ error: "This record can no longer be edited" }, { status: 409 });
    }
    update = pickFields(body, cfg.ownerFields);
    if ("status" in update && !(cfg.ownerStatuses ?? []).includes(String(update.status))) {
      delete update.status;
    }
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  // A decided comp-off is final (its days are already credited to the leave balance).
  if (resource === "comp-offs" && existing.status !== "pending" && "status" in update && update.status !== existing.status) {
    return NextResponse.json({ error: "This comp-off has already been decided" }, { status: 409 });
  }

  if (cfg.decisionStatuses && typeof update.status === "string" && cfg.decisionStatuses.includes(update.status)) {
    update.decided_by = ctx.userId;
    update.decided_at = new Date().toISOString();
  }
  if ("done" in update) update.done_at = update.done ? new Date().toISOString() : null;
  update.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from(cfg.table)
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select(cfg.select)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Side effects of decisions
  if (resource === "comp-offs" && update.status === "approved" && existing.status === "pending") {
    await creditCompOff(admin, ctx.workspaceId, existing.employee_id, Number(existing.days), String(existing.worked_date));
  }
  if (resource === "tax-declarations" && !hr && existing.status === "rejected") {
    // A corrected declaration goes back to HR for verification.
    await admin.from(cfg.table).update({ status: "submitted" }).eq("id", id);
  }
  return NextResponse.json({ record: data });
}

/** Adds approved comp-off days to the employee's "Compensatory Off" (CO) leave balance. */
async function creditCompOff(admin: ReturnType<typeof adminClient>, workspaceId: string, employeeId: string, days: number, workedDate: string) {
  let { data: type } = await admin.from("hr_leave_types").select("id").eq("workspace_id", workspaceId).eq("code", "CO").maybeSingle();
  if (!type) {
    const created = await admin.from("hr_leave_types").insert({
      workspace_id: workspaceId, name: "Compensatory Off", code: "CO", days_per_year: 0, is_paid: true,
      requires_approval: true, approval_levels: "l1_only", carry_forward_limit: 0,
    }).select("id").single();
    type = created.data;
  }
  if (!type) return;
  const year = Number(workedDate.slice(0, 4));
  const { data: bal } = await admin.from("hr_leave_balances").select("id, total_days")
    .eq("employee_id", employeeId).eq("leave_type_id", type.id).eq("year", year).maybeSingle();
  if (bal) {
    await admin.from("hr_leave_balances").update({ total_days: Number(bal.total_days ?? 0) + days, updated_at: new Date().toISOString() }).eq("id", bal.id);
  } else {
    await admin.from("hr_leave_balances").insert({
      workspace_id: workspaceId, employee_id: employeeId, leave_type_id: type.id, year,
      total_days: days, used_days: 0, pending_days: 0, carried_forward_days: 0,
    });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { resource, id } = await params;
  const r = await load(resource, id);
  if ("error" in r) return r.error;
  const { cfg, ctx, admin, existing, isOwner, hr } = r;

  const gate = cfg.ownerEditableWhen;
  const ownerMayDelete = isOwner && cfg.create === "any" && (!gate || gate.values.includes(existing[gate.field]));
  if (!hr && !ownerMayDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await admin.from(cfg.table).delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
