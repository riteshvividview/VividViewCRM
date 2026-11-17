import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, syncWorkspace } from "../_lib/helpers";
import { getTaskSettings, saveTaskSettings, type TaskSettings } from "../_lib/settings";
import { countPurgeable, purgeExpiredFiles, r2Enabled } from "../_lib/files";

const isCeo = (role: string) => role === "super_admin";
const forbidden = () => NextResponse.json({ error: "Only the CEO can manage task settings" }, { status: 403 });

/**
 * Everyone gets the two values the app needs (read-only flag, delete rule).
 * The CEO also gets the full settings and a storage summary.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  const settings = await getTaskSettings(admin, ctx.workspaceId);
  if (!isCeo(ctx.role)) return NextResponse.json({ read_only: ctx.readOnly, delete_rule: settings.delete_rule });

  const { data: rows } = await admin.from("task_attachments").select("kind, size_bytes, purged_at, link_url").eq("workspace_id", ctx.workspaceId);
  const storage: Record<string, { files: number; bytes: number }> = {};
  let removed = 0;
  for (const r of rows ?? []) {
    if (r.purged_at) { removed++; continue; }
    if (r.link_url) continue;
    const s = (storage[r.kind] ??= { files: 0, bytes: 0 });
    s.files++;
    s.bytes += r.size_bytes ?? 0;
  }
  const [due, all] = await Promise.all([
    countPurgeable(admin, ctx.workspaceId, settings.retention_days),
    countPurgeable(admin, ctx.workspaceId, 0),
  ]);
  return NextResponse.json({
    read_only: false, delete_rule: settings.delete_rule, settings, storage, removed,
    cleanup: { due, all }, cloudflare: r2Enabled(),
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCeo(ctx.role)) return forbidden();
  syncWorkspace(ctx.workspaceId);
  const body = await request.json().catch(() => ({}));

  const patch: Partial<TaskSettings> = {};
  if (typeof body.retention_enabled === "boolean") patch.retention_enabled = body.retention_enabled;
  if (body.retention_days !== undefined) {
    const days = Math.round(Number(body.retention_days));
    if (!Number.isFinite(days) || days < 1 || days > 3650) return NextResponse.json({ error: "Days must be between 1 and 3650" }, { status: 400 });
    patch.retention_days = days;
  }
  if (["full", "view", "hidden"].includes(body.hr_access)) patch.hr_access = body.hr_access;
  if (["creator", "leads"].includes(body.delete_rule)) patch.delete_rule = body.delete_rule;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const { data, error } = await saveTaskSettings(adminClient(), ctx.workspaceId, ctx.userId, patch);
  if (error) {
    const missing = /task_settings/.test(error.message) && /(does not exist|schema cache)/.test(error.message);
    return NextResponse.json({ error: missing ? "Settings table is missing. Run RUN-ME-43-task-settings.sql in Supabase first." : error.message }, { status: 400 });
  }
  return NextResponse.json({ settings: data });
}

/** POST { scope: "due" | "all" } — run the cleanup now. "all" ignores the waiting period. */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCeo(ctx.role)) return forbidden();
  const body = await request.json().catch(() => ({}));
  const admin = adminClient();
  const settings = await getTaskSettings(admin, ctx.workspaceId);
  const removed = await purgeExpiredFiles(admin, ctx.workspaceId, body.scope === "all" ? 0 : settings.retention_days);
  await saveTaskSettings(admin, ctx.workspaceId, ctx.userId, { last_cleanup_at: new Date().toISOString() });
  return NextResponse.json({ removed });
}
