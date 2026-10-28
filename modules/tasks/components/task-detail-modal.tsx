"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faClock, faCircleCheck as faCircleCheckRegular, faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import {
  faXmark, faEllipsis, faLink, faListCheck, faPaperclip, faStopwatch, faHourglassHalf, faStop,
  faTrashCan, faCopy, faAlignLeft, faPlus, faArrowsRotate, faFolder, faTag, faCalendarDay,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Task, TaskStatus, TaskPriority, SubTask, TaskMember, TaskTeam, TaskLabel, TaskProjectListItem, BoardColumn, RecurringPattern, TaskType } from "../types";
import { STATUS_CONFIG, RECURRING_OPTIONS } from "../types";
import { AssigneePicker, AssigneeAvatar } from "./assignee-picker";
import { TagPicker, TagChips } from "./tag-picker";
import { RichTextEditor } from "./rich-text-editor";
import { TaskAttachments } from "./task-attachments";
import { TaskChat } from "./task-chat";
import { TaskScheduledWork, type TimeEntry } from "./task-scheduled-work";
import { TypeManagerDialog } from "./type-manager";
import { overdueText, taskKey } from "../lib/bordio";
import { PriorityLabel } from "./task-icons";
import { formatMinutes } from "../dates";
import { cn } from "@/lib/utils";

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (task: Task) => void;
  members: TaskMember[];
  teams: TaskTeam[];
  labels: TaskLabel[];
  types: TaskType[];
  projects: TaskProjectListItem[];
  currentUserId: string | null;
  onTypesChange: () => void;
  onAddAssignees: (id: string, payload: { user_ids?: string[]; team_id?: string }) => void;
  onRemoveAssignee: (id: string, userId: string) => void;
  onAddLabel: (id: string, labelId: string) => void;
  onRemoveLabel: (id: string, labelId: string) => void;
  onLabelCreated: (label: TaskLabel) => void;
}

const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const trigger = "h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-[13px] font-medium hover:bg-muted focus:ring-0 [&>svg:last-child]:hidden";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center">
      <span className="w-36 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

