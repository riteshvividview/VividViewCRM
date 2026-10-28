"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { TaskCard, TASK_DRAG_TYPE } from "./task-card";
import type { Task, TaskStatus } from "../types";
import { StatusIcon } from "./task-icons";
import { cn } from "@/lib/utils";

export interface KanbanColumn {
  id: string;
  name: string;
  status_key: TaskStatus;
  /** Optional header menu (rename, recolour…), rendered next to the count. */
  menu?: React.ReactNode;
}

interface Props {
  columns: KanbanColumn[];
  /** Which column a task belongs to. */
  columnOf: (task: Task) => string;
  tasks: Task[];
  onMove: (task: Task, column: KanbanColumn) => void;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onAdd: (column: KanbanColumn) => void;
  /** Extra column at the end (e.g. "+ Add status"). */
  trailing?: React.ReactNode;
}

/** Bordio kanban: centered headers with status icon + count, type-coloured cards, drag between columns. */
export function BordioKanban({ columns, columnOf, tasks, onMove, onOpen, onToggleDone, onAdd, trailing }: Props) {
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-[60vh] gap-0 overflow-x-auto pb-2">
      {columns.map((col) => {
        const list = tasks
          .filter((t) => columnOf(t) === col.id)
          .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.position - b.position);
        return (
          <section
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col.id) setOver(col.id); }}
            onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const t = tasks.find((x) => x.id === e.dataTransfer.getData(TASK_DRAG_TYPE));
              if (t && columnOf(t) !== col.id) onMove(t, col);
            }}
            className={cn("group/col flex w-[262px] shrink-0 flex-col border-r border-border/60 px-2.5 transition-colors last:border-r-0", over === col.id && "bg-primary/5")}
          >
            <header className="relative flex h-12 items-center justify-center gap-2 border-b border-border/60 text-[13px] font-semibold">
              <StatusIcon status={col.status_key} />
              <span className="truncate">{col.name}</span>
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{list.length > 999 ? "999+" : list.length}</span>
              {col.menu && <span className="absolute right-0 opacity-0 transition-opacity group-hover/col:opacity-100">{col.menu}</span>}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto py-2.5">
              {list.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggleDone={onToggleDone} />)}
              <button
                onClick={() => onAdd(col)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/col:opacity-100"
              >
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Add task
              </button>
            </div>
          </section>
        );
      })}
      {trailing}
    </div>
  );
}
