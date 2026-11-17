import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isLead, readOnlyResponse, syncWorkspace } from "../_lib/helpers";
import { removeFiles, type FileStore } from "../_lib/files";
import { notifyUsers } from "../_lib/notify";
import { getTaskSettings } from "../_lib/settings";
import { TEAMS_MIGRATION_HINT, assigneesOutsideTeam, canAccessTask, canReadTask, canUseTeam } from "../_lib/teams";
import { TASK_SELECT, attachRelations, type RawTask } from "../_lib/serialize";
import { columnForStatus, ensureProjectBoard, type StatusKey } from "../_lib/board";
import { RECURRING_PATTERNS, nextOccurrence, shiftBy, type RecurringPattern } from "../_lib/recurrence";

const PATCHABLE_FIELDS = [
  "title", "description", "status", "priority", "due_date", "planned_date", "color", "type_id",
  "linked_entity_type", "linked_entity_id", "linked_entity_name",
  "parent_task_id", "sub_tasks", "recurring_pattern", "tags",
  "project_id", "board_column_id", "position", "story_points", "start_date",
  "estimated_hours", "actual_hours", "started_at", "completed_at",
  "brief_note", "reference_note", "main_note",
];
const DATE_FIELDS = ["due_date", "planned_date", "start_date"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: StatusKey[] = ["todo", "in_progress", "waiting", "done"];
const STATUS_LABELS: Record<StatusKey, string> = { todo: "To Do", in_progress: "In Progress", waiting: "Waiting", done: "Done" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();
  const { data: task, error } = await admin.from("tasks").select(TASK_SELECT)
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!task || !(await canReadTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: { ...serialized, can_edit: !ctx.readOnly && (await canAccessTask(admin, ctx, id)) } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = adminClient();

  const { data: existing } = await admin.from("tasks").select("*")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field] === "" ? null : body[field];
  }
  if ("team_id" in body) {
    updates.team_id = body.team_id || null;
    if (updates.team_id && updates.team_id !== existing.team_id && !(await canUseTeam(admin, ctx, String(updates.team_id)))) {
      return NextResponse.json({ error: "You can only move a task to a team you belong to" }, { status: 403 });
    }
    if (updates.team_id && updates.team_id !== existing.team_id) {
      const { data: current } = await admin.from("task_assignees").select("user_id").eq("task_id", id);
      const outside = await assigneesOutsideTeam(admin, String(updates.team_id), (current ?? []).map((a) => a.user_id));
      if (outside) return NextResponse.json({ error: `${outside} Change the assignees first.` }, { status: 400 });
    }
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

  // The deadline can never be earlier than the day the task is scheduled for:
  // moving the task past its deadline pushes the deadline along with it.
  const nextPlanned = ("planned_date" in updates ? updates.planned_date : existing.planned_date) as string | null;
  const nextDue = ("due_date" in updates ? updates.due_date : existing.due_date) as string | null;
  let deadlineMoved = false;
  if (nextPlanned && nextDue && nextDue < nextPlanned) {
    if ("due_date" in updates && !("planned_date" in updates)) {
      return NextResponse.json({ error: "The deadline cannot be before the day the task is scheduled for" }, { status: 400 });
    }
    updates.due_date = nextPlanned;
    deadlineMoved = true;
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
  // A task is completed by submitting its main (final) file.
  if (newStatus === "done" && existing.status !== "done") {
    const { count } = await admin.from("task_attachments").select("id", { count: "exact", head: true })
      .eq("task_id", id).eq("kind", "main").is("purged_at", null);
    if (!count) return NextResponse.json({ error: "Upload the main file before completing this task", code: "main_file_required" }, { status: 400 });
  }
  if (newStatus !== existing.status) {
    if (newStatus === "done") updates.completed_at = new Date().toISOString();
    else if (existing.status === "done") updates.completed_at = null;
  }

  // Keep the legacy single-assignee columns untouched (managed by /assignees).
  updates.updated_at = new Date().toISOString();
  const { data: task, error } = await admin.from("tasks").update(updates).eq("id", id).select(TASK_SELECT).single();
  if (error) return NextResponse.json({ error: /team_id/.test(error.message) ? TEAMS_MIGRATION_HINT : error.message }, { status: 400 });

  await admin.from("task_activity_log").insert({
    task_id: id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "updated", new_value: updates,
    metadata: Object.keys(logMeta).length ? logMeta : null,
  });

  // Tell the creator and the other assignees about every change someone else makes.
  {
    const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "the waiting list");
    const movedColumn = "board_column_id" in updates && updates.board_column_id !== existing.board_column_id;
    const statusChanged = newStatus !== existing.status || movedColumn;
    const completed = newStatus === "done" && existing.status !== "done";
    const changes: string[] = [];
    if (statusChanged && !completed) changes.push(`moved it to ${(logMeta.column_name as string | undefined) ?? STATUS_LABELS[newStatus]}`);
    if ("planned_date" in updates && updates.planned_date !== existing.planned_date) {
      changes.push(`moved it from ${day(existing.planned_date)} to ${day(updates.planned_date as string | null)}`);
    }
    if ("due_date" in updates && updates.due_date !== existing.due_date) {
      changes.push(updates.due_date ? `${deadlineMoved ? "the deadline moved with it to" : "changed the deadline to"} ${day(updates.due_date as string)}` : "removed the deadline");
    }
    if ("priority" in updates && updates.priority !== existing.priority) changes.push(`set the priority to ${String(updates.priority)}`);
    if (typeof updates.title === "string" && updates.title !== existing.title) changes.push("renamed it");
    if ("description" in updates && updates.description !== existing.description) changes.push("edited the description");
    if ("type_id" in updates && updates.type_id !== existing.type_id) changes.push(logMeta.type_name ? `set the type to ${logMeta.type_name}` : "removed the type");
    if ("project_id" in updates && updates.project_id !== existing.project_id) changes.push("changed the brand");
    if ("team_id" in updates && updates.team_id !== (existing.team_id ?? null)) changes.push("changed the team");
    for (const k of ["brief_note", "reference_note", "main_note"] as const) {
      if (k in updates && updates[k] !== existing[k]) { changes.push("edited the file notes"); break; }
    }

    if (completed || changes.length) {
      const [{ data: assignees }, { data: actor }] = await Promise.all([
        admin.from("task_assignees").select("user_id").eq("task_id", id),
        admin.from("profiles").select("full_name").eq("user_id", ctx.userId).maybeSingle(),
      ]);
      const receivers = [existing.created_by, existing.assignee_id, ...(assignees ?? []).map((a) => a.user_id)].filter((u) => u && u !== ctx.userId);
      const who = actor?.full_name ?? "Someone";
      const lastDay = !completed && task.planned_date && task.due_date && task.planned_date === task.due_date
        && ("planned_date" in updates || "due_date" in updates);
      if (completed) {
        await notifyUsers(admin, ctx.workspaceId, receivers, { type: "task_completed", title: `${who} completed a task`, body: task.title, entity_type: "task", entity_id: id }).catch(() => {});
      } else {
        await notifyUsers(admin, ctx.workspaceId, receivers, {
          type: "task_assigned",
          title: `${who} ${changes.join(", ")}`,
          body: lastDay ? `${task.title}\nThe scheduled day is now the deadline day.` : task.title,
          entity_type: statusChanged ? "task_status" : "task_update",
          entity_id: id,
        }).catch(() => {});
      }
    }
  }

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
        brief_note: task.brief_note, reference_note: task.reference_note, recurrence_parent_id: id,
        // The next occurrence stays in the same team, so it stays private to that team.
        ...((("team_id" in updates ? updates.team_id : existing.team_id) ?? null) ? { team_id: "team_id" in updates ? updates.team_id : existing.team_id } : {}),
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
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId);

  const { id } = await params;
  const admin = adminClient();
  const { data: existing } = await admin.from("tasks").select("id, title, created_by, assignee_id")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!isLead(ctx.role)) {
    const { delete_rule } = await getTaskSettings(admin, ctx.workspaceId);
    if (delete_rule === "leads") return NextResponse.json({ error: "Only team leads and the CEO can delete tasks" }, { status: 403 });
    if (existing.created_by !== ctx.userId) return NextResponse.json({ error: "Only the task creator or a team lead can delete this task" }, { status: 403 });
  }

  // Who to tell once the task is gone.
  const [{ data: wasAssigned }, { data: deleter }] = await Promise.all([
    admin.from("task_assignees").select("user_id").eq("task_id", id),
    admin.from("profiles").select("full_name").eq("user_id", ctx.userId).maybeSingle(),
  ]);

  // Remove stored attachment files (rows cascade with the task).
  const { data: files } = await admin.from("task_attachments").select("file_path, storage").eq("task_id", id);
  if (files?.length) await removeFiles(admin, files as { file_path: string | null; storage: FileStore }[]);

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

  await notifyUsers(admin, ctx.workspaceId,
    [existing.created_by, existing.assignee_id, ...(wasAssigned ?? []).map((a) => a.user_id)].filter((u) => u && u !== ctx.userId),
    { type: "task_assigned", title: `${deleter?.full_name ?? "Someone"} deleted a task`, body: existing.title, entity_type: "task_deleted", entity_id: id },
  ).catch(() => {});
  return NextResponse.json({ success: true });
}
