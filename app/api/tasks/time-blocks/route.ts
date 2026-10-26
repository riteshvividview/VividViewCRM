import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";

const SELECT = "id, task_id, user_id, start_at, end_at, task:tasks(id, title, status, color, priority, project:task_projects!project_id(id, name, color))";

function validRange(start: unknown, end: unknown): string | null {
  const s = new Date(String(start)), e = new Date(String(end));
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Invalid time";
  if (e <= s) return "End must be after start";
  if (e.getTime() - s.getTime() > 24 * 3600 * 1000) return "A time block can be at most 24 hours";
  return null;
}

/** GET ?from=ISO&to=ISO[&user_id=] — time blocks in a range (default: the caller's). */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  let q = adminClient().from("task_time_blocks").select(SELECT).eq("workspace_id", ctx.workspaceId);
  if (sp.get("from")) q = q.gte("end_at", sp.get("from")!);
  if (sp.get("to")) q = q.lte("start_at", sp.get("to")!);
  if (sp.get("task_id")) q = q.eq("task_id", sp.get("task_id")!);
  else if (sp.get("user_id") !== "all") q = q.eq("user_id", sp.get("user_id") || ctx.userId);
  const { data, error } = await q.order("start_at").limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ blocks: data ?? [] });
}

/** POST { task_id, start_at, end_at, user_id? } */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const err = validRange(body.start_at, body.end_at);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const admin = adminClient();
  const { data: task } = await admin.from("tasks").select("id").eq("id", body.task_id ?? "").eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let userId = ctx.userId;
  if (body.user_id && body.user_id !== ctx.userId) {
    const { data: p } = await admin.from("profiles").select("user_id").eq("user_id", body.user_id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!p) return NextResponse.json({ error: "Member not found" }, { status: 400 });
    userId = p.user_id;
  }

  const { data, error } = await admin.from("task_time_blocks").insert({
    workspace_id: ctx.workspaceId, task_id: task.id, user_id: userId,
    start_at: new Date(body.start_at).toISOString(), end_at: new Date(body.end_at).toISOString(),
  }).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ block: data });
}

/** PATCH { id, start_at, end_at } (drag/resize) */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const err = validRange(body.start_at, body.end_at);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const { data, error } = await adminClient().from("task_time_blocks")
    .update({ start_at: new Date(body.start_at).toISOString(), end_at: new Date(body.end_at).toISOString() })
    .eq("id", body.id ?? "").eq("workspace_id", ctx.workspaceId).select(SELECT).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Time block not found" }, { status: 404 });
  return NextResponse.json({ block: data });
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const { error } = await adminClient().from("task_time_blocks").delete().eq("id", id).eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
