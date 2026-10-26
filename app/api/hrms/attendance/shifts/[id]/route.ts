import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../_lib/helpers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const admin = adminClient();

  const { data: existing } = await admin.from("hr_shifts").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  if (body.is_default === true) {
    await admin.from("hr_shifts").update({ is_default: false }).eq("workspace_id", ctx.workspaceId).eq("is_default", true);
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "name", "start_time", "end_time", "is_night_shift", "is_flexible", "flexible_hours_per_day",
    "working_days", "break_minutes", "grace_period_minutes", "half_day_threshold_minutes",
    "full_day_threshold_minutes", "overtime_threshold_minutes", "is_default", "status",
  ]) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data, error } = await admin.from("hr_shifts").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ shift: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = adminClient();

  const { data: shift } = await admin.from("hr_shifts").select("is_default").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (shift.is_default) return NextResponse.json({ error: "Cannot deactivate the default shift" }, { status: 400 });

  const { count } = await admin
    .from("hr_shift_assignments")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", id)
    .or("effective_to.is.null");

  if (count && count > 0) {
    return NextResponse.json({ error: "Shift has active employee assignments — reassign them first" }, { status: 400 });
  }

  const { error } = await admin.from("hr_shifts").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
