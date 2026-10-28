"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-regular-svg-icons";
import { faPaperclip, faRepeat, faCheck } from "@fortawesome/free-solid-svg-icons";
import type { Task } from "../types";
import { cn } from "@/lib/utils";
import { cardColor, dueLabel, initials } from "../lib/bordio";
import { PriorityChip } from "./task-icons";

export const TASK_DRAG_TYPE = "application/x-vivid-task";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onToggleDone?: (task: Task) => void;
  /** Kept for API compatibility; Bordio cards never show the project. */
  hideProject?: boolean;
  /** Smaller card (team grid). */
  compact?: boolean;
  draggable?: boolean;
}

/**
 * Bordio card: solid type-coloured card (red when overdue, grey when done) with
 * an assignee initials badge, bold title, priority chip, due text and
 * comment / attachment counters.
 */
export function TaskCard({ task, onOpen, onToggleDone, compact, draggable = true }: TaskCardProps) {
  const done = task.status === "done";
  const bg = cardColor(task);
  const due = dueLabel(task);
  const assignee = task.assignees[0];

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
        "group relative cursor-pointer select-none rounded-[10px] text-white shadow-sm transition-[transform,box-shadow,filter]",
        "hover:shadow-md hover:brightness-110 active:scale-[0.99]",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        done && "text-white/70",
      )}
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-start gap-2">
        <span
          title={assignee?.full_name ?? "Unassigned"}
          className={cn(
            "mt-px flex shrink-0 items-center justify-center rounded-full bg-black/25 font-semibold tracking-wide text-white/90",
            compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]",
          )}
        >
          {initials(assignee?.full_name)}
        </span>
        <p className={cn("flex-1 break-words font-semibold leading-snug", compact ? "text-[12px]" : "text-[13px]", done && "font-medium")}>
          {task.title}
        </p>
        {onToggleDone && (
          <button
            aria-label={done ? "Mark as not done" : "Mark as done"}
            onClick={(e) => { e.stopPropagation(); onToggleDone(task); }}
            className={cn(
              "mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-white/50 transition-opacity",
              done ? "bg-white/25 opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-white/20",
            )}
          >
            <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {!compact && !done && task.priority !== "none" && <PriorityChip priority={task.priority} className="mt-2" />}

      {(due || task.comment_count > 0 || task.attachment_count > 0 || task.recurring_pattern) && (
        <div className={cn("flex items-center gap-2.5 text-white/75", compact ? "mt-1.5 text-[10px]" : "mt-2 text-[11.5px]")}>
          {due && <span className="truncate">{due}</span>}
          <span className="ml-auto flex items-center gap-2.5">
            {task.recurring_pattern && <FontAwesomeIcon icon={faRepeat} className="h-3 w-3" title="Repeats" />}
            {task.comment_count > 0 && (
              <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faComment} className="h-3 w-3" />{task.comment_count}</span>
            )}
            {task.attachment_count > 0 && (
              <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faPaperclip} className="h-3 w-3" />{task.attachment_count}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
