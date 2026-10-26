import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../../_lib/helpers";

async function respondWithWatchers(admin: ReturnType<typeof adminClient>, taskId: string) {
  const { data: rows } = await admin.from("task_watchers").select("user_id").eq("task_id", taskId);
  const userIds = (rows ?? []).map((r) => r.user_id);

  const { data: profiles } = userIds.length > 0
    ? await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };

  return NextResponse.json({
    watchers: (profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url })),
  });
}

/** Lists the followers (watchers) of a task. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return respondWithWatchers(admin, id);
}

/** Follows a task (defaults to the current user). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const userId: string = typeof body.user_id === "string" ? body.user_id : ctx.userId;

  await admin.from("task_watchers").upsert({ task_id: id, user_id: userId }, { onConflict: "task_id,user_id", ignoreDuplicates: true });

  return respondWithWatchers(admin, id);
}

/** Unfollows a task (defaults to the current user). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const userId: string = typeof body.user_id === "string" ? body.user_id : ctx.userId;

  await admin.from("task_watchers").delete().eq("task_id", id).eq("user_id", userId);

  return respondWithWatchers(admin, id);
}
