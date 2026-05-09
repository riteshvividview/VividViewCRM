"use client";

import { useState, useEffect } from "react";
import { X, Trash2, CalendarDays, User, Link2, CheckSquare, Square, Plus, Send, RefreshCw, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority, SubTask, TaskComment } from "../types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "../types";

const ASSIGNEES = [
  { id: "u1", name: "Alex Kumar" },
  { id: "u2", name: "Priya Singh" },
  { id: "u3", name: "Sam Tiwari" },
];

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailPanel({ task, open, onClose, onUpdate, onDelete }: TaskDetailPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const [addingSubTask, setAddingSubTask] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setComments([]);
    }
  }, [task?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!task) return null;

  function save(updates: Partial<Task>) { onUpdate(task!.id, updates); }

  function addSubTask() {
    if (!newSubTask.trim()) return;
    const st: SubTask = { id: crypto.randomUUID(), title: newSubTask.trim(), checked: false };
    save({ sub_tasks: [...task!.sub_tasks, st] });
    setNewSubTask("");
    setAddingSubTask(false);
  }

  function toggleSubTask(stId: string) {
    save({ sub_tasks: task!.sub_tasks.map((s) => s.id === stId ? { ...s, checked: !s.checked } : s) });
  }

  function removeSubTask(stId: string) {
    save({ sub_tasks: task!.sub_tasks.filter((s) => s.id !== stId) });
  }

  function addComment() {
    if (!comment.trim()) return;
    const c: TaskComment = { id: crypto.randomUUID(), task_id: task!.id, author: "You", content: comment.trim(), created_at: new Date().toISOString() };
    setComments((p) => [...p, c]);
    setComment("");
  }

  const completedSubTasks = task.sub_tasks.filter((s) => s.checked).length;

  return (
    <>
      <div
        className={cn("fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity duration-300", open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />
      <div className={cn("fixed right-0 top-0 h-full bg-background border-l border-border shadow-2xl z-50 flex flex-col w-[520px] transition-transform duration-300 ease-out", open ? "translate-x-0" : "translate-x-full")}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_CONFIG[task.status].dot)} />
            <span className={cn("text-xs font-medium", STATUS_CONFIG[task.status].color)}>{STATUS_CONFIG[task.status].label}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { onDelete(task.id); onClose(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            {/* Title */}
            {editingTitle ? (
              <Input
                className="text-xl font-bold h-auto py-1 px-2 -mx-2 border-0 ring-0 focus-visible:ring-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { save({ title }); setEditingTitle(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { save({ title }); setEditingTitle(false); } if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); } }}
                autoFocus
              />
            ) : (
              <h2 className="text-xl font-bold text-foreground cursor-text hover:bg-muted/40 rounded px-2 -mx-2 py-1" onClick={() => setEditingTitle(true)}>
                {task.title || "Untitled"}
              </h2>
            )}
          </div>

          {/* Properties */}
          <div className="px-5 space-y-1 pb-4 border-b border-border/50">
            {/* Status */}
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Status</span>
              <Select value={task.status} onValueChange={(v) => save({ status: v as TaskStatus })}>
                <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 w-auto gap-1 focus:ring-0">
                  <span className={cn("flex items-center gap-1.5", STATUS_CONFIG[task.status].color)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[task.status].dot)} />
                    {STATUS_CONFIG[task.status].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => (
                    <SelectItem key={s} value={s}><span className={cn("flex items-center gap-2", STATUS_CONFIG[s].color)}><span className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[s].dot)} />{STATUS_CONFIG[s].label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Priority</span>
              <Select value={task.priority} onValueChange={(v) => save({ priority: v as TaskPriority })}>
                <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 w-auto gap-1 focus:ring-0">
                  <span className={cn("flex items-center gap-1.5", PRIORITY_CONFIG[task.priority].color)}>
                    <Flag className="h-3 w-3" />{PRIORITY_CONFIG[task.priority].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}><span className={cn("flex items-center gap-2", PRIORITY_CONFIG[p].color)}><Flag className="h-3.5 w-3.5" />{PRIORITY_CONFIG[p].label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Due Date</span>
              <Input type="date" className="h-7 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 w-auto focus-visible:ring-0" value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Assignee</span>
              <Select value={task.assignee_id ?? ""} onValueChange={(v) => { const a = ASSIGNEES.find((a) => a.id === v); save({ assignee_id: v || null, assignee_name: a?.name ?? null }); }}>
                <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/40 px-2 w-auto gap-1 focus:ring-0">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {ASSIGNEES.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Linked entity */}
            {task.linked_entity_name && (
              <div className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />Linked To</span>
                <span className="text-xs text-foreground bg-muted px-2 py-1 rounded-lg">{task.linked_entity_name}</span>
              </div>
            )}

            {/* Recurring */}
            {task.recurring_pattern && (
              <div className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Recurring</span>
                <span className="text-xs text-foreground capitalize">{task.recurring_pattern}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
            <Textarea
              className="text-sm border-0 bg-transparent p-0 resize-none focus-visible:ring-0 min-h-[80px] placeholder:text-muted-foreground/40"
              placeholder="Add a description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save({ description })}
            />
          </div>

          {/* Sub-tasks */}
          <div className="px-5 py-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sub-tasks {task.sub_tasks.length > 0 && <span className="normal-case font-normal">({completedSubTasks}/{task.sub_tasks.length})</span>}
              </p>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => setAddingSubTask(true)}>
                <Plus className="h-3 w-3" />Add
              </Button>
            </div>
            {task.sub_tasks.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {task.sub_tasks.map((st) => (
                  <div key={st.id} className="group flex items-center gap-2">
                    <button onClick={() => toggleSubTask(st.id)}>
                      {st.checked
                        ? <CheckSquare className="h-4 w-4 text-purple-600 shrink-0" />
                        : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    <span className={cn("text-sm flex-1", st.checked && "line-through text-muted-foreground")}>{st.title}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => removeSubTask(st.id)}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {addingSubTask && (
              <div className="flex items-center gap-2 mt-1.5">
                <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  className="h-7 text-sm flex-1"
                  placeholder="Sub-task title…"
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") addSubTask(); if (e.key === "Escape") { setAddingSubTask(false); setNewSubTask(""); } }}
                  onBlur={() => { if (newSubTask.trim()) addSubTask(); else setAddingSubTask(false); }}
                />
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Comments</p>
            <div className="space-y-3 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {c.author[0]}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-foreground">{c.author} </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                placeholder="Write a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              />
              <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-white px-3" onClick={addComment} disabled={!comment.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
