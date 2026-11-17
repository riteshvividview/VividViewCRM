import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "../../_lib/serialize";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOT_YOURS_MESSAGE, assigneesOutsideTeam, canAccessTask, canEditTask, teamIdsOfTasks } from "../../_lib/teams";
import { notifyUsers } from "../../_lib/notify";

async function loadTask(admin: SupabaseClient, id: string, workspaceId: string) {
  const { data } = await admin.from("tasks").select("id, status").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  return data;
}

async function respondWithTask(admin: SupabaseClient, id: string) {
  const { data: task, error } = await admin.from("tasks").select(TASK_SELECT).eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}

/** Adds assignees to a task, either explicit user_ids or every member of team_id (team-leader assignment). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId);

  const { id } = await params;
  const admin = adminClient();
  const existing = await loadTask(admin, id, ctx.workspaceId);
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!(await canEditTask(admin, ctx, id))) return NextResponse.json({ error: NOT_YOURS_MESSAGE }, { status: 403 });
  if (existing.status === "done") return NextResponse.json({ error: "This task is completed. Reopen it to change the assignees." }, { status: 400 });

  const body = await request.json();
  const userIds = new Set<string>(Array.isArray(body.user_ids) ? body.user_ids : []);
  if (body.team_id) {
    const { data: members } = await admin.from("team_members").select("user_id").eq("team_id", body.team_id);
    for (const m of members ?? []) userIds.add(m.user_id);
  }
  if (userIds.size === 0) return NextResponse.json({ error: "user_ids or team_id is required" }, { status: 400 });
  const taskTeam = (await teamIdsOfTasks(admin, [id])).get(id);
  if (taskTeam) {
    const outside = await assigneesOutsideTeam(admin, taskTeam, Array.from(userIds));
    if (outside) return NextResponse.json({ error: outside }, { status: 400 });
  }

  const { data: existingAssignees } = await admin.from("task_assignees").select("user_id").eq("task_id", id);
  const existingIds = new Set((existingAssignees ?? []).map((a) => a.user_id));
  const newIds = Array.from(userIds).filter((uid) => !existingIds.has(uid));

  if (newIds.length > 0) {
    await admin.from("task_assignees").insert(
      newIds.map((userId) => ({ task_id: id, user_id: userId, assigned_by: ctx.userId }))
    );
    await admin.from("task_activity_log").insert({
      task_id: id,
      workspace_id: ctx.workspaceId,
      actor_id: ctx.userId,
      action: "assignee_added",
      new_value: { user_ids: newIds },
    });
    // People added after the task was created are told, like those assigned at creation.
    const [{ data: info }, { data: actor }] = await Promise.all([
      admin.from("tasks").select("title").eq("id", id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("user_id", ctx.userId).maybeSingle(),
    ]);
    await notifyUsers(admin, ctx.workspaceId, newIds.filter((u) => u !== ctx.userId), {
      type: "task_assigned", title: `${actor?.full_name ?? "Someone"} assigned you a task`, body: info?.title ?? "", entity_type: "task", entity_id: id,
    }).catch(() => {});
  }

  return respondWithTask(admin, id);
}

/** Removes a single assignee from a task. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId);

  const { id } = await params;
  const admin = adminClient();
  const existing = await loadTask(admin, id, ctx.workspaceId);
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!(await canEditTask(admin, ctx, id))) return NextResponse.json({ error: NOT_YOURS_MESSAGE }, { status: 403 });
  if (existing.status === "done") return NextResponse.json({ error: "This task is completed. Reopen it to change the assignees." }, { status: 400 });

  const body = await request.json();
  const userId: string | undefined = body.user_id;
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  await admin.from("task_assignees").delete().eq("task_id", id).eq("user_id", userId);
  await admin.from("task_activity_log").insert({
    task_id: id,
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    action: "assignee_removed",
    new_value: { user_id: userId },
  });

  return respondWithTask(admin, id);
}
