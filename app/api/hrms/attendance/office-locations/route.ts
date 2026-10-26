import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, writeAuditLog } from "../_lib/helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("hr_office_locations")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name: string = body.name?.trim() ?? "";
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!name) return NextResponse.json({ error: "Location name is required" }, { status: 400 });
  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: "Latitude must be between -90 and 90" }, { status: 400 });
  }
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Longitude must be between -180 and 180" }, { status: 400 });
  }

  const radiusMeters = Number(body.radius_meters) > 0 ? Math.round(Number(body.radius_meters)) : 200;
  const isDefault = body.is_default === true;

  const admin = adminClient();

  if (isDefault) {
    await admin.from("hr_office_locations").update({ is_default: false }).eq("workspace_id", ctx.workspaceId).eq("is_default", true);
  }

  const { data, error } = await admin
    .from("hr_office_locations")
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      latitude,
      longitude,
      radius_meters: radiusMeters,
      is_default: isDefault,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "office_location",
    entity_id: data.id,
    action: "create",
    description: `Added office location "${data.name}"`,
    changes: data,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ location: data });
}
