"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Inbox, CalendarPlus, PanelRightClose, PanelRightOpen, AlertCircle, Video, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasksContext } from "../context/tasks-context";
import { TaskCard, TASK_DRAG_TYPE } from "./task-card";
import { EventDialog, type EventDraft } from "./event-dialog";
import type { CalendarEvent, Task } from "../types";
import { addDays, formatMinutes, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
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

/** Bordio-style weekly planner: 7 day columns, drag & drop, inline add, events, waiting list. */
export function WeeklyPlanner({ projectId, title = "Planner" }: { projectId?: string; title?: string } = {}) {
  const { tasks, loading, members, teams, currentUserId, addTask, updateTask, openTask, openQuickAdd } = useTasksContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [scope, setScope] = useState<Scope>(projectId ? "all" : "me");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventDialog, setEventDialog] = useState<{ event: CalendarEvent | null; draft: EventDraft | null } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showWaiting, setShowWaiting] = useState(true);
  const [showDone, setShowDone] = useState(true);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = todayISO();
  const scopeUser = scope === "me" ? currentUserId : scope === "all" ? null : scope;

  const loadEvents = useCallback(async () => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const res = await fetch(`/api/tasks/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) setEvents((await res.json()).events ?? []);
  }, [weekStart]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const visible = useMemo(
    () => tasks.filter((t) =>
      (!projectId || t.project_id === projectId) &&
      (!scopeUser || t.assignees.some((a) => a.id === scopeUser) || (t.assignees.length === 0 && t.created_by === scopeUser))),
    [tasks, scopeUser, projectId],
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = toISODate(new Date(e.start_time));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

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
    addTask({ title, planned_date: plannedDate, project_id: projectId ?? null, assignee_ids: scopeUser ? [scopeUser] : undefined });

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
          <Button variant="outline" size="sm" className="h-8" onClick={() => {
            const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1);
            setEventDialog({ event: null, draft: { start: s, end: new Date(s.getTime() + 3600_000) } });
          }}>
            <CalendarPlus className="h-4 w-4 mr-1.5" />Event
          </Button>
          <Button size="sm" className="h-8" onClick={() => openQuickAdd({ planned_date: today, project_id: projectId })}><Plus className="h-4 w-4 mr-1.5" />Task</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={showWaiting ? "Hide waiting list" : "Show waiting list"} onClick={() => setShowWaiting((v) => !v)}>
            {showWaiting ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Week */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="grid h-full min-w-[980px] grid-cols-7 gap-2">
            {days.map((d) => {
              const iso = toISODate(d);
              const list = byDay.get(iso) ?? [];
              const dayEvents = eventsByDay.get(iso) ?? [];
              const minutes = list.filter((t) => t.status !== "done").reduce((s, t) => s + (t.estimated_hours ?? 0) * 60, 0);
              const isToday = iso === today;
              const isPast = iso < today;
              return (
                <section
                  key={iso}
                  {...dropProps(iso, iso)}
                  className={cn(
                    "group/day flex flex-col min-h-0 rounded-xl border bg-muted/30 transition-colors",
                    isToday && "border-primary/40 bg-primary/[0.03]",
                    dragOver === iso && "ring-2 ring-primary/40 bg-primary/5",
                  )}
                >
                  <header className="flex items-center justify-between px-3 pt-2.5 pb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("text-xs font-medium uppercase", isPast ? "text-muted-foreground/60" : "text-muted-foreground")}>
                        {d.toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      <span className={cn(
                        "text-sm font-semibold",
                        isToday && "flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground",
                        isPast && !isToday && "text-muted-foreground/70",
                      )}>
                        {d.getDate()}
                      </span>
                    </div>
                    {minutes > 0 && <span className="text-[10px] text-muted-foreground">{formatMinutes(minutes)}</span>}
                  </header>

                  <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1.5">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setEventDialog({ event: ev, draft: null })}
                        className="w-full text-left rounded-md px-2 py-1 text-[11px] leading-tight bg-background border border-dashed hover:border-foreground/30"
                        style={ev.color_override ? { borderLeft: `3px solid ${ev.color_override}` } : undefined}
                      >
                        <span className="text-muted-foreground">
                          {ev.all_day ? "All day" : new Date(ev.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>{" "}
                        <span className="font-medium">{ev.title}</span>
                        {ev.video_call_link && <Video className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                      </button>
                    ))}
                    {loading && list.length === 0 && [0, 1].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />)}
                    {list.map((t) => <TaskCard key={t.id} task={t} onOpen={openTask} onToggleDone={toggleDone} />)}
                    {list.length === 0 && dayEvents.length === 0 && (
                      <div className="flex justify-center gap-3 py-6 opacity-0 transition-opacity group-hover/day:opacity-100">
                        <button title="Add task" onClick={() => openQuickAdd({ planned_date: iso, project_id: projectId })}
                          className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:border-foreground/40 hover:text-foreground"><Check className="h-4 w-4" /></button>
                        <button title="Add event" onClick={() => { const s = new Date(`${iso}T10:00`); setEventDialog({ event: null, draft: { start: s, end: new Date(s.getTime() + 3600_000) } }); }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:border-foreground/40 hover:text-foreground"><CalendarPlus className="h-4 w-4" /></button>
                      </div>
                    )}
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

      <EventDialog
        open={!!eventDialog}
        onOpenChange={(o) => !o && setEventDialog(null)}
        event={eventDialog?.event ?? null}
        draft={eventDialog?.draft ?? null}
        members={members}
        teams={teams}
        currentUserId={currentUserId}
        onSaved={() => loadEvents()}
        onDeleted={(id) => setEvents((e) => e.filter((x) => x.id !== id))}
      />
    </div>
  );
}
