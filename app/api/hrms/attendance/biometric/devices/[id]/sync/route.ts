import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../../../_lib/helpers";
import { runDeviceSync, type BiometricDevice } from "../../../_lib/sync-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = adminClient();

  const { data: device } = await admin
    .from("hr_biometric_devices")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  const syncLog = await runDeviceSync(admin, ctx.workspaceId, device as BiometricDevice, ctx.userId, "manual");
  return NextResponse.json({ sync_log: syncLog });
}
