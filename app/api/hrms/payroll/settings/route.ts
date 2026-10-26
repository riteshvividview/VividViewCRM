import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../attendance/_lib/helpers";
import { DEFAULT_SETTINGS, loadSettings } from "../_lib/engine";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ settings: await loadSettings(adminClient(), ctx.workspaceId) });
}

export async function PUT(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const row: Record<string, unknown> = { workspace_id: ctx.workspaceId, updated_at: new Date().toISOString() };
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(k in body)) continue;
    row[k] = typeof def === "boolean" ? !!body[k] : Number(body[k]);
    if (typeof def === "number" && !Number.isFinite(row[k])) {
      return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
    }
  }

  const { error } = await adminClient().from("hr_payroll_settings").upsert(row, { onConflict: "workspace_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ settings: await loadSettings(adminClient(), ctx.workspaceId) });
}
