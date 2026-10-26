"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, ChevronLeft, ChevronRight, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTasksContext } from "../context/tasks-context";
import { TaskCard, TASK_DRAG_TYPE } from "./task-card";
import type { BoardColumn, Task, TaskStatus } from "../types";
import { STATUS_CONFIG, TASK_COLORS } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  columns: BoardColumn[];
  tasks: Task[];
  onColumnsChange: () => void;
}

/** Kanban board with the project's custom status columns. */
export function ProjectBoard({ projectId, columns, tasks, onColumnsChange }: Props) {
  const { updateTask, addTask, openTask } = useTasksContext();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState("");

  const api = (method: string, body?: unknown, qs = "") =>
    fetch(`/api/tasks/projects/${projectId}/columns${qs}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Failed"); return j; });

  // Tasks without a column (e.g. created before the board existed) fall into the first column of their status.
  const tasksFor = (col: BoardColumn) => tasks
    .filter((t) => t.board_column_id === col.id || (!columns.some((c) => c.id === t.board_column_id) && columns.find((c) => c.status_key === t.status)?.id === col.id))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.position - b.position);

  function onDrop(e: React.DragEvent, col: BoardColumn) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(TASK_DRAG_TYPE);
    const t = tasks.find((x) => x.id === id);
    if (t && t.board_column_id !== col.id) updateTask(id, { board_column_id: col.id });
  }

  async function run(p: Promise<unknown>, ok?: string) {
    try { await p; if (ok) toast.success(ok); onColumnsChange(); } catch (e) { toast.error((e as Error).message); }
  }

  function move(col: BoardColumn, dir: -1 | 1) {
    const order = columns.map((c) => c.id);
    const i = order.indexOf(col.id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    run(api("PATCH", { order }));
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 min-h-[60vh]">
      {columns.map((col, i) => {
        const list = tasksFor(col);
        return (
          <section
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); if (dragOver !== col.id) setDragOver(col.id); }}
            onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(e) => onDrop(e, col)}
            className={cn("flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 transition-colors", dragOver === col.id && "ring-2 ring-primary/40 bg-primary/5")}
          >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color ?? "#94a3b8" }} />
              {renaming === col.id ? (
                <Input
                  autoFocus defaultValue={col.name} className="h-7 text-sm"
                  onBlur={(e) => { setRenaming(null); if (e.target.value.trim() && e.target.value !== col.name) run(api("PATCH", { id: col.id, name: e.target.value })); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }}
                />
              ) : (
                <h3 className="flex-1 truncate text-sm font-semibold" onDoubleClick={() => setRenaming(col.id)}>{col.name}</h3>
              )}
              <span className="text-xs text-muted-foreground">{list.length}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setRenaming(col.id)}><Pencil className="h-3.5 w-3.5 mr-2" />Rename</DropdownMenuItem>
                  <DropdownMenuItem disabled={i === 0} onSelect={() => move(col, -1)}><ChevronLeft className="h-3.5 w-3.5 mr-2" />Move left</DropdownMenuItem>
                  <DropdownMenuItem disabled={i === columns.length - 1} onSelect={() => move(col, 1)}><ChevronRight className="h-3.5 w-3.5 mr-2" />Move right</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Counts as</DropdownMenuLabel>
                  {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((k) => (
                    <DropdownMenuItem key={k} onSelect={() => run(api("PATCH", { id: col.id, status_key: k }))}>
                      <span className={cn("h-2 w-2 rounded-full mr-2", STATUS_CONFIG[k].dot)} />{STATUS_CONFIG[k].label}{col.status_key === k && " ✓"}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                    {TASK_COLORS.map((c) => (
                      <button key={c} onClick={() => run(api("PATCH", { id: col.id, color: c }))} className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    disabled={columns.length <= 1}
                    onSelect={() => { if (window.confirm(`Delete "${col.name}"? Its tasks move to another status.`)) run(api("DELETE", undefined, `?column_id=${col.id}`), "Status deleted"); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />Delete status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            <div className="flex-1 space-y-1.5 px-2 pb-2">
              {list.map((t) => (
                <TaskCard key={t.id} task={t} hideProject onOpen={openTask} onToggleDone={(x) => updateTask(x.id, { status: x.status === "done" ? "todo" : "done" })} />
              ))}
              {adding === col.id ? (
                <Input
                  autoFocus className="h-8 text-sm" placeholder="Task name, Enter to add" value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTitle.trim()) { addTask({ title: newTitle.trim(), project_id: projectId, board_column_id: col.id }); setNewTitle(""); }
                    if (e.key === "Escape") { setAdding(null); setNewTitle(""); }
                  }}
                  onBlur={() => { if (newTitle.trim()) addTask({ title: newTitle.trim(), project_id: projectId, board_column_id: col.id }); setAdding(null); setNewTitle(""); }}
                />
              ) : (
                <button onClick={() => setAdding(col.id)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />Add task
                </button>
              )}
            </div>
          </section>
        );
      })}

      {/* New status column */}
      <div className="w-64 shrink-0">
        <Input
          placeholder="+ Add status" className="h-9 bg-muted/40" value={newColumn}
          onChange={(e) => setNewColumn(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newColumn.trim()) { run(api("POST", { name: newColumn.trim(), status_key: "in_progress" }), "Status added"); setNewColumn(""); } }}
        />
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">Press Enter. Use the column menu to set what it counts as.</p>
      </div>
    </div>
  );
}
