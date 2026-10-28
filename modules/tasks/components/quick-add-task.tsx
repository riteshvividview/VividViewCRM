"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faClock, faSquare } from "@fortawesome/free-regular-svg-icons";
import { faArrowsRotate, faListCheck, faPaperclip, faXmark, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { TaskPriority, TaskMember, TaskTeam, TaskProjectListItem, TaskType, TaskLabel, BoardColumn, RecurringPattern, TaskStatus, Task } from "../types";
import { RECURRING_OPTIONS, STATUS_CONFIG } from "../types";
import { AssigneePicker } from "./assignee-picker";
import { TagPicker, TagChips } from "./tag-picker";
import { RichTextEditor } from "./rich-text-editor";
import type { AddTaskInput } from "../hooks/use-tasks";
import { initials } from "../lib/bordio";
import { PriorityLabel } from "./task-icons";
import { todayISO } from "../dates";
import { cn } from "@/lib/utils";

interface QuickAddTaskProps {
  open: boolean;
  onClose: () => void;
  onAdd: (t: AddTaskInput) => Promise<Task | null | void>;
  members: TaskMember[];
  teams: TaskTeam[];
  projects: TaskProjectListItem[];
  types?: TaskType[];
  labels?: TaskLabel[];
  currentUserId?: string | null;
  defaults?: Partial<AddTaskInput>;
  onLabelCreated?: (label: TaskLabel) => void;
}

const NONE = "__none__";
const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const trigger = "h-8 w-full justify-start gap-2 border-0 bg-transparent px-1 text-[13px] font-medium hover:bg-muted focus:ring-0 [&>svg:last-child]:hidden";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-0.5 text-xs text-muted-foreground">{label}</p>{children}</div>;
}

