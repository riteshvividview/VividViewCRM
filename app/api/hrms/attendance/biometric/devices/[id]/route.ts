import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../../_lib/helpers";
import { writeAuditLog } from "../../_lib/sync-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const admin = adminClient();

  const { data: existing } = await admin.from("hr_biometric_devices").select("*").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.device_name === "string" && body.device_name.trim()) update.device_name = body.device_name.trim();
  for (const key of ["device_model", "serial_number", "ip_address", "location", "notes"] as const) {
    if (body[key] !== undefined) update[key] = body[key]?.trim?.() || null;
  }
  if (body.port !== undefined) update.port = body.port ? Number(body.port) : null;
  if (body.sync_interval_minutes !== undefined) update.sync_interval_minutes = Number(body.sync_interval_minutes) || 30;
  if (["active", "inactive", "maintenance"].includes(body.status)) update.status = body.status;

  const { data, error } = await admin.from("hr_biometric_devices").update(update).eq("id", id).select("*").single();
  if (error) {
    const msg = error.message.includes("duplicate") ? "A device with this serial number already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "biometric_device",
    entity_id: id,
    action: "update",
    description: `Updated device "${data.device_name}"`,
    changes: { before: existing, after: data },
    performed_by: ctx.userId,
  });

  return NextResponse.json({ device: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = adminClient();

  const { data: device } = await admin.from("hr_biometric_devices").select("*").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const { error } = await admin.from("hr_biometric_devices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "biometric_device",
    entity_id: id,
    action: "delete",
    description: `Removed device "${device.device_name}"`,
    changes: device,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ success: true });
}
