import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, syncWorkspace } from "../_lib/helpers";
import { getTaskSettings } from "../_lib/settings";
import { purgeTask, trashReady } from "../_lib/trash";

/**
 * The CEO's trash of deleted tasks.
 * GET                                  what is in it (with who deleted it, when, and days left)
 * POST { action: "restore", ids }      put tasks back exactly as they were
 * POST { action: "delete", ids }       remove them for good (files included)
 * POST { action: "empty" }             remove everything in the trash for good
 */
async function ceo() {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (ctx.role !== "super_admin") return { error: NextResponse.json({ error: "Only the CEO can open the trash" }, { status: 403 }) };
  const admin = adminClient();
  if (!(await trashReady(admin))) return { error: NextResponse.json({ error: "The trash is not set up yet. Run RUN-ME-49-task-trash.sql in Supabase first.", code: "not_ready" }, { status: 503 }) };
  return { ctx, admin };
}

export async function GET() {
  const r = await ceo();
  if ("error" in r) return r.error;
  const { ctx, admin } = r;
  const [{ data, error }, settings] = await Promise.all([
    admin.from("tasks")
      .select("id, title, number, status, deleted_at, deleted_by, created_by, project:task_projects!project_id(name, color, key), team:teams!team_id(name, color), file_rows:task_attachments(id)")
      .eq("workspace_id", ctx.workspaceId).not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }).limit(500),
    getTaskSettings(admin, ctx.workspaceId),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const people = [...new Set((data ?? []).flatMap((t) => [t.deleted_by, t.created_by]).filter(Boolean))] as string[];
  const { data: profiles } = people.length ? await admin.from("profiles").select("user_id, full_name").in("user_id", people) : { data: [] };
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name as string]));
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] ?? null : v);
  const items = (data ?? []).map((t) => {
    const project = one(t.project as unknown as { name: string; color: string | null; key: string | null } | null);
    const expires = new Date(new Date(t.deleted_at as string).getTime() + settings.trash_days * 864e5);
    return {
      id: t.id, title: t.title, status: t.status,
      code: t.number ? `${project?.key ?? "TASK"}-${t.number}` : null,
      brand: project ? { name: project.name, color: project.color } : null,
      team: one(t.team as unknown as { name: string; color: string | null } | null),
      files: (t.file_rows as unknown[] | null)?.length ?? 0,
      deleted_at: t.deleted_at, deleted_by: t.deleted_by ? name.get(t.deleted_by) ?? null : null,
      created_by: t.created_by ? name.get(t.created_by) ?? null : null,
      expires_at: expires.toISOString(),
      days_left: Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 864e5)),
    };
  });
  return NextResponse.json({ items, trash_days: settings.trash_days });
}

export async function POST(request: NextRequest) {
  const r = await ceo();
  if ("error" in r) return r.error;
  const { ctx, admin } = r;
  const body = await request.json().catch(() => ({}));

  let ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 500) : [];
  if (body.action === "empty") {
    const { data } = await admin.from("tasks").select("id").eq("workspace_id", ctx.workspaceId).not("deleted_at", "is", null).limit(500);
    ids = (data ?? []).map((t) => t.id);
  }
  // Only tasks of this workspace that really are in the trash.
  const { data: rows } = ids.length
    ? await admin.from("tasks").select("id").eq("workspace_id", ctx.workspaceId).not("deleted_at", "is", null).in("id", ids)
    : { data: [] as { id: string }[] };
  const found = (rows ?? []).map((t) => t.id);
  if (!found.length) return NextResponse.json({ error: body.action === "empty" ? "The trash is already empty" : "Nothing to do" }, { status: 400 });

  if (body.action === "restore") {
    const { error } = await admin.from("tasks").update({ deleted_at: null, deleted_by: null }).in("id", found);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from("task_activity_log").insert(found.map((task_id) => ({ task_id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "restored" })));
    syncWorkspace(ctx.workspaceId, { tasks: found });
    return NextResponse.json({ ok: true, restored: found.length });
  }

  if (body.action === "delete" || body.action === "empty") {
    let removed = 0;
    for (const id of found) if (!(await purgeTask(admin, id))) removed++;
    return NextResponse.json({ ok: true, removed, failed: found.length - removed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
