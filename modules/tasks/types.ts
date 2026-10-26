export type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type LinkedEntityType = "lead" | "deal" | "contact" | "company" | null;
export type RecurringPattern = "daily" | "workdays" | "weekly" | "biweekly" | "monthly" | "yearly" | null;

export const RECURRING_OPTIONS: { value: Exclude<RecurringPattern, null>; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "workdays", label: "Every workday (Mon–Fri)" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

/** Bordio-style task colours (card accent). */
export const TASK_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

/** A custom status column of a project board. */
export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  position: number;
  status_key: TaskStatus;
  is_done_column: boolean;
}

export interface TimeBlock {
  id: string;
  task_id: string;
  user_id: string | null;
  start_at: string;
  end_at: string;
  task?: { id: string; title: string; status: TaskStatus; color: string | null; priority: TaskPriority; project: { id: string; name: string; color: string | null } | null } | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  attendees: string[];
  notes: string | null;
  video_call_link: string | null;
  color_override: string | null;
  created_by: string | null;
}

export interface TaskAttachment {
  id: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  url: string | null;
}

export interface SubTask {
  id: string;
  title: string;
  checked: boolean;
}

/** A workspace member, used for assignees/reporter/pickers. */
export interface TaskMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/** A persisted comment from /api/tasks/[id]/comments. */
export interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  author: TaskMember | null;
  parent_comment_id: string | null;
  edited_at: string | null;
  created_at: string;
}

export type TaskActivityAction =
  | "created" | "updated" | "assignee_added" | "assignee_removed" | "label_added" | "label_removed";

/** A persisted entry from task_activity_log, via /api/tasks/[id]/activity. */
export interface TaskActivityEntry {
  id: string;
  action: TaskActivityAction | string;
  field_name: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  actor_id: string;
  created_at: string;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface TaskProjectRef {
  id: string;
  name: string;
  color: string | null;
}

export interface TaskBoardRef {
  id: string;
  name: string;
}

/** A project as listed in "All projects" — from /api/tasks/projects. */
export interface TaskProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  icon: string | null;
  team_id: string | null;
  archived_at: string | null;
  owner_id?: string | null;
  task_count?: number;
  open_count?: number;
}

/** A workspace team, used for "assign to a team" pickers. */
export interface TaskTeam {
  id: string;
  name: string;
  member_ids: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  /** @deprecated kept for backward compatibility — use `assignees` */
  assignee_id: string | null;
  /** @deprecated kept for backward compatibility — use `assignees` */
  assignee_name: string | null;
  assignees: TaskMember[];
  reporter: TaskMember | null;
  labels: TaskLabel[];
  linked_entity_type: LinkedEntityType;
  linked_entity_id: string | null;
  linked_entity_name: string | null;
  parent_task_id: string | null;
  sub_tasks: SubTask[];
  recurring_pattern: RecurringPattern;
  tags: string[];
  project_id: string | null;
  board_id: string | null;
  board_column_id: string | null;
  /** The day the task is planned for in the weekly planner (null = waiting list). */
  planned_date: string | null;
  color: string | null;
  recurrence_parent_id: string | null;
  project: TaskProjectRef | null;
  board: TaskBoardRef | null;
  position: number;
  story_points: number | null;
  start_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  todo:        { label: "To Do",       color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800",          border: "border-slate-300 dark:border-slate-700",  dot: "bg-slate-400" },
  in_progress: { label: "In Progress", color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40",           border: "border-blue-200 dark:border-blue-800",    dot: "bg-blue-500" },
  waiting:     { label: "Waiting",     color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/40",         border: "border-amber-200 dark:border-amber-800",  dot: "bg-amber-400" },
  done:        { label: "Done",        color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40",  border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  low:    { label: "Low",    color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800",        border: "border-l-slate-300" },
  medium: { label: "Medium", color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",        border: "border-l-blue-400" },
  high:   { label: "High",   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",      border: "border-l-amber-500" },
  urgent: { label: "Urgent", color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/30",          border: "border-l-red-500" },
};
