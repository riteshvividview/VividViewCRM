"use client";

import { Check, Clock, RefreshCw, CheckSquare, Flag } from "lucide-react";
import type { Task } from "../types";
import { PRIORITY_CONFIG } from "../types";
import { AssigneeAvatar } from "./assignee-picker";
import { cn } from "@/lib/utils";
import { formatMinutes, todayISO } from "../dates";

export const TASK_DRAG_TYPE = "application/x-vivid-task";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  /** Hide the project chip (e.g. inside a project board). */
  hideProject?: boolean;
  compact?: boolean;
  draggable?: boolean;
}

/** Bordio-style task card: colour accent, one-click complete, meta row. Draggable via TASK_DRAG_TYPE. */
export function TaskCard({ task, onOpen, onToggleDone, hideProject, compact, draggable = true }: TaskCardProps) {
  const done = task.status === "done";
  const accent = task.color ?? task.project?.color ?? null;
  const subDone = task.sub_tasks.filter((s) => s.checked).length;
  const overdue = !done && task.due_date && task.due_date < todayISO();

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(task)}
      className={cn(
        "group relative rounded-lg border bg-card px-2.5 py-2 text-sm shadow-[0_1px_0_rgba(0,0,0,0.03)] cursor-pointer select-none",
        "hover:border-foreground/20 hover:shadow-sm transition-all",
        done && "opacity-60",
      )}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          aria-label={done ? "Mark as not done" : "Mark as done"}
          onClick={(e) => { e.stopPropagation(); onToggleDone(task); }}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition-colors",
            done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
          )}
        >
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <p className={cn("flex-1 leading-snug break-words", done && "line-through text-muted-foreground")}>{task.title}</p>
      </div>

      {!compact && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-[11px] text-muted-foreground">
          {!hideProject && task.project && (
            <span className="inline-flex items-center gap-1 truncate max-w-[120px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: task.project.color ?? "#6366f1" }} />
              {task.project.name}
            </span>
          )}
          {(task.priority === "high" || task.priority === "urgent") && (
            <span className={cn("inline-flex items-center gap-0.5", PRIORITY_CONFIG[task.priority].color)}><Flag className="h-3 w-3" />{PRIORITY_CONFIG[task.priority].label}</span>
          )}
          {task.estimated_hours ? <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatMinutes(task.estimated_hours * 60)}</span> : null}
          {task.sub_tasks.length > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{subDone}/{task.sub_tasks.length}</span>}
          {task.recurring_pattern && <RefreshCw className="h-3 w-3" aria-label="Repeats" />}
          {task.due_date && (
            <span className={cn(overdue && "text-red-600 font-medium")}>
              Due {new Date(`${task.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
          {task.labels.slice(0, 2).map((l) => (
            <span key={l.id} className="rounded px-1.5 py-px text-[10px] font-medium" style={{ backgroundColor: `${l.color}22`, color: l.color }}>{l.name}</span>
          ))}
          {task.assignees.length > 0 && (
            <span className="ml-auto flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => <AssigneeAvatar key={a.id} member={a} size="xs" />)}
              {task.assignees.length > 3 && <span className="text-[10px] pl-2">+{task.assignees.length - 3}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
