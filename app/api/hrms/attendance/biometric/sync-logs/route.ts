import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const deviceId = request.nextUrl.searchParams.get("device_id");
  const status = request.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);

  let query = admin
    .from("hr_biometric_sync_logs")
    .select("*, hr_biometric_devices(device_name, device_model)")
    .eq("workspace_id", ctx.workspaceId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (deviceId) query = query.eq("device_id", deviceId);
  if (status && ["running", "success", "partial", "failed"].includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sync_logs: data ?? [] });
}
