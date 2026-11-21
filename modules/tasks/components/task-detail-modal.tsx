"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faCircleCheck as faCircleCheckRegular, faEye } from "@fortawesome/free-regular-svg-icons";
import {
  faXmark, faEllipsis, faLink, faTrashCan, faCopy, faAlignLeft, faArrowsRotate, faBullseye, faRotateLeft, faCircleCheck,
  faArrowRightToBracket, faSpinner, faLock, faTableColumns, faWindowRestore, faExpand, faCheck, faUserGroup,
  faCirclePause, faCirclePlay,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus, TaskPriority, TaskMember, TaskTeam, TaskProjectListItem, BoardColumn, RecurringPattern, TaskType } from "../types";
import { STATUS_CONFIG, RECURRING_OPTIONS } from "../types";
import { AssigneePicker, AssigneeAvatar } from "./assignee-picker";
import { RichTextEditor } from "./rich-text-editor";
import { TaskFiles } from "./task-files";
import { TaskChat } from "./task-chat";
import { TypeManagerDialog } from "./type-manager";
import { initials, overdueText, taskKey } from "../lib/bordio";
import { PriorityLabel } from "./task-icons";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShellProfile } from "@/lib/supabase/profile-context";

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void | Promise<void>;
  onDelete: (id: string) => void;
  onDuplicate: (task: Task) => void;
  /** Re-reads the task after its files changed (main file flag, counters). */
  onRefresh: (id: string) => void;
  members: TaskMember[];
  teams: TaskTeam[];
  types: TaskType[];
  projects: TaskProjectListItem[];
  currentUserId: string | null;
  /** CEO and team leads: may delete any task and manage types. */
  isLead: boolean;
  canDelete: boolean;
  onTypesChange: () => void;
  onAddAssignees: (id: string, payload: { user_ids?: string[]; team_id?: string }) => void;
  onRemoveAssignee: (id: string, userId: string) => void;
}

const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];

/** How the task opens: a centred window, the full screen, or a panel on the right. Remembered per browser. */
type Layout = "standard" | "expanded" | "sidebar";
const LAYOUT_KEY = "vividview-task-layout";
const LAYOUTS: { id: Layout; label: string; icon: typeof faCheck }[] = [
  { id: "standard", label: "Standard", icon: faWindowRestore },
  { id: "expanded", label: "Expanded", icon: faExpand },
  { id: "sidebar", label: "Sidebar", icon: faTableColumns },
];
const LAYOUT_CLASS: Record<Layout, string> = {
  standard: "inset-x-2 inset-y-2 mx-auto max-w-[1240px] rounded-2xl border sm:inset-x-3 sm:inset-y-3 lg:inset-y-6",
  expanded: "inset-0 rounded-none border-0",
  sidebar: "inset-y-0 right-0 w-full max-w-[min(1000px,100vw)] rounded-none border-l md:w-[78vw]",
};
const trigger = "h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-[13px] font-medium hover:bg-muted focus:ring-0 [&>svg:last-child]:hidden";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center">
      <span className="w-32 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

