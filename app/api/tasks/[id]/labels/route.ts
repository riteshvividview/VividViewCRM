import { heldResponse } from "../../_lib/hold";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "../../_lib/serialize";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOT_YOURS_MESSAGE, canAccessTask, canEditTask } from "../../_lib/teams";

async function loadTask(admin: SupabaseClient, id: string, workspaceId: string) {
  const { data } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  return data;
}

async function respondWithTask(admin: SupabaseClient, id: string) {
  const { data: task, error } = await admin.from("tasks").select(TASK_SELECT).eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}

/** Applies a workspace label to a task. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId, () => ({ tasks: [id] }));

  const { id } = await params;
  { const held = await heldResponse(id); if (held) return held; } // on hold: no changes until a CEO resumes it
  const admin = adminClient();
  const existing = await loadTask(admin, id, ctx.workspaceId);
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!(await canEditTask(admin, ctx, id))) return NextResponse.json({ error: NOT_YOURS_MESSAGE }, { status: 403 });

  const body = await request.json();
  const labelId: string | undefined = body.label_id;
  if (!labelId) return NextResponse.json({ error: "label_id is required" }, { status: 400 });

  const { data: label } = await admin.from("task_labels").select("id, name").eq("id", labelId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!label) return NextResponse.json({ error: "Label not found" }, { status: 404 });

  await admin.from("task_label_assignments").upsert(
    { task_id: id, label_id: labelId, assigned_by: ctx.userId },
    { onConflict: "task_id,label_id", ignoreDuplicates: true }
  );

  await admin.from("task_activity_log").insert({
    task_id: id,
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    action: "label_added",
    new_value: { label_id: labelId, label_name: label.name },
  });

  return respondWithTask(admin, id);
}

/** Removes a label from a task. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId, () => ({ tasks: [id] }));

  const { id } = await params;
  { const held = await heldResponse(id); if (held) return held; } // on hold: no changes until a CEO resumes it
  const admin = adminClient();
  const existing = await loadTask(admin, id, ctx.workspaceId);
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!(await canEditTask(admin, ctx, id))) return NextResponse.json({ error: NOT_YOURS_MESSAGE }, { status: 403 });

  const body = await request.json();
  const labelId: string | undefined = body.label_id;
  if (!labelId) return NextResponse.json({ error: "label_id is required" }, { status: 400 });

  const { data: label } = await admin.from("task_labels").select("id, name").eq("id", labelId).eq("workspace_id", ctx.workspaceId).maybeSingle();

  await admin.from("task_label_assignments").delete().eq("task_id", id).eq("label_id", labelId);

  await admin.from("task_activity_log").insert({
    task_id: id,
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    action: "label_removed",
    new_value: { label_id: labelId, label_name: label?.name ?? null },
  });

  return respondWithTask(admin, id);
}
