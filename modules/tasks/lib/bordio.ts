import type { Task } from "../types";
import { todayISO } from "../dates";

/** Bordio card colours: overdue → red, done → muted grey, otherwise the task type colour. */
export const OVERDUE_COLOR = "#b42828";
export const DONE_COLOR = "#4b5059";
export const UNTYPED_COLOR = "#5b6472";

export function isOverdue(task: Task): boolean {
  return task.status !== "done" && !!task.due_date && task.due_date < todayISO();
}

export function cardColor(task: Task): string {
  if (task.status === "done") return DONE_COLOR;
  if (isOverdue(task)) return OVERDUE_COLOR;
  return task.type?.color ?? task.color ?? UNTYPED_COLOR;
}

const dayDiff = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86400000);

/** "Due today", "Due tomorrow", "5 days left", "Exp. yesterday", "Exp. 84 days ago" */
export function dueLabel(task: Task): string | null {
  if (!task.due_date || task.status === "done") return null;
  const d = dayDiff(task.due_date);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d > 1) return `${d} days left`;
  if (d === -1) return "Exp. yesterday";
  return `Exp. ${-d} days ago`;
}

/** "overdue by 84 days" for the detail view */
export function overdueText(task: Task): string | null {
  if (!task.due_date || task.status === "done") return null;
  const d = dayDiff(task.due_date);
  return d < 0 ? `overdue by ${-d} day${d === -1 ? "" : "s"}` : null;
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** KEY-123 style task reference, e.g. DES-2331. */
export function taskKey(task: Task): string | null {
  if (!task.number) return null;
  return `${task.project?.key ?? "TSK"}-${task.number}`;
}
