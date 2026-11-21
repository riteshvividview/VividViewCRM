"use client";

import { dateLocale } from "@/lib/user-prefs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-regular-svg-icons";
import {
  faPaperclip, faChevronDown, faPlus, faGear, faPen, faXmark, faCheck, faLock, faRotateLeft, faCalendar, faBullseye, faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { BoardColumn, Task, TaskPriority, TaskStatus } from "../types";
import { STATUS_CONFIG } from "../types";
import { dueLabel, isOverdue } from "../lib/bordio";
import { PriorityLabel, StatusIcon } from "./task-icons";
import { AssigneeAvatar } from "./assignee-picker";
import { useTasksContext } from "../context/tasks-context";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  /** Project status columns (for custom status names); omit for base statuses. */
  columns?: BoardColumn[];
  onOpen: (task: Task) => void;
  onCreate: () => void;
  selectedId?: string | null;
  /** A page with its own task list (Brand page) pages its own older completed tasks. */
  olderClosed?: OlderClosed;
}
interface OlderClosed { has: boolean; load: () => Promise<void> }

// ── Columns: widths can be dragged, columns switched on and off; saved per browser ──
type ColId = "title" | "status" | "type" | "assignee" | "planned" | "deadline" | "priority" | "brand" | "team";
const COLUMNS: { id: ColId; label: string; width: number; min: number; fixed?: boolean }[] = [
  { id: "title",    label: "Task",          width: 280, min: 180, fixed: true },
  { id: "status",   label: "Status",        width: 125, min: 100 },
  { id: "type",     label: "Type",          width: 115, min: 80 },
  { id: "assignee", label: "Assignee",      width: 155, min: 80 },
  { id: "planned",  label: "Scheduled",     width: 125, min: 100 },
  { id: "deadline", label: "Deadline",      width: 125, min: 100 },
  { id: "priority", label: "Priority",      width: 105, min: 80 },
  { id: "brand",    label: "Brand",         width: 140, min: 80 },
  { id: "team",     label: "Team",          width: 130, min: 80 },
];
const DEFAULT_HIDDEN: ColId[] = ["planned"];
const STORE = "vividview-task-table";
interface Layout { widths: Partial<Record<ColId, number>>; hidden: ColId[] }

function loadLayout(): Layout {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (raw && typeof raw === "object") return { widths: raw.widths ?? {}, hidden: Array.isArray(raw.hidden) ? raw.hidden : DEFAULT_HIDDEN };
  } catch {}
  return { widths: {}, hidden: DEFAULT_HIDDEN };
}
function saveLayout(l: Layout) { try { localStorage.setItem(STORE, JSON.stringify(l)); } catch {} }

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];
const NOT_YOURS = "Only the people working on this task can change it.";
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });

