import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "../_lib/serialize";

const PATCHABLE_FIELDS = [
  "title", "description", "status", "priority", "due_date",
  "linked_entity_type", "linked_entity_id", "linked_entity_name",
  "parent_task_id", "sub_tasks", "recurring_pattern", "tags",
  "project_id", "board_id", "position", "story_points", "start_date",
  "estimated_hours", "actual_hours", "started_at", "completed_at",
  "assignee_id", "assignee_name",
];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task, error } = await admin
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const admin = adminClient();

  const { data: existing } = await admin
    .from("tasks")
    .select("id, status")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (typeof updates.status === "string" && updates.status !== existing.status) {
    if (updates.status === "done" && !("completed_at" in updates)) updates.completed_at = new Date().toISOString();
    if (existing.status === "done" && updates.status !== "done" && !("completed_at" in updates)) updates.completed_at = null;
  }

  const { data: task, error } = await admin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select(TASK_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("task_activity_log").insert({
    task_id: id,
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    action: "updated",
    new_value: updates,
  });

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: existing } = await admin
    .from("tasks")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Defensive cleanup — some child tables may not have ON DELETE CASCADE configured.
  await Promise.all([
    admin.from("task_assignees").delete().eq("task_id", id),
    admin.from("task_watchers").delete().eq("task_id", id),
    admin.from("task_label_assignments").delete().eq("task_id", id),
    admin.from("task_comments").delete().eq("task_id", id),
    admin.from("task_mentions").delete().eq("task_id", id),
    admin.from("task_activity_log").delete().eq("task_id", id),
    admin.from("task_time_entries").delete().eq("task_id", id),
    admin.from("task_recurrence_rules").delete().eq("task_id", id),
  ]);

  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
