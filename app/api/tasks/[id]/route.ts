import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "../_lib/serialize";
import { columnForStatus, ensureProjectBoard, type StatusKey } from "../_lib/board";
import { RECURRING_PATTERNS, nextOccurrence, shiftBy, type RecurringPattern } from "../_lib/recurrence";

const PATCHABLE_FIELDS = [
  "title", "description", "status", "priority", "due_date", "planned_date", "color", "type_id",
  "linked_entity_type", "linked_entity_id", "linked_entity_name",
  "parent_task_id", "sub_tasks", "recurring_pattern", "tags",
  "project_id", "board_column_id", "position", "story_points", "start_date",
  "estimated_hours", "actual_hours", "started_at", "completed_at",
];
const DATE_FIELDS = ["due_date", "planned_date", "start_date"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: StatusKey[] = ["todo", "in_progress", "waiting", "done"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();
  const { data: task, error } = await admin.from("tasks").select(TASK_SELECT)
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = adminClient();

  const { data: existing } = await admin.from("tasks").select("*")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field] === "" ? null : body[field];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  for (const f of DATE_FIELDS) {
    if (updates[f] && !DATE_RE.test(String(updates[f]))) return NextResponse.json({ error: `Invalid ${f}` }, { status: 400 });
  }
  if ("status" in updates && !STATUSES.includes(updates.status as StatusKey)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (updates.recurring_pattern && !RECURRING_PATTERNS.includes(updates.recurring_pattern as RecurringPattern)) {
    return NextResponse.json({ error: "Invalid repeat pattern" }, { status: 400 });
  }
  if ("priority" in updates && !["none", "low", "medium", "high", "urgent"].includes(String(updates.priority))) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }
  if (updates.type_id) {
    const { data: type } = await admin.from("task_types").select("id").eq("id", updates.type_id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!type) return NextResponse.json({ error: "Task type not found" }, { status: 400 });
  }
  if (typeof updates.title === "string" && !updates.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const logMeta: Record<string, unknown> = {};
  if (updates.type_id) {
    const { data: t } = await admin.from("task_types").select("name").eq("id", updates.type_id).maybeSingle();
    if (t) logMeta.type_name = t.name;
  }

  // ── Keep project column and base status in sync ─────────────────────────────
  const projectId = ("project_id" in updates ? updates.project_id : existing.project_id) as string | null;
  if ("project_id" in updates && projectId) {
    const { data: project } = await admin.from("task_projects").select("id")
      .eq("id", projectId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  }
  if (projectId && ("project_id" in updates || "board_column_id" in updates || "status" in updates)) {
    const { boardId, columns } = await ensureProjectBoard(admin, ctx.workspaceId, projectId, ctx.userId);
    let col = "board_column_id" in updates ? columns.find((c) => c.id === updates.board_column_id) : undefined;
    if ("board_column_id" in updates && !col) return NextResponse.json({ error: "Status column not found" }, { status: 400 });
    if (!col) {
      const wanted = (updates.status ?? existing.status) as StatusKey;
      const current = columns.find((c) => c.id === existing.board_column_id);
      // Moving project or changing status: keep the current column if it still matches.
      col = current && current.status_key === wanted && !("project_id" in updates) ? current : columnForStatus(columns, wanted);
    }
    updates.board_id = boardId;
    updates.board_column_id = col!.id;
    updates.status = col!.status_key;
    if (col!.id !== existing.board_column_id) logMeta.column_name = col!.name;
  } else if ("project_id" in updates && !projectId) {
    updates.board_id = null;
    updates.board_column_id = null;
  }

  const newStatus = (updates.status ?? existing.status) as StatusKey;
  if (newStatus !== existing.status) {
    if (newStatus === "done") updates.completed_at = new Date().toISOString();
    else if (existing.status === "done") updates.completed_at = null;
  }

  // Keep the legacy single-assignee columns untouched (managed by /assignees).
  updates.updated_at = new Date().toISOString();
  const { data: task, error } = await admin.from("tasks").update(updates).eq("id", id).select(TASK_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("task_activity_log").insert({
    task_id: id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "updated", new_value: updates,
    metadata: Object.keys(logMeta).length ? logMeta : null,
  });

  // ── Recurring: completing a repeating task schedules the next occurrence ────
  let nextTask: RawTask | null = null;
  const pattern = (task.recurring_pattern ?? null) as RecurringPattern | null;
  if (newStatus === "done" && existing.status !== "done" && pattern) {
    const anchor = (task.planned_date ?? task.due_date ?? new Date().toISOString().slice(0, 10)) as string;
    const next = nextOccurrence(pattern, anchor);
    const { data: already } = await admin.from("tasks").select("id")
      .eq("recurrence_parent_id", id).limit(1).maybeSingle();
    if (!already) {
      let columnId: string | null = null;
      if (task.project_id) {
        const { columns } = await ensureProjectBoard(admin, ctx.workspaceId, task.project_id, ctx.userId);
        columnId = columnForStatus(columns, "todo")?.id ?? null;
      }
      const { data: created } = await admin.from("tasks").insert({
        title: task.title, description: task.description, status: "todo", priority: task.priority,
        planned_date: task.planned_date ? next : null,
        due_date: task.planned_date ? shiftBy(task.due_date, anchor, next) : task.due_date ? next : null,
        color: task.color, type_id: task.type_id, recurring_pattern: pattern, tags: task.tags ?? [],
        sub_tasks: (Array.isArray(task.sub_tasks) ? task.sub_tasks : []).map((s: { checked?: boolean }) => ({ ...s, checked: false })),
        project_id: task.project_id, board_id: task.board_id, board_column_id: columnId,
        estimated_hours: task.estimated_hours, recurrence_parent_id: id,
        assignee_id: task.assignee_id, assignee_name: task.assignee_name,
        created_by: ctx.userId, workspace_id: ctx.workspaceId,
      }).select(TASK_SELECT).single();
      if (created) {
        const [{ data: assignees }, { data: labels }] = await Promise.all([
          admin.from("task_assignees").select("user_id").eq("task_id", id),
          admin.from("task_label_assignments").select("label_id").eq("task_id", id),
        ]);
        await Promise.all([
          assignees?.length ? admin.from("task_assignees").insert(assignees.map((a) => ({ task_id: created.id, user_id: a.user_id, assigned_by: ctx.userId }))) : null,
          labels?.length ? admin.from("task_label_assignments").insert(labels.map((l) => ({ task_id: created.id, label_id: l.label_id, assigned_by: ctx.userId }))) : null,
        ]);
        nextTask = created as RawTask;
      }
    }
  }

  const serialized = await attachRelations(admin, nextTask ? [task as RawTask, nextTask] : [task as RawTask]);
  return NextResponse.json({ task: serialized[0], next_task: serialized[1] ?? null });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();
  const { data: existing } = await admin.from("tasks").select("id")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Remove stored attachment files (rows cascade with the task).
  const { data: files } = await admin.from("task_attachments").select("file_path").eq("task_id", id);
  if (files?.length) await admin.storage.from("task-attachments").remove(files.map((f) => f.file_path));

  // Defensive cleanup — some older child tables may not have ON DELETE CASCADE.
  await admin.from("task_mentions").delete().eq("task_id", id);
  await Promise.all([
    admin.from("task_assignees").delete().eq("task_id", id),
    admin.from("task_watchers").delete().eq("task_id", id),
    admin.from("task_label_assignments").delete().eq("task_id", id),
    admin.from("task_comments").delete().eq("task_id", id),
    admin.from("task_activity_log").delete().eq("task_id", id),
    admin.from("task_time_entries").delete().eq("task_id", id),
    admin.from("task_recurrence_rules").delete().eq("task_id", id),
  ]);

  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