/** Bordio table view: Open tasks / Closed tasks, every field editable in place. */
export function BordioTable({ tasks, columns, onOpen, onCreate, selectedId, olderClosed }: Props) {
  const [layout, setLayout] = useState<Layout>({ widths: {}, hidden: DEFAULT_HIDDEN });
  useEffect(() => { setLayout(loadLayout()); }, []);
  const update = useCallback((fn: (l: Layout) => Layout) => setLayout((l) => { const n = fn(l); saveLayout(n); return n; }), []);

  const visibleCols = COLUMNS.filter((c) => c.fixed || !layout.hidden.includes(c.id));
  const width = (id: ColId) => layout.widths[id] ?? COLUMNS.find((c) => c.id === id)!.width;

  const { open, closed } = useMemo(() => ({
    open: tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    closed: tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  }), [tasks]);

  const settings = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Table columns" title="Columns" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <FontAwesomeIcon icon={faGear} className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">Columns</DropdownMenuLabel>
        {COLUMNS.filter((c) => !c.fixed).map((c) => (
          <DropdownMenuCheckboxItem key={c.id} checked={!layout.hidden.includes(c.id)} onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => update((l) => ({ ...l, hidden: on ? l.hidden.filter((h) => h !== c.id) : [...l.hidden, c.id] }))}>
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => update(() => ({ widths: {}, hidden: DEFAULT_HIDDEN }))}>
          <FontAwesomeIcon icon={faRotateLeft} className="mr-2 h-3 w-3" />Reset columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const shared = { columns, onOpen, selectedId, cols: visibleCols, width, settings,
    onResize: (id: ColId, w: number | null) => update((l) => {
      const widths = { ...l.widths };
      if (w === null) delete widths[id]; else widths[id] = w;
      return { ...l, widths };
    }) };
  return (
    <div className="overflow-x-auto overflow-y-hidden pb-1">
      <Group title="Open tasks" tasks={open} onCreate={onCreate} {...shared} />
      <Group title="Closed tasks" tasks={closed} defaultOpen={closed.length <= 50} {...shared} footer={<OlderClosedButton override={olderClosed} />} />
    </div>
  );
}

/** Completed tasks older than ~60 days load only when asked for. */
function OlderClosedButton({ override }: { override?: OlderClosed }) {
  const ctx = useTasksContext();
  const hasOlderClosed = override ? override.has : ctx.hasOlderClosed;
  const loadOlderClosed = override ? override.load : ctx.loadOlderClosed;
  const [busy, setBusy] = useState(false);
  if (!hasOlderClosed) return null;
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await loadOlderClosed(); } finally { setBusy(false); } }}
      className="sticky left-9 ml-9 mt-1.5 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-60">
      <FontAwesomeIcon icon={faChevronDown} className={cn("h-3 w-3", busy && "animate-pulse")} />{busy ? "Loading…" : "Show older completed tasks"}
    </button>
  );
}

