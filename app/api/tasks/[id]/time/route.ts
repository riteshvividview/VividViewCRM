import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../../_lib/helpers";

type Params = { params: Promise<{ id: string }> };
const SELECT = "id, user_id, started_at, ended_at, duration_minutes, description, is_manual, created_at";

async function load(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = adminClient();
  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  return { ctx, admin };
}

/** Recomputes tasks.actual_hours from finished time entries. */
async function syncActual(admin: ReturnType<typeof adminClient>, taskId: string) {
  const { data } = await admin.from("task_time_entries").select("duration_minutes").eq("task_id", taskId).not("ended_at", "is", null);
  const minutes = (data ?? []).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  await admin.from("tasks").update({ actual_hours: Math.round((minutes / 60) * 100) / 100 }).eq("id", taskId);
  return minutes;
}

/** Time entries of a task (logged sessions + any running timer). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { data, error } = await r.admin.from("task_time_entries").select(SELECT).eq("task_id", id).order("started_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = [...new Set((data ?? []).map((e) => e.user_id))];
  const { data: profiles } = ids.length ? await r.admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return NextResponse.json({
    entries: (data ?? []).map((e) => ({ ...e, user: byId.get(e.user_id) ? { id: e.user_id, full_name: byId.get(e.user_id)!.full_name, avatar_url: byId.get(e.user_id)!.avatar_url } : null })),
    total_minutes: (data ?? []).filter((e) => e.ended_at).reduce((s, e) => s + (e.duration_minutes ?? 0), 0),
  });
}

/**
 * POST { action: "start" }            start a timer (stops any other running timer of yours)
 * POST { action: "stop" }             stop your running timer on this task
 * POST { action: "log", minutes, date?, description? }  log time manually
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { ctx, admin } = r;
  const body = await request.json().catch(() => ({}));
  const now = new Date();

  if (body.action === "start" || body.action === "stop") {
    // Stop whatever is running for this user (one timer at a time, like Bordio).
    const { data: running } = await admin.from("task_time_entries").select("id, task_id, started_at").eq("user_id", ctx.userId).is("ended_at", null);
    for (const e of running ?? []) {
      const minutes = Math.max(1, Math.round((now.getTime() - new Date(e.started_at).getTime()) / 60000));
      await admin.from("task_time_entries").update({ ended_at: now.toISOString(), duration_minutes: minutes, updated_at: now.toISOString() }).eq("id", e.id);
      await syncActual(admin, e.task_id);
    }
    if (body.action === "stop") return NextResponse.json({ ok: true });
    const { data, error } = await admin.from("task_time_entries").insert({
      task_id: id, workspace_id: ctx.workspaceId, user_id: ctx.userId, started_at: now.toISOString(), is_manual: false,
    }).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!(await admin.from("tasks").select("started_at").eq("id", id).single()).data?.started_at) {
      await admin.from("tasks").update({ started_at: now.toISOString() }).eq("id", id);
    }
    return NextResponse.json({ entry: data });
  }

  if (body.action === "log") {
    const minutes = Math.round(Number(body.minutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) return NextResponse.json({ error: "Enter between 1 minute and 24 hours" }, { status: 400 });
    const day = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : now.toISOString().slice(0, 10);
    const start = new Date(`${day}T09:00:00`);
    const { data, error } = await admin.from("task_time_entries").insert({
      task_id: id, workspace_id: ctx.workspaceId, user_id: ctx.userId, is_manual: true,
      started_at: start.toISOString(), ended_at: new Date(start.getTime() + minutes * 60000).toISOString(),
      duration_minutes: minutes, description: typeof body.description === "string" ? body.description.slice(0, 500) : null,
    }).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const total = await syncActual(admin, id);
    return NextResponse.json({ entry: data, total_minutes: total });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** DELETE ?entry_id= — remove one of your own entries. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const entryId = request.nextUrl.searchParams.get("entry_id") ?? "";
  const { data: entry } = await r.admin.from("task_time_entries").select("user_id").eq("id", entryId).eq("task_id", id).maybeSingle();
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (entry.user_id !== r.ctx.userId) return NextResponse.json({ error: "You can only delete your own time entries" }, { status: 403 });
  await r.admin.from("task_time_entries").delete().eq("id", entryId);
  return NextResponse.json({ ok: true, total_minutes: await syncActual(r.admin, id) });
}
