"use client";

import { dateLocale } from "@/lib/user-prefs";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Inbox, PanelRightClose, PanelRightOpen, AlertCircle, X } from "@/components/shared/fa-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasksContext } from "../context/tasks-context";
import { TaskCard, TASK_DRAG_TYPE } from "./task-card";
import type { Task } from "../types";
import { addDays, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
import { cn } from "@/lib/utils";

type Scope = "me" | "all" | string; // string = a member's user id

function InlineAdd({ onAdd, placeholder = "Add task" }: { onAdd: (title: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground">
        <Plus className="h-3.5 w-3.5" />{placeholder}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      className="h-8 text-sm"
      placeholder="Task name, Enter to add"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) { onAdd(value.trim()); setValue(""); }
        if (e.key === "Escape") { setOpen(false); setValue(""); }
      }}
      onBlur={() => { if (value.trim()) onAdd(value.trim()); setOpen(false); setValue(""); }}
    />
  );
}

/** Weekly planner: 7 day columns, drag & drop, inline add and a waiting list. */
export function WeeklyPlanner({ projectId, teamId, title = "Planner" }: { projectId?: string; teamId?: string; title?: string } = {}) {
  const { tasks, loading, members, projects, currentUserId, addTask, updateTask, openTask, openQuickAdd, reminders, ensureClosedFrom } = useTasksContext();
  const [hideReminders, setHideReminders] = useState(false);
  const [brand, setBrand] = useState<string>("all");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [scope, setScope] = useState<Scope>(projectId || teamId ? "all" : "me");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [colWidth, setColWidth] = useState(240);
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    try { const w = Number(localStorage.getItem("planner:colWidth")); if (w >= 160 && w <= 480) setColWidth(w); } catch {}
  }, []);

  /** Drag a column's right edge to resize every day column (remembered per browser). */
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX, startW = colWidth;
    let w = startW;
    const move = (ev: MouseEvent) => { w = Math.min(480, Math.max(160, startW + ev.clientX - startX)); setColWidth(w); };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      try { localStorage.setItem("planner:colWidth", String(w)); } catch {}
    };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  // An older week shows its completed tasks too (they load on demand).
  useEffect(() => { ensureClosedFrom(toISODate(weekStart)); }, [weekStart, ensureClosedFrom]);
  const today = todayISO();
  const scopeUser = scope === "me" ? currentUserId : scope === "all" ? null : scope;

  const visible = useMemo(
    () => tasks.filter((t) =>
      (!projectId || t.project_id === projectId) &&
      (!teamId || t.team_id === teamId) &&
      (brand === "all" || (brand === "none" ? !t.project_id : t.project_id === brand)) &&
      (!scopeUser || t.assignees.some((a) => a.id === scopeUser) || (t.assignees.length === 0 && t.created_by === scopeUser))),
    [tasks, scopeUser, projectId, teamId, brand],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of visible) {
      if (!t.planned_date) continue;
      if (!showDone && t.status === "done") continue;
      const list = map.get(t.planned_date) ?? [];
      list.push(t);
      map.set(t.planned_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.position - b.position);
    return map;
  }, [visible, showDone]);

  const waiting = useMemo(() => visible.filter((t) => !t.planned_date && t.status !== "done"), [visible]);
  const overdue = useMemo(() => visible.filter((t) => t.planned_date && t.planned_date < today && t.status !== "done"), [visible, today]);

  function toggleDone(t: Task) {
    updateTask(t.id, { status: t.status === "done" ? "todo" : "done" });
  }

  function handleDrop(e: React.DragEvent, plannedDate: string | null) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(TASK_DRAG_TYPE) || e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === id);
    if (task && task.planned_date !== plannedDate) updateTask(id, { planned_date: plannedDate });
  }

  const dropProps = (key: string, plannedDate: string | null) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== key) setDragOver(key); },
    onDragLeave: (e: React.DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(null); },
    onDrop: (e: React.DragEvent) => handleDrop(e, plannedDate),
  });

  const createFor = (plannedDate: string | null) => (title: string) =>
    addTask({ title, planned_date: plannedDate, project_id: projectId ?? null, team_id: teamId ?? null, assignee_ids: scopeUser ? [scopeUser] : undefined });

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[520px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h1 className="text-lg font-semibold mr-2">{title}</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!projectId && <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color ?? "#6366f1" }} />{p.name}</span></SelectItem>
              ))}
              <SelectItem value="none">No brand</SelectItem>
            </SelectContent>
          </Select>}
          {!projectId && <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">My tasks</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
              {members.filter((m) => m.id !== currentUserId).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Show done
          </label>
          <Button size="sm" className="h-8" onClick={() => openQuickAdd({ planned_date: today, project_id: projectId, team_id: teamId })}><Plus className="h-4 w-4 mr-1.5" />Task</Button>
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" title={showWaiting ? "Hide waiting list" : "Show waiting list"} onClick={() => setShowWaiting((v) => !v)}>
            {showWaiting ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!projectId && !hideReminders && reminders.length > 0 && (() => {
        const overdueCount = reminders.filter((r) => r.days < 0).length;
        const todayCount = reminders.filter((r) => r.days === 0).length;
        const tomorrowCount = reminders.filter((r) => r.days === 1).length;
        const behind = overdueCount > 0;
        return (
          <div className={cn("mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-[13px]", behind ? "border-red-500/30 bg-red-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]")}>
            <AlertCircle className={cn("h-4 w-4", behind ? "text-red-500" : "text-amber-500")} />
            <span className="font-medium">
              {behind ? "You are behind: " : "Deadlines coming up: "}
              {[overdueCount && `${overdueCount} overdue`, todayCount && `${todayCount} due today`, tomorrowCount && `${tomorrowCount} due tomorrow`].filter(Boolean).join(" · ")}
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {reminders.slice(0, 4).map((r) => (
                <button key={r.id} onClick={() => { const t = tasks.find((x) => x.id === r.id); if (t) openTask(t); }}
                  className="max-w-[220px] truncate rounded-full border bg-background px-2.5 py-0.5 text-xs hover:border-foreground/30">{r.title}</button>
              ))}
              {reminders.length > 4 && <span className="self-center text-xs text-muted-foreground">+{reminders.length - 4} more</span>}
            </span>
            <button onClick={() => setHideReminders(true)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        );
      })()}

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Week */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="grid h-full gap-3" style={{ gridTemplateColumns: `repeat(7, minmax(${colWidth}px, 1fr))` }}>
            {days.map((d) => {
              const iso = toISODate(d);
              const list = byDay.get(iso) ?? [];
              const openCount = list.filter((t) => t.status !== "done").length;
              const isToday = iso === today;
              const isPast = iso < today;
              return (
                <section
                  key={iso}
                  {...dropProps(iso, iso)}
                  className={cn(
                    "group/day relative flex flex-col min-h-0 rounded-xl border bg-muted/30 transition-colors",
                    isToday && "border-primary/40 bg-primary/[0.03]",
                    dragOver === iso && "ring-2 ring-primary/40 bg-primary/5",
                  )}
                >
                  <div onMouseDown={startResize} onDoubleClick={() => { setColWidth(240); try { localStorage.removeItem("planner:colWidth"); } catch {} }}
                    title="Drag to resize columns, double-click to reset"
                    className="absolute -right-2 top-0 z-10 h-full w-2.5 cursor-col-resize rounded transition-colors hover:bg-primary/30" />
                  <header className="flex items-center justify-between px-3 pt-2.5 pb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("text-xs font-medium uppercase", isPast ? "text-muted-foreground/60" : "text-muted-foreground")}>
                        {d.toLocaleDateString(dateLocale(), { weekday: "short" })}
                      </span>
                      <span className={cn(
                        "text-sm font-semibold",
                        isToday && "flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground",
                        isPast && !isToday && "text-muted-foreground/70",
                      )}>
                        {d.getDate()}
                      </span>
                    </div>
                    {openCount > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">{openCount}</span>}
                  </header>

                  <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1.5">
                    {loading && list.length === 0 && [0, 1].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />)}
                    {list.map((t) => <TaskCard key={t.id} task={t} onOpen={openTask} onToggleDone={toggleDone} />)}
                    <InlineAdd onAdd={createFor(iso)} />
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Waiting list */}
        {showWaiting && (
          <aside
            {...dropProps("waiting", null)}
            className={cn("hidden md:flex w-72 shrink-0 flex-col min-h-0 rounded-xl border bg-card transition-colors", dragOver === "waiting" && "ring-2 ring-primary/40 bg-primary/5")}
          >
            <header className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Inbox className="h-4 w-4 text-muted-foreground" />Waiting list</h2>
              <span className="text-xs text-muted-foreground">{waiting.length}</span>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
              {overdue.length > 0 && (
                <div className="mb-2">
                  <p className="flex items-center gap-1 px-1 pb-1 text-[11px] font-medium text-red-600"><AlertCircle className="h-3 w-3" />Overdue ({overdue.length}) — drag to a day</p>
                  <div className="space-y-1.5">{overdue.map((t) => <TaskCard key={t.id} task={t} onOpen={openTask} onToggleDone={toggleDone} />)}</div>
                </div>
              )}
              <InlineAdd onAdd={createFor(null)} placeholder="Add to waiting list" />
              {waiting.map((t) => <TaskCard key={t.id} task={t} onOpen={openTask} onToggleDone={toggleDone} />)}
              {waiting.length === 0 && overdue.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Unscheduled tasks land here. Drag one onto a day to plan it.</p>
              )}
            </div>
          </aside>
        )}
      </div>

    </div>
  );
}