function Group({ title, tasks, columns, onOpen, onCreate, selectedId, defaultOpen = true, cols, width, onResize, settings, footer }: {
  footer?: React.ReactNode;
  title: string; tasks: Task[]; columns?: BoardColumn[]; onOpen: (t: Task) => void; onCreate?: () => void; selectedId?: string | null; defaultOpen?: boolean;
  cols: typeof COLUMNS; width: (id: ColId) => number; onResize: (id: ColId, w: number | null) => void; settings: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = cols.reduce((s, c) => s + width(c.id), 0) + 40;
  return (
    <div className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="sticky left-0 flex items-center gap-2 px-2 py-2 text-[15px] font-semibold">
        <FontAwesomeIcon icon={faChevronDown} className={cn("h-3 w-3 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        {title}<span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{tasks.length}</span>
      </button>
      {open && (
        <div>
          <table className="table-fixed text-[13px]" style={{ width: total, minWidth: "100%" }}>
            <colgroup>
              {cols.map((c) => <col key={c.id} style={{ width: width(c.id) }} />)}
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {cols.map((c) => (
                  <th key={c.id} className={cn("relative select-none py-2 font-normal", c.id === "title" ? "pl-9 pr-2" : "px-2")}>
                    <span className="block truncate">{c.label}</span>
                    <ResizeHandle current={width(c.id)} min={c.min} label={c.label} onResize={(w) => onResize(c.id, w)} />
                  </th>
                ))}
                <th className="py-1 pr-1 text-right font-normal">{settings}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => <TaskRow key={t.id} task={t} cols={cols} columns={columns} onOpen={onOpen} selected={selectedId === t.id} />)}
              {tasks.length === 0 && (
                <tr><td colSpan={cols.length + 1} className="py-6 pl-9 text-[13px] text-muted-foreground">No tasks here</td></tr>
              )}
            </tbody>
          </table>
          {onCreate && (
            <button onClick={onCreate} className="sticky left-9 ml-9 mt-1.5 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">
              <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Create task
            </button>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

/** Drag the right edge of a header to resize; double-click to put it back. Arrow keys work too. */
function ResizeHandle({ current, min, label, onResize }: { current: number; min: number; label: string; onResize: (w: number | null) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <span
      role="separator" aria-orientation="vertical" aria-label={`Resize ${label}`} tabIndex={0} title="Drag to resize, double-click to reset"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: current };
        setDragging(true);
      }}
      onPointerMove={(e) => { if (start.current) onResize(Math.max(min, Math.min(900, Math.round(start.current.w + e.clientX - start.current.x)))); }}
      onPointerUp={() => { start.current = null; setDragging(false); }}
      onDoubleClick={() => onResize(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); onResize(Math.max(min, current - 16)); }
        if (e.key === "ArrowRight") { e.preventDefault(); onResize(Math.min(900, current + 16)); }
      }}
      className="group/resize absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none items-center justify-center focus:outline-none"
    >
      <span className={cn("h-4 w-0.5 rounded-full bg-border transition-colors group-hover/resize:h-full group-hover/resize:bg-primary group-focus-visible/resize:bg-primary", dragging && "h-full bg-primary")} />
    </span>
  );
}

// ── One row ────────────────────────────────────────────────────────────────

/** Cell button: looks like text, shows a soft box on hover when it can be changed. */
const cellBtn = (editable: boolean) => cn(
  "flex h-8 w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-left outline-none transition-colors",
  editable ? "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted" : "cursor-default",
);
const dash = <span className="text-muted-foreground">—</span>;

function TaskRow({ task: t, cols, columns, onOpen, selected }: { task: Task; cols: typeof COLUMNS; columns?: BoardColumn[]; onOpen: (t: Task) => void; selected: boolean }) {
  const { readOnly, types, projects, teams, members, isLead, currentUserId, updateTask, addAssignees, removeAssignee } = useTasksContext();
  const done = t.status === "done";
  const mayEdit = !readOnly && t.can_edit !== false;
  // Completed tasks are locked: only the status can change (to reopen).
  const editable = mayEdit && !done;
  const lockedHint = !mayEdit ? NOT_YOURS : done ? "Completed tasks are locked. Change the status to reopen it." : undefined;
  const save = (u: Partial<Task>) => updateTask(t.id, u);

  // Show the new choice straight away, before the server answers.
  const type = types.find((x) => x.id === t.type_id) ?? t.type ?? null;
  const project = projects.find((p) => p.id === t.project_id) ?? t.project ?? null;
  const team = teams.find((x) => x.id === t.team_id) ?? null;
  const column = columns?.find((c) => c.id === t.board_column_id);
  const needsMain = (s?: TaskStatus) => s === "done" && !t.has_main_file;
  const myTeams = teams.filter((x) => isLead || (!!currentUserId && x.member_ids.includes(currentUserId)));
  const pickable = team ? members.filter((m) => team.member_ids.includes(m.id)) : members;

  function setStatus(next: { status?: TaskStatus; board_column_id?: string }, key?: TaskStatus) {
    if (needsMain(key)) {
      toast.error("Upload the main file before completing this task", { action: { label: "Open task", onClick: () => onOpen(t) } });
      return;
    }
    save(next);
  }

  const cell: Record<ColId, React.ReactNode> = {
    title: <TitleCell task={t} editable={editable} lockedHint={lockedHint} onOpen={() => onOpen(t)} onRename={(title) => save({ title })} />,

    status: (
      <Menu editable={mayEdit} hint={!mayEdit ? NOT_YOURS : undefined} trigger={
        <><StatusIcon status={t.status} /><span className="truncate">{column?.name ?? STATUS_CONFIG[t.status].label}</span></>
      }>
        {columns?.length
          ? columns.map((c) => (
            <Item key={c.id} active={c.id === t.board_column_id} onSelect={() => setStatus({ board_column_id: c.id }, c.status_key as TaskStatus)}>
              <StatusIcon status={(c.status_key as TaskStatus) ?? "todo"} />{c.name}
            </Item>
          ))
          : (Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => (
            <Item key={s} active={s === t.status} onSelect={() => setStatus({ status: s }, s)}>
              <StatusIcon status={s} />{STATUS_CONFIG[s].label}
            </Item>
          ))}
      </Menu>
    ),

    type: (
      <Menu editable={editable} hint={lockedHint} trigger={type
        ? <><span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: type.color }} /><span className="truncate">{type.name}</span></>
        : dash}>
        <Item active={!t.type_id} onSelect={() => save({ type_id: null })}><span className="text-muted-foreground">No type</span></Item>
        {types.map((x) => (
          <Item key={x.id} active={x.id === t.type_id} onSelect={() => save({ type_id: x.id })}>
            <span className="h-3 w-3 rounded" style={{ backgroundColor: x.color }} />{x.name}
          </Item>
        ))}
      </Menu>
    ),

    assignee: (
      <Menu editable={editable} hint={lockedHint} keepOpen wide trigger={t.assignees.length === 0 ? dash : (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <AssigneeAvatar key={a.id} member={a} size="xs" />)}</span>
          <span className="truncate">{t.assignees.length === 1 ? t.assignees[0].full_name : `${t.assignees.length} people`}</span>
        </span>
      )}>
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          {team ? <><FontAwesomeIcon icon={faUsers} className="mr-1.5 h-3 w-3" />Members of {team.name}</> : "Assign people"}
        </DropdownMenuLabel>
        {pickable.map((m) => {
          const on = t.assignees.some((a) => a.id === m.id);
          return (
            <DropdownMenuCheckboxItem key={m.id} checked={on} onSelect={(e) => e.preventDefault()} className="gap-2 text-[13px]"
              onCheckedChange={(c) => { if (c) addAssignees(t.id, { user_ids: [m.id] }); else removeAssignee(t.id, m.id); }}>
              <AssigneeAvatar member={m} size="xs" /><span className="truncate">{m.full_name}{m.id === currentUserId ? " (me)" : ""}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
        {pickable.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nobody to assign</p>}
      </Menu>
    ),

    planned: <DateCell value={t.planned_date} editable={editable} hint={lockedHint} icon={faCalendar} empty="Waiting list" onChange={(v) => save({ planned_date: v })} />,

    deadline: (
      <DateCell value={t.due_date} editable={editable} hint={lockedHint} icon={faBullseye} overdue={isOverdue(t)}
        extra={(() => { const d = dueLabel(t); return d && t.due_date ? d.replace("Due ", "") : null; })()}
        min={t.planned_date ?? undefined}
        onChange={(v) => {
          if (v && t.planned_date && v < t.planned_date) { toast.error(`The deadline cannot be before the scheduled day (${fmtDay(t.planned_date)})`); return; }
          save({ due_date: v });
        }} />
    ),

    priority: (
      <Menu editable={editable} hint={lockedHint} trigger={<PriorityLabel priority={t.priority} className={t.priority === "none" ? "text-muted-foreground" : ""} />}>
        {PRIORITIES.map((p) => <Item key={p} active={p === t.priority} onSelect={() => save({ priority: p })}><PriorityLabel priority={p} /></Item>)}
      </Menu>
    ),

    brand: (
      <Menu editable={editable} hint={lockedHint} trigger={project
        ? <><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project.color ?? "#6366f1" }} /><span className="truncate">{project.name}</span></>
        : dash}>
        <Item active={!t.project_id} onSelect={() => save({ project_id: null })}><span className="text-muted-foreground">No brand</span></Item>
        {projects.map((p) => (
          <Item key={p.id} active={p.id === t.project_id} onSelect={() => save({ project_id: p.id })}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color ?? "#6366f1" }} />{p.name}
          </Item>
        ))}
      </Menu>
    ),

    team: (
      <Menu editable={editable} hint={lockedHint} trigger={team
        ? <><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: team.color ?? "#6366f1" }} /><span className="truncate">{team.name}</span></>
        : <span className="text-muted-foreground">Everyone</span>}>
        <Item active={!t.team_id} onSelect={() => save({ team_id: null })}><span className="text-muted-foreground">Everyone (no team)</span></Item>
        {myTeams.map((x) => (
          <Item key={x.id} active={x.id === t.team_id} onSelect={() => save({ team_id: x.id })}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: x.color ?? "#6366f1" }} />{x.name}
          </Item>
        ))}
      </Menu>
    ),
  };

  return (
    <tr className={cn("group/row border-b border-border/50 hover:bg-muted/30", selected && "bg-muted/60")}>
      {cols.map((c) => <td key={c.id} className={cn("py-1", c.id === "title" ? "pl-7 pr-1" : "px-0.5")}>{cell[c.id]}</td>)}
      <td />
    </tr>
  );
}

