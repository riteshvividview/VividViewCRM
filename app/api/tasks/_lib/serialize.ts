import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns selected for every task read, including embeddable project/board refs. */
export const TASK_SELECT = `
  id, title, description, status, priority, due_date,
  assignee_id, assignee_name,
  linked_entity_type, linked_entity_id, linked_entity_name,
  parent_task_id, sub_tasks, recurring_pattern, tags,
  created_by, workspace_id, created_at, updated_at,
  project_id, board_id, position, story_points, start_date,
  estimated_hours, actual_hours, started_at, completed_at,
  planned_date, color, board_column_id, recurrence_parent_id,
  project:task_projects!project_id(id, name, color),
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

interface TaskProjectRef { id: string; name: string; color: string | null }
interface TaskBoardRef { id: string; name: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTask = Record<string, any> & {
  id: string;
  created_by: string | null;
  assignee_id: string | null;
  project?: TaskProjectRef | TaskProjectRef[] | null;
  board?: TaskBoardRef | TaskBoardRef[] | null;
};

export interface SerializedTask extends Omit<RawTask, "project" | "board"> {
  project: TaskProjectRef | null;
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
 * Attaches multi-assignees (task_assignees), labels (task_label_assignments)
 * and reporter (created_by) profile info to raw task rows. Required because
 * task_assignees.user_id / tasks.created_by / tasks.assignee_id have no FK to
 * profiles, so PostgREST cannot embed them — joined manually here instead.
 */
export async function attachRelations(admin: SupabaseClient, tasks: RawTask[]): Promise<SerializedTask[]> {
  if (tasks.length === 0) return [];
  const taskIds = tasks.map((t) => t.id);

  const [assigneesRes, labelsRes] = await Promise.all([
    admin.from("task_assignees").select("task_id, user_id").in("task_id", taskIds),
    admin.from("task_label_assignments").select("task_id, task_labels(id, name, color)").in("task_id", taskIds),
  ]);

  const userIds = new Set<string>();
  for (const a of assigneesRes.data ?? []) userIds.add(a.user_id);
  for (const t of tasks) {
    if (t.created_by) userIds.add(t.created_by);
    if (t.assignee_id) userIds.add(t.assignee_id);
  }

  const { data: profiles } = userIds.size > 0
    ? await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", Array.from(userIds))
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };

  const profileByUserId = new Map<string, TaskMember>(
    (profiles ?? []).map((p) => [p.user_id, { id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url }])
  );

  const assigneesByTask = new Map<string, TaskMember[]>();
  for (const a of assigneesRes.data ?? []) {
    const member = profileByUserId.get(a.user_id);
    if (!member) continue;
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push(member);
    assigneesByTask.set(a.task_id, list);
  }

  const labelsByTask = new Map<string, TaskLabel[]>();
  for (const l of (labelsRes.data ?? []) as Array<{ task_id: string; task_labels: TaskLabel | TaskLabel[] | null }>) {
    const label = toOne(l.task_labels);
    if (!label) continue;
    const list = labelsByTask.get(l.task_id) ?? [];
    list.push(label);
    labelsByTask.set(l.task_id, list);
  }

  return tasks.map((t) => ({
    ...t,
    project: toOne(t.project),
    board: toOne(t.board),
    assignees: assigneesByTask.get(t.id) ?? [],
    labels: labelsByTask.get(t.id) ?? [],
    reporter: t.created_by ? profileByUserId.get(t.created_by) ?? null : null,
  })) as SerializedTask[];
}
