"use client";

import { useEffect, useRef, useState } from "react";
import { X, Flag, CalendarDays, User, FolderKanban, CalendarClock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskPriority, TaskMember, TaskTeam, TaskProjectListItem } from "../types";
import { PRIORITY_CONFIG } from "../types";
import { AssigneePicker } from "./assignee-picker";
import type { AddTaskInput } from "../hooks/use-tasks";
import { cn } from "@/lib/utils";

interface QuickAddTaskProps {
  open: boolean;
  onClose: () => void;
  onAdd: (t: AddTaskInput) => void | Promise<void>;
  members: TaskMember[];
  teams: TaskTeam[];
  projects: TaskProjectListItem[];
  /** Pre-filled values, e.g. the planner day or project the user added from. */
  defaults?: Partial<AddTaskInput>;
}

const NONE = "__none__";

export function QuickAddTask({ open, onClose, onAdd, members, teams, projects, defaults = {} }: QuickAddTaskProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [estimate, setEstimate] = useState("");
  const [assignees, setAssignees] = useState<TaskMember[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority((defaults.priority as TaskPriority) ?? "medium");
      setDueDate(defaults.due_date ?? "");
      setPlannedDate(defaults.planned_date ?? "");
      setProjectId(defaults.project_id ?? "");
      setEstimate("");
      setAssignees(members.filter((m) => defaults.assignee_ids?.includes(m.id)));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function addUsers(userIds: string[]) {
    setAssignees((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      return [...prev, ...members.filter((m) => userIds.includes(m.id) && !existing.has(m.id))];
    });
  }

  async function handleSubmit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onAdd({
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      planned_date: plannedDate || null,
      project_id: projectId || null,
      board_column_id: defaults.board_column_id ?? null,
      estimated_hours: estimate ? Number(estimate) : null,
      assignee_ids: assignees.map((m) => m.id),
    });
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 pt-24 sm:pt-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground">New task</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <Input
            ref={inputRef}
            className="h-11 text-base"
            placeholder="What needs to be done?"
            value={title}
            maxLength={500}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="relative">
              <CalendarClock className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input type="date" title="Planned for" className="h-8 text-xs pl-7" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
              <span className="absolute right-8 top-2 text-[10px] text-muted-foreground pointer-events-none">{plannedDate ? "" : "Plan"}</span>
            </label>
            <label className="relative">
              <CalendarDays className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input type="date" title="Due date" className="h-8 text-xs pl-7" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <span className="absolute right-8 top-2 text-[10px] text-muted-foreground pointer-events-none">{dueDate ? "" : "Due"}</span>
            </label>
            <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <span className="flex items-center gap-1.5 truncate"><FolderKanban className="h-3.5 w-3.5 text-muted-foreground" /><SelectValue placeholder="No project" /></span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color ?? "#6366f1" }} />{p.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="h-8 text-xs">
                <span className={cn("flex items-center gap-1.5", PRIORITY_CONFIG[priority].color)}><Flag className="h-3 w-3" />{PRIORITY_CONFIG[priority].label}</span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}><span className={cn("flex items-center gap-2", PRIORITY_CONFIG[p].color)}><Flag className="h-3.5 w-3.5" />{PRIORITY_CONFIG[p].label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Clock className="h-3.5 w-3.5" />Estimate</span>
            <Input type="number" min="0" step="0.25" placeholder="hours" className="h-8 w-24 text-xs" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><User className="h-3.5 w-3.5" />Assign</span>
            <AssigneePicker
              value={assignees} members={members} teams={teams}
              onAddUsers={addUsers}
              onAddTeam={(teamId) => addUsers(teams.find((t) => t.id === teamId)?.member_ids ?? [])}
              onRemove={(userId) => setAssignees((prev) => prev.filter((m) => m.id !== userId))}
            />
            {assignees.length === 0 && <span className="text-[11px] text-muted-foreground">Defaults to you</span>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || saving}>{saving ? "Adding…" : "Add task"}</Button>
          </div>
        </div>
        <div className="px-4 pb-3 border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to save · <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to cancel · <kbd className="px-1 py-0.5 bg-muted rounded">T</kbd> anywhere to add a task
          </p>
        </div>
      </div>
    </div>
  );
}