function TitleCell({ task: t, editable, lockedHint, onOpen, onRename }: { task: Task; editable: boolean; lockedHint?: string; onOpen: () => void; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(t.title);
  const done = t.status === "done";
  function commit() {
    const v = value.trim();
    setEditing(false);
    if (!v) { setValue(t.title); toast.error("A task needs a title"); return; }
    if (v !== t.title) onRename(v);
  }
  if (editing) {
    return (
      <input autoFocus value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} onBlur={commit} aria-label="Task title"
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(t.title); setEditing(false); } }}
        className="h-8 w-full rounded-md border border-primary bg-background px-2 text-[13px] font-medium outline-none ring-2 ring-primary/20" />
    );
  }
  return (
    <div className="flex h-8 min-w-0 items-center gap-1 px-2">
      <button type="button" onClick={onOpen} title={t.title} className={cn("min-w-0 truncate text-left font-medium hover:underline", done && "text-muted-foreground")}>{t.title}</button>
      {t.hold_at && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-amber-400" title={t.hold_reason ?? "On hold"}>On hold</span>}
      {t.comment_count > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><FontAwesomeIcon icon={faComment} className="h-3 w-3" />{t.comment_count}</span>}
      {t.attachment_count > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><FontAwesomeIcon icon={faPaperclip} className="h-3 w-3" />{t.attachment_count}</span>}
      {editable ? (
        <button type="button" onClick={() => { setValue(t.title); setEditing(true); }} aria-label="Rename task" title="Rename"
          className="ml-auto shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover/row:opacity-100">
          <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
        </button>
      ) : lockedHint ? (
        <span title={lockedHint} className="ml-auto shrink-0 p-1 text-muted-foreground/60 opacity-0 group-hover/row:opacity-100"><FontAwesomeIcon icon={faLock} className="h-2.5 w-2.5" /></span>
      ) : null}
    </div>
  );
}

