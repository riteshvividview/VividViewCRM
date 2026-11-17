import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamRef } from "./teams";

/** Columns selected for every task read, including embeddable project/board refs. */
export const TASK_SELECT = `
  id, title, description, status, priority, due_date,
  assignee_id, assignee_name,
  linked_entity_type, linked_entity_id, linked_entity_name,
  parent_task_id, sub_tasks, recurring_pattern, tags,
  created_by, workspace_id, created_at, updated_at,
  project_id, board_id, position, story_points, start_date,
  estimated_hours, actual_hours, started_at, completed_at,
  planned_date, color, board_column_id, recurrence_parent_id, type_id, number, team_id,
  brief_note, reference_note, main_note,
  project:task_projects!project_id(id, name, color, key),
  type:task_types!type_id(id, name, color),
  board:task_boards!board_id(id, name)
`;

export interface TaskMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

interface TaskProjectRef { id: string; name: string; color: string | null; key?: string | null }
interface TaskTypeRef { id: string; name: string; color: string }
interface TaskBoardRef { id: string; name: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTask = Record<string, any> & {
  id: string;
  created_by: string | null;
  assignee_id: string | null;
  project?: TaskProjectRef | TaskProjectRef[] | null;
  type?: TaskTypeRef | TaskTypeRef[] | null;
  board?: TaskBoardRef | TaskBoardRef[] | null;
};

export interface SerializedTask extends Omit<RawTask, "project" | "board" | "type"> {
  project: TaskProjectRef | null;
  type: TaskTypeRef | null;
  comment_count: number;
  attachment_count: number;
  /** A task can only be completed once it has a main file. */
  has_main_file: boolean;
  /** The one team this task belongs to (null = visible to everyone). */
  team_id: string | null;
  team: TeamRef | null;
  board: TaskBoardRef | null;
  assignees: TaskMember[];
  labels: TaskLabel[];
  reporter: TaskMember | null;
}

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Everything a task row needs besides people's names, embedded in the same query:
 * team, assignees, labels, the number of chat messages, and its files (kinds only).
 * Queries that use it must also apply `relationFilters`.
 */
export const RELATIONS_SELECT = `
  team:teams!team_id(id, name, color),
  assignee_rows:task_assignees(user_id),
  label_rows:task_label_assignments(task_labels(id, name, color)),
  comment_total:task_comments(count),
  file_rows:task_attachments(kind)
`;
/** A full task in one query (with `relationFilters`). */
export const TASK_LIST_SELECT = `${TASK_SELECT}, ${RELATIONS_SELECT}`;

/** Filters on the embedded parts: live messages only; task files only (no chat media, none cleaned up). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function relationFilters<Q extends { is: any; neq: any }>(q: Q): Q {
  return q.is("task_comments.deleted_at", null).neq("task_attachments.kind", "chat").is("task_attachments.purged_at", null);
}

/** Names and photos of everyone in the workspace (small; read alongside the tasks, not after). */
export async function workspacePeople(admin: SupabaseClient, workspaceId: string): Promise<Map<string, TaskMember>> {
  const { data } = await admin.from("profiles").select("user_id, full_name, avatar_url").eq("workspace_id", workspaceId);
  return new Map((data ?? []).map((p) => [p.user_id, { id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url }]));
}

/** Turns rows read with TASK_LIST_SELECT into the shape the app uses. */
export function shapeTasks(rows: RawTask[], people: Map<string, TaskMember>): SerializedTask[] {
  return rows.map((row) => {
    const { assignee_rows, label_rows, comment_total, file_rows, team, ...t } = row;
    const files = (file_rows ?? []) as { kind: string }[];
    return {
      ...t,
      project: toOne(t.project),
      type: toOne(t.type),
      board: toOne(t.board),
      team_id: t.team_id ?? null,
      team: toOne(team) as TeamRef | null,
      comment_count: (toOne(comment_total) as { count?: number } | null)?.count ?? 0,
      attachment_count: files.length,
      has_main_file: files.some((f) => f.kind === "main"),
      assignees: ((assignee_rows ?? []) as { user_id: string }[]).map((a) => people.get(a.user_id)).filter(Boolean) as TaskMember[],
      labels: ((label_rows ?? []) as { task_labels: TaskLabel | TaskLabel[] | null }[]).map((l) => toOne(l.task_labels)).filter(Boolean) as TaskLabel[],
      reporter: t.created_by ? people.get(t.created_by) ?? null : null,
    } as SerializedTask;
  });
}

/**
 * Adds assignees, labels, counts, files, team and the creator to task rows read
 * with TASK_SELECT: one query for those parts and one for names, at the same time.
 */
export async function attachRelations(admin: SupabaseClient, tasks: RawTask[]): Promise<SerializedTask[]> {
  if (tasks.length === 0) return [];
  const ids = tasks.map((t) => t.id);
  const workspaceId = tasks[0].workspace_id as string;
  const [{ data: rel }, people] = await Promise.all([
    relationFilters(admin.from("tasks").select(`id, ${RELATIONS_SELECT}`).in("id", ids)),
    workspacePeople(admin, workspaceId),
  ]);
  const byId = new Map(((rel ?? []) as unknown as RawTask[]).map((r) => [r.id, r]));
  return shapeTasks(tasks.map((t) => ({ ...t, ...(byId.get(t.id) ?? {}) })), people);
}