/** Task view: details and the three file sections on the left, chat on the right. */
export function TaskDetailModal(props: Props) {
  const { task, open, onClose, onUpdate, onDelete, onDuplicate, onRefresh, members, teams, types, projects, currentUserId, isLead, canDelete: canDeleteProp } = props;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [typesOpen, setTypesOpen] = useState(false);
  // Phones show one pane at a time; larger screens show both side by side.
  const [pane, setPane] = useState<"details" | "chat">("details");
  // Completing or reopening waits for the server (it checks the main file), so the button shows a spinner meanwhile.
  const [statusBusy, setStatusBusy] = useState<"complete" | "reopen" | null>(null);
  const [layout, setLayout] = useState<Layout>("standard");
  // On hold: the reason box, and the busy state while it's saved or resumed.
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdBusy, setHoldBusy] = useState(false);
  const isCeo = useShellProfile()?.role === "super_admin";
  useEffect(() => {
    try { const v = localStorage.getItem(LAYOUT_KEY) as Layout | null; if (v && v in LAYOUT_CLASS) setLayout(v); } catch {}
  }, []);
  const changeLayout = (v: Layout) => { setLayout(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch {} };
  const taskId = task?.id ?? null;
  const projectId = task?.project_id ?? null;

  useEffect(() => { setTitle(task?.title ?? ""); setDescription(task?.description ?? ""); }, [taskId, task?.title, task?.description]);

  useEffect(() => {
    setColumns([]);
    if (!projectId) return;
    fetch(`/api/tasks/projects/${projectId}`).then((r) => r.json()).then((j) => setColumns(j.columns ?? [])).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open && !typesOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, typesOpen]);

  if (!task || !open) return null;
  const save = (u: Partial<Task>) => onUpdate(task.id, u);

  const key = taskKey(task);
  const overdue = overdueText(task);
  const column = columns.find((c) => c.id === task.board_column_id);
  const done = task.status === "done";
  // Another team's task opened from the Brands tab: view only.
  // Another team's task (from the Brands tab) is view only for good; a completed task until it is reopened.
  const viewOnly = task.can_edit === false;
  // On hold: nothing can change (files and chat are kept) until a CEO resumes it.
  const held = !!task.hold_at;
  const locked = viewOnly || done || (held && !isCeo);
  const heldBy = held ? members.find((m) => m.id === task.hold_by)?.full_name ?? "Someone" : "";
  const canHold = !done && !held && !viewOnly && task.can_chat !== false;
  async function hold() {
    if (!task) return;
    const reason = holdReason.trim();
    if (reason.length < 3) { toast.error("Please give a reason"); return; }
    setHoldBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error ?? "Could not put the task on hold"); return; }
      toast.success("Task put on hold");
      setHoldOpen(false); setHoldReason("");
      onRefresh(task.id);
    } finally { setHoldBusy(false); }
  }
  async function resume() {
    if (!task) return;
    setHoldBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/hold`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error ?? "Could not resume the task"); return; }
      toast.success("Task resumed");
      onRefresh(task.id);
    } finally { setHoldBusy(false); }
  }
  // A team task can only be assigned to that team's members.
  const taskTeam = teams.find((t) => t.id === task.team_id) ?? null;
  const canDelete = canDeleteProp && !locked;
  // "Move to": the teams the user is part of (team leads and the CEO can use any team).
  const moveTargets = teams.filter((t) => isLead || (!!currentUserId && t.member_ids.includes(currentUserId)));
  const doneColumn = columns.find((c) => c.status_key === "done");
  const openColumn = columns.find((c) => c.status_key === "todo") ?? columns.find((c) => c.status_key !== "done");
  const needsMain = (s: TaskStatus | undefined) => s === "done" && !task.has_main_file;
  const complete = async () => {
    if (!task.has_main_file) { toast.error("Upload the main file before completing this task"); return; }
    setStatusBusy("complete");
    try { await save(doneColumn ? { board_column_id: doneColumn.id } : { status: "done" }); } finally { setStatusBusy(null); }
  };

  return (
    <>
      <div className={cn("fixed inset-0 z-40", layout === "sidebar" ? "bg-black/20" : "bg-black/40 backdrop-blur-[2px]")} onClick={onClose} />
      <div className={cn("fixed z-50 flex flex-col overflow-hidden bg-background shadow-2xl transition-[inset,width,max-width,border-radius] duration-200 md:flex-row", LAYOUT_CLASS[layout])}>
        <div className="flex shrink-0 gap-1 border-b bg-muted/30 p-1.5 md:hidden">
          {(["details", "chat"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPane(p)}
              className={cn("flex-1 rounded-lg py-1.5 text-[13px] font-medium", pane === p ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {p === "details" ? "Details" : `Chat${task.comment_count ? ` (${task.comment_count})` : ""}`}
            </button>
          ))}
        </div>
        {/* ── Details ─────────────────────────────────────────────────────── */}
        <div className={cn("min-h-0 min-w-0 flex-1 flex-col", pane === "details" ? "flex" : "hidden md:flex")}>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 text-[13px] text-muted-foreground sm:px-6">
            {task.project ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold text-white" style={{ backgroundColor: task.project.color ?? "#6366f1" }}>{initials(task.project.name)}</span>
                <span className="truncate font-medium text-foreground">{task.project.name}</span>
              </span>
            ) : <span className="truncate">No brand</span>}
            {key && <><span>/</span><span className="font-medium text-foreground">{key}</span></>}
            {viewOnly && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><FontAwesomeIcon icon={faEye} className="h-3 w-3" />View only</span>}
            {held && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"><FontAwesomeIcon icon={faCirclePause} className="h-3 w-3" />On hold</span>}
            {done && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><FontAwesomeIcon icon={faCircleCheck} className="h-3 w-3" />Completed</span>}
            <div className="ml-auto flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-2 hover:bg-muted hover:text-foreground" aria-label="More"><FontAwesomeIcon icon={faEllipsis} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!locked && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><FontAwesomeIcon icon={faArrowRightToBracket} className="mr-2 h-3.5 w-3.5" />Move to</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        {moveTargets.map((t) => (
                          <DropdownMenuItem key={t.id} disabled={t.id === task.team_id} onSelect={() => save({ team_id: t.id })}>
                            <span className="mr-2 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: t.color ?? "#6366f1" }} />
                            <span className="flex-1 truncate">{t.name}</span>
                            {t.id === task.team_id && <FontAwesomeIcon icon={faCheck} className="ml-2 h-3 w-3 text-muted-foreground" />}
                          </DropdownMenuItem>
                        ))}
                        {moveTargets.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">You are not in any team yet.</p>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={!task.team_id} onSelect={() => save({ team_id: null })}>
                          <FontAwesomeIcon icon={faUserGroup} className="mr-2 h-3.5 w-3.5" />Everyone (no team)
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><FontAwesomeIcon icon={faTableColumns} className="mr-2 h-3.5 w-3.5" />Change layout</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {LAYOUTS.map((l) => (
                        <DropdownMenuItem key={l.id} onSelect={() => changeLayout(l.id)}>
                          <FontAwesomeIcon icon={l.icon} className="mr-2 h-3.5 w-3.5" /><span className="flex-1">{l.label}</span>
                          {layout === l.id && <FontAwesomeIcon icon={faCheck} className="ml-2 h-3 w-3 text-muted-foreground" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  {canHold && (
                    <DropdownMenuItem onSelect={() => setHoldOpen(true)}><FontAwesomeIcon icon={faCirclePause} className="mr-2 h-3.5 w-3.5 text-amber-500" />Put on hold</DropdownMenuItem>
                  )}
                  {held && isCeo && (
                    <DropdownMenuItem onSelect={resume}><FontAwesomeIcon icon={faCirclePlay} className="mr-2 h-3.5 w-3.5 text-emerald-600" />Resume task</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onDuplicate(task)}><FontAwesomeIcon icon={faCopy} className="mr-2 h-3.5 w-3.5" />Duplicate</DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => { if (window.confirm("Delete this task? It moves to the trash and can be restored for a limited time.")) { onDelete(task.id); onClose(); } }}>
                        <FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Delete task
                      </DropdownMenuItem>
                    </>
                  )}
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
            <div className="px-4 pb-4 pt-5 sm:px-6">
              <input
                value={title}
                readOnly={locked}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== task.title) save({ title: title.trim() }); else setTitle(task.title); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-full bg-transparent text-[22px] font-semibold leading-tight tracking-tight focus:outline-none"
              />

              {held && (
                <div className="mt-3 flex flex-wrap items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[13px] dark:border-amber-700/50 dark:bg-amber-950/30">
                  <FontAwesomeIcon icon={faCirclePause} className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">On hold{task.hold_at ? ` since ${new Date(task.hold_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""} · put on hold by {heldBy}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-amber-900/90 dark:text-amber-200/90">{task.hold_reason}</p>
                    {!isCeo && <p className="mt-1 text-xs text-amber-800/70 dark:text-amber-300/70">Locked until it's resumed.</p>}
                  </div>
                  {isCeo && (
                    <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={holdBusy} onClick={resume}>
                      <FontAwesomeIcon icon={holdBusy ? faSpinner : faCirclePlay} spin={holdBusy} className="h-3.5 w-3.5" />Resume
                    </Button>
                  )}
                </div>
              )}
              {done && !viewOnly && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700 dark:text-emerald-400">
                  <FontAwesomeIcon icon={faLock} className="h-3 w-3" />This task is completed and locked. Reopen it to make changes.
                </p>
              )}
              <fieldset disabled={locked} className={cn("m-0 mt-4 grid min-w-0 gap-x-8 gap-y-0.5 border-0 p-0", layout !== "sidebar" && "lg:grid-cols-2")}>
                <Row label="Brand">
                  <Select value={task.project_id ?? "__none__"} onValueChange={(v) => save({ project_id: v === "__none__" ? null : v })}>
                    <SelectTrigger className={trigger}>
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: task.project?.color ?? "#94a3b8" }} />{task.project?.name ?? <span className="text-muted-foreground">No brand</span>}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No brand</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Team">
                  <Select value={task.team_id ?? "__none__"} onValueChange={(v) => save({ team_id: v === "__none__" ? null : v })}>
                    <SelectTrigger className={trigger}>
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: task.team?.color ?? "#94a3b8" }} />{task.team?.name ?? <span className="text-muted-foreground">Everyone</span>}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Everyone (no team)</SelectItem>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Status">
                  {columns.length > 0 ? (
                    <Select value={task.board_column_id ?? ""} onValueChange={(v) => {
                      if (needsMain(columns.find((c) => c.id === v)?.status_key)) { toast.error("Upload the main file before completing this task"); return; }
                      save({ board_column_id: v });
                    }}>
                      <SelectTrigger className={trigger}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column?.color ?? "#94a3b8" }} />{column?.name ?? STATUS_CONFIG[task.status].label}
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color ?? "#94a3b8" }} />{c.name}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={task.status} onValueChange={(v) => {
                      if (needsMain(v as TaskStatus)) { toast.error("Upload the main file before completing this task"); return; }
                      save({ status: v as TaskStatus });
                    }}>
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
                      {isLead && <><SelectSeparator /><SelectItem value="__manage__">Manage types…</SelectItem></>}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Priority">
                  <Select value={task.priority} onValueChange={(v) => save({ priority: v as TaskPriority })}>
                    <SelectTrigger className={trigger}><PriorityLabel priority={task.priority} /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}><PriorityLabel priority={p} /></SelectItem>)}
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Assignee">
                  <div className="px-2">
                    <AssigneePicker emptyLabel="Unassigned" value={task.assignees} members={taskTeam ? members.filter((m) => taskTeam.member_ids.includes(m.id)) : members} teams={taskTeam ? [taskTeam] : teams}
                      onAddUsers={(ids) => props.onAddAssignees(task.id, { user_ids: ids })}
                      onAddTeam={(t) => props.onAddAssignees(task.id, { team_id: t })}
                      onRemove={(u) => props.onRemoveAssignee(task.id, u)} />
                  </div>
                </Row>
                <Row label="Created by">
                  <span className="flex items-center gap-2 px-2 text-[13px] font-medium">
                    {task.reporter ? <><AssigneeAvatar member={task.reporter} size="xs" />{task.reporter.id === currentUserId ? "Me" : task.reporter.full_name}</> : "—"}
                  </span>
                </Row>
                <Row label="Scheduled for">
                  <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-medium hover:bg-muted">
                    <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
                    <input type="date" className="bg-transparent focus:outline-none" value={task.planned_date ?? ""} onChange={(e) => save({ planned_date: e.target.value || null })} />
                    {!task.planned_date && <span className="font-normal text-muted-foreground">Waiting list</span>}
                  </label>
                </Row>
                <Row label="Deadline">
                  <div className="min-w-0">
                    <label className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-medium hover:bg-muted">
                      <FontAwesomeIcon icon={faBullseye} className={cn("h-3.5 w-3.5", overdue ? "text-red-500" : "text-muted-foreground")} />
                      <input type="date" className="bg-transparent focus:outline-none" value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
                    </label>
                    {overdue && <p className="px-2 pb-1 text-xs capitalize text-red-500">{overdue}</p>}
                  </div>
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
              </fieldset>
            </div>

            {/* Description */}
            <section className="border-t px-4 py-4 sm:px-6">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FontAwesomeIcon icon={faAlignLeft} className="h-3.5 w-3.5 text-muted-foreground" />Description</p>
              <RichTextEditor
                key={task.id}
                value={description}
                onChange={setDescription}
                onBlur={(html) => { if (html !== (task.description ?? "")) save({ description: html }); }}
                placeholder={locked ? "No description" : "Add a description…"}
                editable={!locked}
                minHeight={90}
                className="border-transparent hover:border-border"
              />
            </section>

            <TaskFiles
              taskId={task.id}
              readOnly={locked}
              version={`${task.attachment_count}-${task.has_main_file}`}
              notes={{ brief: task.brief_note, reference: task.reference_note, main: task.main_note }}
              onNoteSave={(kind, note) => save({ [`${kind}_note`]: note } as Partial<Task>)}
              onFilesChanged={() => onRefresh(task.id)}
            />

            {!viewOnly && !held && <div className="flex flex-wrap items-center gap-3 border-t px-4 py-4 sm:px-6">
              {done ? (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={!!statusBusy} onClick={async () => {
                  setStatusBusy("reopen");
                  try { await save(openColumn ? { board_column_id: openColumn.id } : { status: "todo" }); } finally { setStatusBusy(null); }
                }}>
                  <FontAwesomeIcon icon={statusBusy === "reopen" ? faSpinner : faRotateLeft} spin={statusBusy === "reopen"} className="h-3.5 w-3.5" />{statusBusy === "reopen" ? "Reopening…" : "Reopen task"}
                </Button>
              ) : (
                <>
                  {/* Disabled buttons ignore the mouse, so the wrapper shows the "not allowed" cursor on hover. */}
                  <span className={cn("inline-flex", !task.has_main_file && "cursor-not-allowed")} title={task.has_main_file ? undefined : "Upload the main file to complete this task"}>
                    <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!task.has_main_file || !!statusBusy} onClick={complete}>
                      {statusBusy === "complete" ? (
                        <FontAwesomeIcon icon={faSpinner} spin className="h-3.5 w-3.5" />
                      ) : (
                        <FontAwesomeIcon icon={faCircleCheckRegular} className="h-3.5 w-3.5" />
                      )}
                      {statusBusy === "complete" ? "Completing…" : "Mark as complete"}
                    </Button>
                  </span>
                  {!task.has_main_file && <span className="text-xs text-muted-foreground">Upload the main file above to complete this task.</span>}
                  {canHold && (
                    <Button variant="outline" size="sm" className="ml-auto gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40" onClick={() => setHoldOpen(true)}>
                      <FontAwesomeIcon icon={faCirclePause} className="h-3.5 w-3.5" />Put on hold
                    </Button>
                  )}
                </>
              )}
            </div>}
          </div>
        </div>

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        <aside className={cn("min-h-0 w-full flex-1 flex-col bg-muted/20 md:flex-none md:shrink-0 md:border-l", layout === "sidebar" ? "md:w-[340px]" : "md:w-[400px]", pane === "chat" ? "flex" : "hidden md:flex")}>
          <TaskChat
            taskId={task.id} members={members} currentUserId={currentUserId} readOnly={task.can_chat === false || (held && !isCeo)}
            refreshKey={[task.status, task.priority, task.due_date, task.type_id, task.planned_date, task.attachment_count, task.assignees.map((a) => a.id).join(",")].join("|")}
          />
        </aside>
      </div>

      <Dialog open={holdOpen} onOpenChange={(v) => { if (!holdBusy) setHoldOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Put this task on hold?</DialogTitle>
            <DialogDescription>Add a reason.</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={4} maxLength={500}
            placeholder="Reason, e.g. waiting for the client's approval" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void hold(); }} />
          <p className="text-right text-[11px] text-muted-foreground">{holdReason.length}/500</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)} disabled={holdBusy}>Cancel</Button>
            <Button className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700" onClick={hold} disabled={holdBusy || holdReason.trim().length < 3}>
              {holdBusy && <FontAwesomeIcon icon={faSpinner} spin className="h-3.5 w-3.5" />}Put on hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TypeManagerDialog open={typesOpen} onOpenChange={setTypesOpen} types={types} onChange={props.onTypesChange} />
    </>
  );
}