/** A cell that opens a menu of choices, or just shows its value when it cannot be changed. */
function Menu({ editable, hint, trigger, children, keepOpen, wide }: { editable: boolean; hint?: string; trigger: React.ReactNode; children: React.ReactNode; keepOpen?: boolean; wide?: boolean }) {
  if (!editable) return <div className={cellBtn(false)} title={hint}>{trigger}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cellBtn(true)}>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("max-h-80 overflow-y-auto", wide ? "w-64" : "w-52")} onCloseAutoFocus={keepOpen ? (e) => e.preventDefault() : undefined}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={() => { if (!active) onSelect(); }} className={cn("gap-2 text-[13px]", active && "bg-muted/60 font-medium")}>
      {children}
      {active && <FontAwesomeIcon icon={faCheck} className="ml-auto h-3 w-3 text-muted-foreground" />}
    </DropdownMenuItem>
  );
}

/** Date cell: click opens the browser's date picker; the x clears it. */
function DateCell({ value, editable, hint, icon, empty, overdue, extra, min, onChange }: {
  value: string | null; editable: boolean; hint?: string; icon: typeof faCalendar; empty?: string; overdue?: boolean; extra?: string | null; min?: string;
  onChange: (v: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shown = value
    ? <><span className={cn("truncate", overdue && "text-red-500")}>{fmtDay(value)}</span>{extra && <span className={cn("truncate text-xs opacity-80", overdue && "text-red-500")}>{extra}</span>}</>
    : empty ? <span className="truncate text-muted-foreground">{empty}</span> : dash;
  if (!editable) return <div className={cellBtn(false)} title={hint}>{shown}</div>;
  return (
    <div className="group/date relative">
      <button type="button" className={cn(cellBtn(true), value && "pr-7")}
        onClick={() => { const el = input.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); el.click(); } }}>
        {/* Font Awesome sets its own display, so the wrapper hides the icon of an empty date until hover. */}
        <span className={cn("shrink-0", !value && "hidden group-hover/date:inline")}><FontAwesomeIcon icon={icon} className={cn("h-3 w-3", overdue ? "text-red-500" : "text-muted-foreground")} /></span>{shown}
      </button>
      <input ref={input} type="date" tabIndex={-1} aria-hidden value={value ?? ""} min={min}
        onChange={(e) => { if (e.target.value !== (value ?? "")) onChange(e.target.value || null); }}
        className="pointer-events-none absolute bottom-0 left-2 h-0 w-0 opacity-0" />
      {value && (
        <button type="button" onClick={() => onChange(null)} aria-label="Clear date" title="Clear"
          className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground group-hover/date:block">
          <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
