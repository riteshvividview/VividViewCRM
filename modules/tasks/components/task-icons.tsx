"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesUp, faAngleUp, faEquals, faAngleDown, faMinus,
  faEnvelope, faScrewdriverWrench, faPause, faSquareCheck,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { TaskPriority, TaskStatus } from "../types";
import { cn } from "@/lib/utils";

export const PRIORITY_META: Record<TaskPriority, { label: string; icon: IconDefinition; color: string }> = {
  urgent: { label: "Urgent", icon: faAnglesUp, color: "text-red-500" },
  high: { label: "High", icon: faAngleUp, color: "text-orange-500" },
  medium: { label: "Medium", icon: faEquals, color: "text-amber-500" },
  low: { label: "Low", icon: faAngleDown, color: "text-sky-500" },
  none: { label: "None", icon: faMinus, color: "text-muted-foreground" },
};

export const STATUS_ICON: Record<TaskStatus, { icon: IconDefinition; color: string }> = {
  todo: { icon: faEnvelope, color: "text-slate-400" },
  in_progress: { icon: faScrewdriverWrench, color: "text-sky-500" },
  waiting: { icon: faPause, color: "text-amber-500" },
  done: { icon: faSquareCheck, color: "text-emerald-500" },
};

/** Priority icon + label (e.g. in selects and the task view). */
export function PriorityLabel({ priority, className, iconOnly }: { priority: TaskPriority; className?: string; iconOnly?: boolean }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.none;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <FontAwesomeIcon icon={m.icon} className={cn("h-3 w-3", m.color)} />
      {!iconOnly && m.label}
    </span>
  );
}

/** Priority chip shown on cards (white-on-colour). */
export function PriorityChip({ priority, className }: { priority: TaskPriority; className?: string }) {
  if (priority === "none") return null;
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-white/20 px-1.5 py-[1px] text-[11px] font-medium", className)}>
      <FontAwesomeIcon icon={m.icon} className="h-2.5 w-2.5" />{m.label}
    </span>
  );
}

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const s = STATUS_ICON[status] ?? STATUS_ICON.todo;
  return <FontAwesomeIcon icon={s.icon} className={cn("h-3.5 w-3.5", s.color, className)} />;
}
