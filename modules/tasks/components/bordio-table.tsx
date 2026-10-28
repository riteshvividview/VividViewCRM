"use client";

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-regular-svg-icons";
import { faPaperclip, faChevronDown, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { BoardColumn, Task } from "../types";
import { STATUS_CONFIG } from "../types";
import { dueLabel, isOverdue, initials } from "../lib/bordio";
import { PriorityLabel, StatusIcon } from "./task-icons";
import { formatMinutes } from "../dates";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  /** Project status columns (for custom status names); omit for base statuses. */
  columns?: BoardColumn[];
  onOpen: (task: Task) => void;
  onCreate: () => void;
  selectedId?: string | null;
}

function Group({ title, count, tasks, columns, onOpen, onCreate, selectedId, defaultOpen = true }: {
  title: string; count: number; tasks: Task[]; columns?: BoardColumn[]; onOpen: (t: Task) => void; onCreate?: () => void; selectedId?: string | null; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colName = (t: Task) => columns?.find((c) => c.id === t.board_column_id)?.name ?? STATUS_CONFIG[t.status].label;
  return (
    <div className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-2 py-2 text-[15px] font-semibold">
        <FontAwesomeIcon icon={faChevronDown} className={cn("h-3 w-3 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        {title}<span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{count}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pl-9 font-normal">Task</th>
                <th className="w-40 py-2 font-normal">Status</th>
                <th className="w-36 py-2 font-normal">Type</th>
                <th className="w-28 py-2 font-normal">Assignee</th>
                <th className="w-36 py-2 font-normal">Due date</th>
                <th className="w-24 py-2 font-normal">Priority</th>
                <th className="w-24 py-2 pr-3 font-normal">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const due = dueLabel(t);
                return (
                  <tr key={t.id} onClick={() => onOpen(t)} className={cn("cursor-pointer border-b border-border/50 hover:bg-muted/50", selectedId === t.id && "bg-muted")}>
                    <td className="py-2.5 pl-9 pr-3">
                      <span className={cn("font-medium", t.status === "done" && "text-muted-foreground")}>{t.title}</span>
                      {t.comment_count > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><FontAwesomeIcon icon={faComment} className="h-3 w-3" />{t.comment_count}</span>}
                      {t.attachment_count > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><FontAwesomeIcon icon={faPaperclip} className="h-3 w-3" />{t.attachment_count}</span>}
                    </td>
                    <td className="py-2.5"><span className="inline-flex items-center gap-1.5"><StatusIcon status={t.status} /><span className="truncate">{colName(t)}</span></span></td>
                    <td className="py-2.5">
                      {t.type ? <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: t.type.color }} />{t.type.name}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5">
                      <span className="flex -space-x-1.5">
                        {t.assignees.slice(0, 3).map((a) => (
                          <span key={a.id} title={a.full_name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold">{initials(a.full_name)}</span>
                        ))}
                        {t.assignees.length === 0 && <span className="text-muted-foreground">—</span>}
                      </span>
                    </td>
                    <td className={cn("py-2.5", isOverdue(t) && "text-red-500")}>
                      {t.due_date ? new Date(`${t.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : <span className="text-muted-foreground">—</span>}
                      {due && t.due_date && <span className="ml-1.5 text-xs opacity-80">{due.replace("Due ", "")}</span>}
                    </td>
                    <td className="py-2.5"><PriorityLabel priority={t.priority} className={t.priority === "none" ? "text-muted-foreground" : ""} /></td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{t.estimated_hours ? formatMinutes(t.estimated_hours * 60) : "0h"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {onCreate && (
            <button onClick={onCreate} className="ml-9 mt-1.5 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">
              <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Create task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Bordio table view: Open tasks / Closed tasks groups. */
export function BordioTable({ tasks, columns, onOpen, onCreate, selectedId }: Props) {
  const { open, closed } = useMemo(() => ({
    open: tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    closed: tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  }), [tasks]);
  return (
    <div>
      <Group title="Open tasks" count={open.length} tasks={open} columns={columns} onOpen={onOpen} onCreate={onCreate} selectedId={selectedId} />
      <Group title="Closed tasks" count={closed.length} tasks={closed} columns={columns} onOpen={onOpen} selectedId={selectedId} defaultOpen={closed.length <= 50} />
    </div>
  );
}
