import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../_lib/helpers";
import { writeAuditLog } from "../_lib/sync-service";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("hr_biometric_devices")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ devices: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const deviceName: string = body.device_name?.trim() ?? "";
  if (!deviceName) return NextResponse.json({ error: "Device name is required" }, { status: 400 });

  const status = ["active", "inactive", "maintenance"].includes(body.status) ? body.status : "inactive";

  const admin = adminClient();
  const { data, error } = await admin
    .from("hr_biometric_devices")
    .insert({
      workspace_id: ctx.workspaceId,
      device_name: deviceName,
      device_model: body.device_model?.trim() || null,
      serial_number: body.serial_number?.trim() || null,
      ip_address: body.ip_address?.trim() || null,
      port: body.port ? Number(body.port) : null,
      location: body.location?.trim() || null,
      status,
      sync_interval_minutes: Number(body.sync_interval_minutes) || 30,
      notes: body.notes?.trim() || null,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) {
    const msg = error.message.includes("duplicate") ? "A device with this serial number already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "biometric_device",
    entity_id: data.id,
    action: "create",
    description: `Registered device "${data.device_name}"`,
    changes: data,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ device: data });
}