const fmtClock = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Bordio task view: details on the left, chat on the right. */
export function TaskDetailModal(props: Props) {
  const { task, open, onClose, onUpdate, onDelete, onDuplicate, members, teams, labels, types, projects, currentUserId } = props;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [newSub, setNewSub] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
  const taskId = task?.id ?? null;
  const projectId = task?.project_id ?? null;

  useEffect(() => { setTitle(task?.title ?? ""); setDescription(task?.description ?? ""); }, [taskId, task?.title, task?.description]);

  useEffect(() => {
    setColumns([]);
    if (!projectId) return;
    fetch(`/api/tasks/projects/${projectId}`).then((r) => r.json()).then((j) => setColumns(j.columns ?? [])).catch(() => {});
  }, [projectId]);

  const loadTime = useCallback(async () => {
    if (!taskId) return;
    const res = await fetch(`/api/tasks/${taskId}/time`);
    if (res.ok) setEntries((await res.json()).entries ?? []);
  }, [taskId]);
  useEffect(() => { setEntries([]); loadTime(); }, [loadTime]);

  const running = entries.find((e) => !e.ended_at && e.user_id === currentUserId);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open && !logOpen && !typesOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, logOpen, typesOpen]);

  if (!task || !open) return null;
  const save = (u: Partial<Task>) => onUpdate(task.id, u);

  async function timer(action: "start" | "stop") {
    const res = await fetch(`/api/tasks/${task!.id}/time`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) { toast.error((await res.json()).error ?? "Timer failed"); return; }
    setNow(Date.now());
    loadTime();
    if (action === "stop") toast.success("Time logged");
  }

  function addSub() {
    if (!newSub?.trim()) { setNewSub(null); return; }
    const st: SubTask = { id: crypto.randomUUID(), title: newSub.trim(), checked: false };
    save({ sub_tasks: [...task!.sub_tasks, st] });
    setNewSub("");
  }

  const key = taskKey(task);
  const overdue = overdueText(task);
  const column = columns.find((c) => c.id === task.board_column_id);
  const subDone = task.sub_tasks.filter((s) => s.checked).length;
  const elapsed = running ? Math.max(0, Math.floor((now - new Date(running.started_at).getTime()) / 1000)) : 0;
  const totalLogged = entries.filter((e) => e.ended_at).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-3 right-3 left-3 z-50 mx-auto flex max-w-[1240px] overflow-hidden rounded-xl border bg-background shadow-2xl lg:inset-y-6">
        {/* ── Details ─────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6 text-[13px] text-muted-foreground">
            <span className="truncate">Vivid View</span>
            {task.project && <><span>/</span><span className="truncate">{task.project.name}</span></>}
            {key && <><span>/</span><span className="font-medium text-foreground">{key}</span></>}
            <div className="ml-auto flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-2 hover:bg-muted hover:text-foreground" aria-label="More"><FontAwesomeIcon icon={faEllipsis} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onDuplicate(task)}><FontAwesomeIcon icon={faCopy} className="mr-2 h-3.5 w-3.5" />Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => { if (window.confirm("Delete this task?")) { onDelete(task.id); onClose(); } }}>
                    <FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button className="rounded p-2 hover:bg-muted hover:text-foreground" title="Copy link" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/dashboard/actions/tasks?task=${task.id}`);
                toast.success("Link copied");
              }}><FontAwesomeIcon icon={faLink} /></button>
              <button className="rounded p-2 hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 pt-5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== task.title) save({ title: title.trim() }); else setTitle(task.title); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-full bg-transparent text-[22px] font-bold leading-tight focus:outline-none"
              />

              <div className="mt-4 space-y-0.5">
                <Row label="Status">
                  {columns.length > 0 ? (
                    <Select value={task.board_column_id ?? ""} onValueChange={(v) => save({ board_column_id: v })}>
                      <SelectTrigger className={trigger}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column?.color ?? "#94a3b8" }} />{column?.name ?? STATUS_CONFIG[task.status].label}
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color ?? "#94a3b8" }} />{c.name}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={task.status} onValueChange={(v) => save({ status: v as TaskStatus })}>
                      <SelectTrigger className={trigger}><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_CONFIG[task.status].dot)} />{STATUS_CONFIG[task.status].label}</SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </Row>
                <Row label="Type">
                  <Select value={task.type_id ?? "__none__"} onValueChange={(v) => { if (v === "__manage__") setTypesOpen(true); else save({ type_id: v === "__none__" ? null : v }); }}>
                    <SelectTrigger className={trigger}>
                      {task.type ? <><span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: task.type.color }} />{task.type.name}</> : <span className="text-muted-foreground">No type</span>}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No type</SelectItem>
                      {types.map((t) => <SelectItem key={t.id} value={t.id}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ backgroundColor: t.color }} />{t.name}</span></SelectItem>)}
                      <SelectSeparator />
                      <SelectItem value="__manage__">Manage types…</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Due date">
                  <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-medium hover:bg-muted">
                    <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
                    <input type="date" className="bg-transparent focus:outline-none" value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
                    {overdue && <span className="font-normal text-red-500">({overdue})</span>}
                  </label>
                </Row>
                <Row label="Scheduled for">
                  <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-medium hover:bg-muted">
                    <FontAwesomeIcon icon={faCalendarDay} className="h-3.5 w-3.5 text-muted-foreground" />
                    <input type="date" className="bg-transparent focus:outline-none" value={task.planned_date ?? ""} onChange={(e) => save({ planned_date: e.target.value || null })} />
                    {!task.planned_date && <span className="font-normal text-muted-foreground">Waiting list</span>}
                  </label>
                </Row>
                <Row label="Assignee">
                  <div className="px-2">
                    <AssigneePicker value={task.assignees} members={members} teams={teams}
                      onAddUsers={(ids) => props.onAddAssignees(task.id, { user_ids: ids })}
                      onAddTeam={(t) => props.onAddAssignees(task.id, { team_id: t })}
                      onRemove={(u) => props.onRemoveAssignee(task.id, u)} />
                  </div>
                </Row>
                <Row label="Reporter">
                  <span className="flex items-center gap-2 px-2 text-[13px] font-medium">
                    {task.reporter ? <><AssigneeAvatar member={task.reporter} size="xs" />{task.reporter.id === currentUserId ? "Me" : task.reporter.full_name}</> : "—"}
                  </span>
                </Row>
                <Row label="Estimated time">
                  <label className="flex h-8 items-center gap-2 rounded px-2 text-[13px] font-medium hover:bg-muted">
                    <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-muted-foreground" />
                    <input type="number" min={0} step={0.25} placeholder="0" className="w-14 bg-transparent focus:outline-none"
                      defaultValue={task.estimated_hours ?? ""} key={`est-${task.id}-${task.estimated_hours}`}
                      onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== task.estimated_hours) save({ estimated_hours: v }); }} />h
                    {totalLogged > 0 && <span className="font-normal text-muted-foreground">· {formatMinutes(totalLogged)} logged</span>}
                  </label>
                </Row>
                <Row label="Priority">
                  <Select value={task.priority} onValueChange={(v) => save({ priority: v as TaskPriority })}>
                    <SelectTrigger className={trigger}>
                      <PriorityLabel priority={task.priority} />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}><PriorityLabel priority={p} /></SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Project">
                  <Select value={task.project_id ?? "__none__"} onValueChange={(v) => save({ project_id: v === "__none__" ? null : v })}>
                    <SelectTrigger className={trigger}>
                      <FontAwesomeIcon icon={faFolder} className="h-3.5 w-3.5" style={{ color: task.project?.color ?? undefined }} />{task.project?.name ?? "No project"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Repeats">
                  <Select value={task.recurring_pattern ?? "__none__"} onValueChange={(v) => save({ recurring_pattern: v === "__none__" ? null : (v as RecurringPattern) })}>
                    <SelectTrigger className={trigger}>
                      <FontAwesomeIcon icon={faArrowsRotate} className="h-3.5 w-3.5 text-muted-foreground" />
                      {RECURRING_OPTIONS.find((o) => o.value === task.recurring_pattern)?.label ?? "Does not repeat"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Does not repeat</SelectItem>
                      {RECURRING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Tags">
                  <div className="flex flex-wrap items-center gap-1.5 px-2">
                    <TagChips labels={task.labels} onRemove={(l) => props.onRemoveLabel(task.id, l)} />
                    <TagPicker
                      labels={labels} selectedIds={task.labels.map((l) => l.id)}
                      onToggle={(id, on) => (on ? props.onAddLabel(task.id, id) : props.onRemoveLabel(task.id, id))}
                      onCreated={props.onLabelCreated}
                      button={<><FontAwesomeIcon icon={faTag} className="h-3 w-3" />{task.labels.length ? "Edit" : "Add tag"}</>}
                    />
                  </div>
                </Row>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2 pb-5">
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => setNewSub("")}><FontAwesomeIcon icon={faListCheck} className="h-3.5 w-3.5" />Add subtask</Button>
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => attachRef.current?.querySelector<HTMLInputElement>("input[type=file]")?.click()}>
                  <FontAwesomeIcon icon={faPaperclip} className="h-3.5 w-3.5" />Attach file
                </Button>
                {running ? (
                  <Button size="sm" className="h-8 gap-1.5 bg-red-600 text-[13px] text-white hover:bg-red-700" onClick={() => timer("stop")}>
                    <FontAwesomeIcon icon={faStop} className="h-3 w-3" /><span className="tabular-nums">{fmtClock(elapsed)}</span>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => timer("start")}><FontAwesomeIcon icon={faStopwatch} className="h-3.5 w-3.5" />Start timer</Button>
                )}
                <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => setLogOpen(true)}><FontAwesomeIcon icon={faHourglassHalf} className="h-3.5 w-3.5" />Log time</Button>
              </div>
            </div>

            {/* Description */}
            <section className="border-t px-6 py-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FontAwesomeIcon icon={faAlignLeft} className="h-3.5 w-3.5 text-muted-foreground" />Description</p>
              <RichTextEditor
                key={task.id}
                value={description}
                onChange={setDescription}
                onBlur={(html) => { if (html !== (task.description ?? "")) save({ description: html }); }}
                placeholder="Add a description…"
                minHeight={90}
                className="border-transparent hover:border-border"
              />
            </section>

            {/* Subtasks */}
            {(task.sub_tasks.length > 0 || newSub !== null) && (
              <section className="border-t px-6 py-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FontAwesomeIcon icon={faListCheck} className="h-3.5 w-3.5 text-muted-foreground" />Subtasks
                  <span className="text-xs font-normal text-muted-foreground">{subDone}/{task.sub_tasks.length}</span>
                </p>
                {task.sub_tasks.length > 0 && (
                  <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${(subDone / task.sub_tasks.length) * 100}%` }} /></div>
                )}
                {task.sub_tasks.map((s) => (
                  <div key={s.id} className="group flex items-center gap-2 py-1 text-[13px]">
                    <button onClick={() => save({ sub_tasks: task.sub_tasks.map((x) => x.id === s.id ? { ...x, checked: !x.checked } : x) })}>
                      <FontAwesomeIcon icon={s.checked ? faSquareCheck : faSquare} className={cn("h-4 w-4", s.checked ? "text-emerald-500" : "text-muted-foreground")} />
                    </button>
                    <span className={cn("flex-1", s.checked && "text-muted-foreground line-through")}>{s.title}</span>
                    <button className="opacity-0 group-hover:opacity-60" onClick={() => save({ sub_tasks: task.sub_tasks.filter((x) => x.id !== s.id) })} aria-label="Remove subtask">
                      <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {newSub !== null && (
                  <div className="flex items-center gap-2 py-1">
                    <FontAwesomeIcon icon={faSquare} className="h-4 w-4 text-muted-foreground" />
                    <Input autoFocus className="h-8 text-[13px]" placeholder="Subtask name, Enter to add" value={newSub}
                      onChange={(e) => setNewSub(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addSub(); if (e.key === "Escape") setNewSub(null); }}
                      onBlur={() => { if (newSub.trim()) addSub(); setNewSub(null); }} />
                  </div>
                )}
                {newSub === null && (
                  <button onClick={() => setNewSub("")} className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Add subtask</button>
                )}
              </section>
            )}

            <div ref={attachRef}><TaskAttachments taskId={task.id} /></div>

            <TaskScheduledWork taskId={task.id} plannedDate={task.planned_date} members={members} currentUserId={currentUserId} entries={entries} onEntriesChange={loadTime} />

            {task.status !== "done" && (
              <div className="border-t px-6 py-4">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => save({ status: "done" })}>
                  <FontAwesomeIcon icon={faCircleCheckRegular} className="h-3.5 w-3.5" />Mark as complete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        <aside className="hidden w-[400px] shrink-0 border-l bg-muted/20 md:flex md:flex-col">
          <TaskChat
            taskId={task.id} members={members} currentUserId={currentUserId}
            refreshKey={[task.status, task.priority, task.due_date, task.type_id, task.planned_date, task.assignees.map((a) => a.id).join(",")].join("|")}
          />
        </aside>
      </div>

      <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} taskId={task.id} onLogged={loadTime} />
      <TypeManagerDialog open={typesOpen} onOpenChange={setTypesOpen} types={types} onChange={props.onTypesChange} />
    </>
  );
}

function LogTimeDialog({ open, onOpenChange, taskId, onLogged }: { open: boolean; onOpenChange: (o: boolean) => void; taskId: string; onLogged: () => void }) {
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  async function submit() {
    const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    const res = await fetch(`/api/tasks/${taskId}/time`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log", minutes: total, date, description: note.trim() || null }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Could not log time"); return; }
    toast.success(`Logged ${formatMinutes(total)}`);
    onLogged();
    onOpenChange(false);
    setNote("");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Log time</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Input type="number" min={0} className="h-9 w-20" value={hours} onChange={(e) => setHours(e.target.value)} />h
            <Input type="number" min={0} max={59} className="h-9 w-20" value={minutes} onChange={(e) => setMinutes(e.target.value)} />m
          </div>
          <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="What did you work on? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Log time</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
