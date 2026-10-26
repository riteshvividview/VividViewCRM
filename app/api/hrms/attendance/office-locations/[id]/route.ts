import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, writeAuditLog } from "../../_lib/helpers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const admin = adminClient();

  const { data: existing } = await admin
    .from("hr_office_locations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Office location not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();

  if (body.latitude !== undefined) {
    const latitude = Number(body.latitude);
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      return NextResponse.json({ error: "Latitude must be between -90 and 90" }, { status: 400 });
    }
    update.latitude = latitude;
  }
  if (body.longitude !== undefined) {
    const longitude = Number(body.longitude);
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Longitude must be between -180 and 180" }, { status: 400 });
    }
    update.longitude = longitude;
  }
  if (body.radius_meters !== undefined) {
    update.radius_meters = Number(body.radius_meters) > 0 ? Math.round(Number(body.radius_meters)) : 200;
  }

  if (body.is_default === true) {
    await admin.from("hr_office_locations").update({ is_default: false }).eq("workspace_id", ctx.workspaceId).eq("is_default", true);
    update.is_default = true;
  } else if (body.is_default === false) {
    update.is_default = false;
  }

  const { data, error } = await admin.from("hr_office_locations").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "office_location",
    entity_id: id,
    action: "update",
    description: `Updated office location "${data.name}"`,
    changes: { before: existing, after: data },
    performed_by: ctx.userId,
  });

  return NextResponse.json({ location: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = adminClient();

  const { data: location } = await admin
    .from("hr_office_locations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!location) return NextResponse.json({ error: "Office location not found" }, { status: 404 });

  const { error } = await admin.from("hr_office_locations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "office_location",
    entity_id: id,
    action: "delete",
    description: `Removed office location "${location.name}"`,
    changes: location,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ success: true });
}