/** Bordio "Create task" dialog (also opened by the T shortcut). */
export function QuickAddTask({ open, onClose, onAdd, members, teams, projects, types = [], labels = [], currentUserId, defaults = {}, onLabelCreated }: QuickAddTaskProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [columnId, setColumnId] = useState("");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [assignees, setAssignees] = useState<TaskMember[]>([]);
  const [planned, setPlanned] = useState<string>("");
  const [estimate, setEstimate] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [repeat, setRepeat] = useState<string>("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subInput, setSubInput] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset everything whenever the dialog opens or closes, so nothing leaks into the next task.
  useEffect(() => {
    if (!open) { setAssignees([]); setLabelIds([]); setFiles([]); setSubtasks([]); return; }
    setTitle(""); setDescription(""); setEstimate(""); setRepeat(""); setSubtasks([]); setSubInput(null); setLabelIds([]); setFiles([]);
    setProjectId(defaults.project_id ?? "");
    setTypeId(defaults.type_id ?? "");
    setColumnId(defaults.board_column_id ?? "");
    setStatus((defaults.status as TaskStatus) ?? "todo");
    setPlanned(defaults.planned_date === undefined ? todayISO() : defaults.planned_date ?? "");
    setDue(defaults.due_date ?? "");
    setPriority((defaults.priority as TaskPriority) ?? "none");
    // Every new task starts unassigned unless the caller pre-selects someone (e.g. a Team row).
    setAssignees(defaults.assignee_ids?.length ? members.filter((m) => defaults.assignee_ids!.includes(m.id)) : []);
    setTimeout(() => titleRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setColumns([]);
    if (!projectId) return;
    fetch(`/api/tasks/projects/${projectId}`).then((r) => r.json()).then((j) => {
      setColumns(j.columns ?? []);
      setColumnId((cur) => (j.columns ?? []).some((c: BoardColumn) => c.id === cur) ? cur : j.columns?.[0]?.id ?? "");
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const created = await onAdd({
      title: title.trim(),
      description,
      project_id: projectId || null,
      board_column_id: projectId ? columnId || null : null,
      status: projectId ? undefined : status,
      type_id: typeId || null,
      planned_date: planned || null,
      due_date: due || null,
      priority,
      estimated_hours: estimate ? Number(estimate) : null,
      recurring_pattern: (repeat || null) as RecurringPattern,
      sub_tasks: subtasks.map((t) => ({ id: crypto.randomUUID(), title: t, checked: false })),
      label_ids: labelIds,
      assignee_ids: assignees.map((m) => m.id),
      assign_to_me: false,
    });
    if (created && files.length) {
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      const res = await fetch(`/api/tasks/${created.id}/attachments`, { method: "POST", body: form });
      if (!res.ok) toast.error("Task created, but files could not be uploaded");
    }
    setSaving(false);
    if (created !== null) { setAssignees([]); setLabelIds([]); onClose(); }
  }

  if (!open) return null;
  const type = types.find((t) => t.id === typeId);
  const column = columns.find((c) => c.id === columnId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[6vh]" onClick={onClose}>
      <div className="flex w-full max-w-[880px] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col p-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-bold">Create task</h2>
            <Select value={repeat || NONE} onValueChange={(v) => setRepeat(v === NONE ? "" : v)}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-[13px] text-muted-foreground hover:bg-muted focus:ring-0 [&>svg:last-child]:hidden">
                <FontAwesomeIcon icon={faArrowsRotate} className="h-3.5 w-3.5" />{RECURRING_OPTIONS.find((o) => o.value === repeat)?.label ?? "Set repeats"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Does not repeat</SelectItem>
                {RECURRING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={titleRef} value={title} maxLength={500} placeholder="Task name"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            className="mb-3 h-11 w-full rounded-lg border bg-background px-3 text-[15px] font-medium focus:border-primary/60 focus:outline-none"
          />
          <RichTextEditor value={description} onChange={setDescription} placeholder="Add a description…" minHeight={160} />

          {subtasks.length > 0 && (
            <div className="mt-3 space-y-1">
              {subtasks.map((s, i) => (
                <div key={i} className="group flex items-center gap-2 text-[13px]">
                  <FontAwesomeIcon icon={faSquare} className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{s}</span>
                  <button className="opacity-0 group-hover:opacity-60" onClick={() => setSubtasks((x) => x.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          {subInput !== null && (
            <input autoFocus value={subInput} placeholder="Subtask name, Enter to add"
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && subInput.trim()) { setSubtasks((x) => [...x, subInput.trim()]); setSubInput(""); } if (e.key === "Escape") setSubInput(null); }}
              onBlur={() => { if (subInput.trim()) setSubtasks((x) => [...x, subInput.trim()]); setSubInput(null); }}
              className="mt-2 h-8 w-full rounded-md border bg-background px-2 text-[13px] focus:outline-none" />
          )}
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs">
                  <FontAwesomeIcon icon={faPaperclip} className="h-3 w-3" />{f.name}
                  <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          {labelIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TagChips labels={labels.filter((l) => labelIds.includes(l.id))} onRemove={(id) => setLabelIds((x) => x.filter((y) => y !== id))} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => setSubInput("")}><FontAwesomeIcon icon={faListCheck} className="h-3.5 w-3.5" />Add subtask</Button>
            <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => fileRef.current?.click()}><FontAwesomeIcon icon={faPaperclip} className="h-3.5 w-3.5" />Attach file</Button>
            <TagPicker
              labels={labels} selectedIds={labelIds}
              onToggle={(id, on) => setLabelIds((x) => (on ? (x.includes(id) ? x : [...x, id]) : x.filter((y) => y !== id)))}
              onCreated={(l) => onLabelCreated?.(l)}
            />
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) setFiles((x) => [...x, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 border-t pt-5 md:mt-8">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button className="bg-sky-500 px-6 text-white hover:bg-sky-600" onClick={submit} disabled={!title.trim() || saving}>
              {saving && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Create task
            </Button>
          </div>
        </div>

        {/* Right: properties */}
        <div className="w-full shrink-0 space-y-3 border-t bg-muted/20 p-6 md:w-[260px] md:border-l md:border-t-0">
          <Field label="Create in">
            <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
              <SelectTrigger className={trigger}>
                {projectId ? <><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{initials(projects.find((p) => p.id === projectId)?.name)}</span>{projects.find((p) => p.id === projectId)?.name}</> : "My tasks (no project)"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>My tasks (no project)</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={typeId || NONE} onValueChange={(v) => setTypeId(v === NONE ? "" : v)}>
              <SelectTrigger className={trigger}>{type ? <><span className="h-4 w-4 rounded" style={{ backgroundColor: type.color }} />{type.name}</> : "No type"}</SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No type</SelectItem>
                {types.map((t) => <SelectItem key={t.id} value={t.id}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ backgroundColor: t.color }} />{t.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            {columns.length > 0 ? (
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger className={trigger}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column?.color ?? "#94a3b8" }} />{column?.name}</SelectTrigger>
                <SelectContent>{columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className={trigger}><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_CONFIG[status].dot)} />{STATUS_CONFIG[status].label}</SelectTrigger>
                <SelectContent>{(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Assignee">
            <div className="flex items-center gap-2 px-1">
              <AssigneePicker value={assignees} members={members} teams={teams}
                onAddUsers={(ids) => setAssignees((p) => [...p, ...members.filter((m) => ids.includes(m.id) && !p.some((x) => x.id === m.id))])}
                onAddTeam={(tid) => { const t = teams.find((x) => x.id === tid); if (t) setAssignees((p) => [...p, ...members.filter((m) => t.member_ids.includes(m.id) && !p.some((x) => x.id === m.id))]); }}
                onRemove={(id) => setAssignees((p) => p.filter((m) => m.id !== id))} />
              {assignees.length === 0 && <span className="text-[13px] text-muted-foreground">Unassigned</span>}
            </div>
          </Field>
          <Field label="Schedule this task for">
            <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-1 text-[13px] font-medium hover:bg-muted">
              <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} className="flex-1 bg-transparent focus:outline-none" />
            </label>
            <button className="px-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setPlanned("")}>
              {planned ? (planned === todayISO() ? "Today · " : "") + "Move to waiting list" : "In waiting list"}
            </button>
          </Field>
          <Field label="Estimated time">
            <label className="flex h-8 items-center gap-2 rounded px-1 text-[13px] font-medium hover:bg-muted">
              <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="number" min={0} step={0.25} placeholder="0" value={estimate} onChange={(e) => setEstimate(e.target.value)} className="w-14 bg-transparent focus:outline-none" />h
            </label>
          </Field>
          <Field label="Due date">
            <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-1 text-[13px] font-medium hover:bg-muted">
              <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1 bg-transparent focus:outline-none" />
            </label>
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className={trigger}><PriorityLabel priority={priority} /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}><PriorityLabel priority={p} /></SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Reporter">
            <span className="flex h-8 items-center gap-2 px-1 text-[13px] font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{initials(members.find((m) => m.id === currentUserId)?.full_name)}</span>Me
            </span>
          </Field>
        </div>
      </div>
    </div>
  );
}
