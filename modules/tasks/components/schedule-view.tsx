"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTasksContext } from "../context/tasks-context";
import { EventDialog, type EventDraft } from "./event-dialog";
import { TASK_DRAG_TYPE } from "./task-card";
import type { CalendarEvent, TimeBlock } from "../types";
import { addDays, formatMinutes, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
import { cn } from "@/lib/utils";

const HOUR_PX = 52;
const SNAP_MIN = 15;
const BLOCK_DRAG_TYPE = "application/x-vivid-block";

function minutesFromTop(y: number) {
  return Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.round((y / HOUR_PX) * 60 / SNAP_MIN) * SNAP_MIN));
}

function at(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(0, minutes, 0, 0);
  return d;
}

type Slot = { day: Date; minutes: number };

/** Hourly week schedule with time blocks (task work time) and events, Bordio-style. */
export function ScheduleView() {
  const { tasks, members, teams, currentUserId, openTask } = useTasksContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventDialog, setEventDialog] = useState<{ event: CalendarEvent | null; draft: EventDraft | null } | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = todayISO();

  const load = useCallback(async () => {
    const from = encodeURIComponent(weekStart.toISOString());
    const to = encodeURIComponent(addDays(weekStart, 7).toISOString());
    const [b, e] = await Promise.all([
      fetch(`/api/tasks/time-blocks?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/tasks/events?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setBlocks(b.blocks ?? []);
    setEvents(e.events ?? []);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX - 10;
    return () => clearInterval(t);
  }, []);

  // Tasks I could block time for this week: mine, not done, planned this week or unscheduled.
  const weekEnd = toISODate(addDays(weekStart, 6));
  const candidates = useMemo(() => tasks.filter((t) =>
    t.status !== "done" &&
    (t.assignees.some((a) => a.id === currentUserId) || (t.assignees.length === 0 && t.created_by === currentUserId)) &&
    (!t.planned_date || (t.planned_date >= toISODate(weekStart) && t.planned_date <= weekEnd)),
  ), [tasks, currentUserId, weekStart, weekEnd]);

  async function createBlock(taskId: string, start: Date, minutes: number) {
    const res = await fetch("/api/tasks/time-blocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, start_at: start.toISOString(), end_at: new Date(start.getTime() + minutes * 60000).toISOString() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Could not create time block"); return; }
    setBlocks((b) => [...b, json.block]);
  }

  async function moveBlock(block: TimeBlock, start: Date) {
    const dur = new Date(block.end_at).getTime() - new Date(block.start_at).getTime();
    const end = new Date(start.getTime() + dur);
    setBlocks((b) => b.map((x) => (x.id === block.id ? { ...x, start_at: start.toISOString(), end_at: end.toISOString() } : x)));
    const res = await fetch("/api/tasks/time-blocks", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: block.id, start_at: start.toISOString(), end_at: end.toISOString() }),
    });
    if (!res.ok) { toast.error("Could not move time block"); load(); }
  }

  async function deleteBlock(id: string) {
    setBlocks((b) => b.filter((x) => x.id !== id));
    await fetch(`/api/tasks/time-blocks?id=${id}`, { method: "DELETE" });
  }

  function onDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const minutes = minutesFromTop(e.clientY - rect.top);
    const blockId = e.dataTransfer.getData(BLOCK_DRAG_TYPE);
    if (blockId) {
      const block = blocks.find((b) => b.id === blockId);
      const offset = Number(e.dataTransfer.getData("text/offset-min") || 0);
      if (block) moveBlock(block, at(day, Math.max(0, minutes - offset)));
      return;
    }
    const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
    const task = tasks.find((t) => t.id === taskId);
    if (task) createBlock(task.id, at(day, minutes), Math.max(SNAP_MIN, Math.round((task.estimated_hours ?? 1) * 60)));
  }

  const allDay = events.filter((e) => e.all_day);
  const timed = events.filter((e) => !e.all_day);

  function layout(startIso: string, endIso: string, day: Date) {
    const s = new Date(startIso), e = new Date(endIso);
    const dayStart = at(day, 0).getTime();
    const top = Math.max(0, (s.getTime() - dayStart) / 60000) * (HOUR_PX / 60);
    const bottom = Math.min(24 * 60, (e.getTime() - dayStart) / 60000) * (HOUR_PX / 60);
    return { top, height: Math.max(18, bottom - top) };
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[520px]">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h1 className="text-lg font-semibold mr-2">Schedule</h1>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <Button size="sm" variant="outline" className="h-8 ml-auto" onClick={() => {
          const s = new Date(); s.setMinutes(0, 0, 0); s.setHours(s.getHours() + 1);
          setEventDialog({ event: null, draft: { start: s, end: new Date(s.getTime() + 3600_000) } });
        }}><CalendarPlus className="h-4 w-4 mr-1.5" />Event</Button>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border bg-card overflow-hidden">
          {/* Day headers + all-day row */}
          <div className="grid border-b" style={{ gridTemplateColumns: "56px repeat(7, minmax(110px, 1fr))" }}>
            <div />
            {days.map((d) => {
              const iso = toISODate(d);
              return (
                <div key={iso} className="px-2 py-2 border-l text-center">
                  <p className="text-[11px] uppercase text-muted-foreground">{d.toLocaleDateString("en-IN", { weekday: "short" })}</p>
                  <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", iso === today && "bg-primary text-primary-foreground")}>{d.getDate()}</p>
                  <div className="mt-1 space-y-0.5">
                    {allDay.filter((e) => toISODate(new Date(e.start_time)) === iso).map((e) => (
                      <button key={e.id} onClick={() => setEventDialog({ event: e, draft: null })} className="block w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{e.title}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour grid */}
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, minmax(110px, 1fr))", height: 24 * HOUR_PX }}>
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * HOUR_PX }}>
                    {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                  </span>
                ))}
              </div>
              {days.map((d) => {
                const iso = toISODate(d);
                return (
                  <div
                    key={iso}
                    className={cn("relative border-l", iso === today && "bg-primary/[0.02]")}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => onDrop(e, d)}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSlot({ day: d, minutes: minutesFromTop(e.clientY - rect.top) });
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-border/60 pointer-events-none" style={{ top: h * HOUR_PX }} />
                    ))}

                    {timed.filter((e) => toISODate(new Date(e.start_time)) === iso).map((e) => {
                      const { top, height } = layout(e.start_time, e.end_time, d);
                      return (
                        <button
                          key={e.id}
                          onClick={() => setEventDialog({ event: e, draft: null })}
                          className="absolute left-1 right-1 overflow-hidden rounded-md border border-dashed bg-background px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm hover:border-foreground/40"
                          style={{ top, height, borderLeft: `3px solid ${e.color_override ?? "#64748b"}` }}
                        >
                          <p className="font-medium truncate">{e.title}</p>
                          <p className="text-muted-foreground">{new Date(e.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                        </button>
                      );
                    })}

                    {blocks.filter((b) => toISODate(new Date(b.start_at)) === iso).map((b) => {
                      const { top, height } = layout(b.start_at, b.end_at, d);
                      const task = tasks.find((t) => t.id === b.task_id);
                      const color = task?.color ?? b.task?.color ?? task?.project?.color ?? b.task?.project?.color ?? "#6366f1";
                      const done = (task?.status ?? b.task?.status) === "done";
                      return (
                        <div
                          key={b.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(BLOCK_DRAG_TYPE, b.id);
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setData("text/offset-min", String(minutesFromTop(e.clientY - rect.top)));
                          }}
                          onClick={() => task && openTask(task)}
                          className={cn("group absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight text-white shadow-sm cursor-grab active:cursor-grabbing", done && "opacity-50 line-through")}
                          style={{ top, height, backgroundColor: color }}
                        >
                          <p className="font-medium truncate pr-4">{task?.title ?? b.task?.title ?? "Task"}</p>
                          <p className="opacity-80">
                            {new Date(b.start_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {formatMinutes((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000)}
                          </p>
                          <button
                            aria-label="Remove time block"
                            onClick={(ev) => { ev.stopPropagation(); deleteBlock(b.id); }}
                            className="absolute right-1 top-1 hidden rounded bg-black/20 p-0.5 group-hover:block"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    {now && iso === today && (
                      <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60) }}>
                        <div className="h-px bg-red-500" /><div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tasks to schedule */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col min-h-0 rounded-xl border bg-card">
          <header className="px-3 pt-2.5 pb-2 border-b">
            <h2 className="text-sm font-semibold">My tasks this week</h2>
            <p className="text-[11px] text-muted-foreground">Drag onto the grid to block time</p>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {candidates.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing left to schedule this week.</p>}
            {candidates.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(TASK_DRAG_TYPE, t.id)}
                onClick={() => openTask(t)}
                className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm cursor-grab hover:border-foreground/20"
                style={t.color || t.project?.color ? { borderLeft: `3px solid ${t.color ?? t.project?.color}` } : undefined}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{t.title}</span>
                {t.estimated_hours ? <span className="text-[10px] text-muted-foreground">{formatMinutes(t.estimated_hours * 60)}</span> : null}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Click on an empty slot */}
      <SlotDialog
        slot={slot}
        onClose={() => setSlot(null)}
        candidates={candidates}
        onEvent={(s) => { setSlot(null); setEventDialog({ event: null, draft: { start: s, end: new Date(s.getTime() + 3600_000) } }); }}
        onBlock={(taskId, s, mins) => { setSlot(null); createBlock(taskId, s, mins); }}
      />

      <EventDialog
        open={!!eventDialog}
        onOpenChange={(o) => !o && setEventDialog(null)}
        event={eventDialog?.event ?? null}
        draft={eventDialog?.draft ?? null}
        members={members}
        teams={teams}
        currentUserId={currentUserId}
        onSaved={() => load()}
        onDeleted={(id) => setEvents((e) => e.filter((x) => x.id !== id))}
      />
    </div>
  );
}

function SlotDialog({ slot, onClose, candidates, onEvent, onBlock }: {
  slot: Slot | null;
  onClose: () => void;
  candidates: { id: string; title: string; estimated_hours: number | null }[];
  onEvent: (start: Date) => void;
  onBlock: (taskId: string, start: Date, minutes: number) => void;
}) {
  const [taskId, setTaskId] = useState("");
  const [minutes, setMinutes] = useState(60);
  useEffect(() => { setTaskId(""); setMinutes(60); }, [slot]);
  if (!slot) return null;
  const start = at(slot.day, slot.minutes);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">Block time for a task</p>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={taskId}
            onChange={(e) => { setTaskId(e.target.value); const t = candidates.find((c) => c.id === e.target.value); if (t?.estimated_hours) setMinutes(Math.round(t.estimated_hours * 60)); }}>
            <option value="">Select a task…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <div className="flex items-center gap-2 text-sm">
            Duration
            <Input type="number" min={15} step={15} className="h-8 w-24" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
            min
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onEvent(start)}><CalendarPlus className="h-4 w-4 mr-1.5" />New event instead</Button>
          <Button disabled={!taskId} onClick={() => onBlock(taskId, start, Math.max(15, minutes))}>Block time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
