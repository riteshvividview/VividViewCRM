export type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type LinkedEntityType = "lead" | "deal" | "contact" | "company" | null;
export type RecurringPattern = "daily" | "weekly" | "monthly" | null;

export interface SubTask {
  id: string;
  title: string;
  checked: boolean;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  type: "created" | "status_changed" | "assigned" | "due_date_set" | "comment";
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  linked_entity_type: LinkedEntityType;
  linked_entity_id: string | null;
  linked_entity_name: string | null;
  parent_task_id: string | null;
  sub_tasks: SubTask[];
  recurring_pattern: RecurringPattern;
  tags: string[];
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
