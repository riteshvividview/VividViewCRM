"use client";

import { dateLocale, formatTime } from "@/lib/user-prefs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, GripVertical } from "@/components/shared/fa-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTasksContext } from "../context/tasks-context";
import { TASK_DRAG_TYPE } from "./task-card";
import type { TimeBlock } from "../types";
import { addDays, formatMinutes, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
import { cn } from "@/lib/utils";

const HOUR_PX = 56;
/** Distance from the top / bottom edge (px) where dragging starts scrolling the grid. */
const EDGE_PX = 72;
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

/** Parts of the day shown down the side of the grid and on the drop preview. */
const PERIODS: { label: string; from: number; to: number; tint: string; text: string }[] = [
  { label: "Night", from: 0, to: 6, tint: "bg-slate-500/[0.05]", text: "text-slate-500" },
  { label: "Morning", from: 6, to: 12, tint: "bg-amber-400/[0.06]", text: "text-amber-600 dark:text-amber-400" },
  { label: "Afternoon", from: 12, to: 17, tint: "bg-sky-400/[0.05]", text: "text-sky-600 dark:text-sky-400" },
  { label: "Evening", from: 17, to: 21, tint: "bg-violet-500/[0.06]", text: "text-violet-600 dark:text-violet-400" },
  { label: "Night", from: 21, to: 24, tint: "bg-slate-500/[0.05]", text: "text-slate-500" },
];
const periodOf = (minutes: number) => PERIODS.find((p) => minutes >= p.from * 60 && minutes < p.to * 60) ?? PERIODS[0];

/** What is being dragged, so the grid can preview where and when it will land. */
type Dragging = { title: string; minutes: number; offset: number };
type Hover = { iso: string; minutes: number };

/** Hourly week schedule with time blocks (task work time). */
export function ScheduleView() {
  const { tasks, currentUserId, openTask } = useTasksContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const pointerY = useRef<number | null>(null);
  const endDrag = () => { setDragging(null); setHover(null); pointerY.current = null; };
  const [edge, setEdge] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!dragging) { setEdge(null); return; }
    let frame = 0;
    const tick = () => {
      const el = scrollRef.current, y = pointerY.current;
      if (el && y !== null) {
        const r = el.getBoundingClientRect();
        // Faster the closer the pointer gets to the edge.
        const down = y > r.bottom - EDGE_PX ? (y - (r.bottom - EDGE_PX)) / EDGE_PX : 0;
        const up = y < r.top + EDGE_PX ? ((r.top + EDGE_PX) - y) / EDGE_PX : 0;
        if (down > 0) el.scrollTop += Math.ceil(4 + 18 * Math.min(1, down));
        else if (up > 0) el.scrollTop -= Math.ceil(4 + 18 * Math.min(1, up));
        setEdge(down > 0 && el.scrollTop + el.clientHeight < el.scrollHeight ? "down" : up > 0 && el.scrollTop > 0 ? "up" : null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);
  const [now, setNow] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = todayISO();

  const load = useCallback(async () => {
    const from = encodeURIComponent(weekStart.toISOString());
    const to = encodeURIComponent(addDays(weekStart, 7).toISOString());
    const b = await fetch(`/api/tasks/time-blocks?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({}));
    setBlocks(b.blocks ?? []);
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
    endDrag();
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

  const plannedMinutes = useMemo(
    () => blocks.reduce((sum, b) => sum + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000, 0),
    [blocks],
  );

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
        <h1 className="mr-2 text-lg font-semibold">Schedule</h1>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
        <div className="flex items-center rounded-lg border">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" aria-label="Previous week" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none border-l" aria-label="Next week" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {plannedMinutes ? <>Planned this week: <span className="font-semibold text-foreground">{formatMinutes(plannedMinutes)}</span></> : "Nothing planned this week yet"}
        </span>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border bg-card overflow-hidden">
          {/* Day headers + all-day row */}
          <div className="grid border-b" style={{ gridTemplateColumns: "72px repeat(7, minmax(110px, 1fr))" }}>
            <div />
            {days.map((d) => {
              const iso = toISODate(d);
              return (
                <div key={iso} className={cn("border-l px-2 py-2 text-center", iso === today && "bg-primary/[0.04]")}>
                  <p className={cn("text-[11px] font-medium uppercase tracking-wide", iso === today ? "text-primary" : "text-muted-foreground")}>{d.toLocaleDateString(dateLocale(), { weekday: "short" })}</p>
                  <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", iso === today && "bg-primary text-primary-foreground")}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Hour grid */}
          <div className="relative min-h-0 flex-1">
          {edge && (
            <div className={cn("pointer-events-none absolute inset-x-0 z-30 flex h-10 items-center justify-center bg-gradient-to-b text-[11px] font-medium text-primary",
              edge === "up" ? "top-0 from-primary/15 to-transparent" : "bottom-0 rotate-180 from-primary/15 to-transparent")}>
              <span className={cn(edge === "down" && "rotate-180")}>{edge === "up" ? "Scrolling up" : "Scrolling down"}</span>
            </div>
          )}
          <div ref={scrollRef} className="h-full overflow-auto"
            onDragOver={(e) => { if (dragging) pointerY.current = e.clientY; }}
            onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) pointerY.current = null; }}>
            <div className="grid relative" style={{ gridTemplateColumns: "72px repeat(7, minmax(110px, 1fr))", height: 24 * HOUR_PX }}>
              <div className="relative">
                {PERIODS.map((p, i) => (
                  <div key={i} className={cn("absolute inset-x-0 border-t border-border/80", p.tint)} style={{ top: p.from * HOUR_PX, height: (p.to - p.from) * HOUR_PX }}>
                    <span className={cn("absolute left-1.5 top-1.5 text-[9px] font-semibold uppercase tracking-wider", p.text)}>{p.label}</span>
                  </div>
                ))}
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * HOUR_PX }}>
                    {h === 0 || PERIODS.some((p) => p.from === h) ? "" : formatTime(at(new Date(), h * 60))}
                  </span>
                ))}
              </div>
              {days.map((d) => {
                const iso = toISODate(d);
                return (
                  <div
                    key={iso}
                    className={cn("relative border-l", iso === today && "bg-primary/[0.02]")}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (!dragging) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const minutes = Math.max(0, minutesFromTop(e.clientY - rect.top) - dragging.offset);
                      if (hover?.iso !== iso || hover.minutes !== minutes) setHover({ iso, minutes });
                    }}
                    onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setHover((h) => (h?.iso === iso ? null : h)); }}
                    onDrop={(e) => onDrop(e, d)}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSlot({ day: d, minutes: minutesFromTop(e.clientY - rect.top) });
                    }}
                  >
                    {PERIODS.map((p, i) => (
                      <div key={`p${i}`} className={cn("pointer-events-none absolute inset-x-0", p.tint)} style={{ top: p.from * HOUR_PX, height: (p.to - p.from) * HOUR_PX }} />
                    ))}
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className={cn("absolute inset-x-0 border-t pointer-events-none", PERIODS.some((p) => p.from === h && h > 0) ? "border-border" : "border-border/60")} style={{ top: h * HOUR_PX }} />
                    ))}

                    {dragging && hover?.iso === iso && (() => {
                      const start = at(d, hover.minutes);
                      const end = new Date(start.getTime() + dragging.minutes * 60000);
                      const period = periodOf(hover.minutes);
                      return (
                        <div className="pointer-events-none absolute left-1 right-1 z-20 overflow-hidden rounded-md border-2 border-dashed border-primary bg-primary/10 px-1.5 py-1 text-[11px] leading-tight shadow-sm"
                          style={{ top: hover.minutes * (HOUR_PX / 60), height: Math.max(22, dragging.minutes * (HOUR_PX / 60)) }}>
                          <p className={cn("font-semibold uppercase tracking-wide", period.text)}>{period.label}</p>
                          <p className="font-medium text-foreground">{formatTime(start)} – {formatTime(end)}</p>
                          <p className="truncate text-muted-foreground">{dragging.title}</p>
                        </div>
                      );
                    })()}

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
                            const offset = minutesFromTop(e.clientY - rect.top);
                            e.dataTransfer.setData("text/offset-min", String(offset));
                            setDragging({ title: task?.title ?? b.task?.title ?? "Task", minutes: (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000, offset });
                          }}
                          onDragEnd={endDrag}
                          onClick={() => task && openTask(task)}
                          className={cn("group absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border-l-4 px-2 py-1 text-[11px] leading-tight text-white shadow-md transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lg active:cursor-grabbing", done && "opacity-50 line-through", dragging && "pointer-events-none opacity-60")}
                          style={{ top, height, backgroundColor: color, borderLeftColor: "rgba(0,0,0,0.25)" }}
                        >
                          <p className="truncate pr-4 font-semibold">{task?.title ?? b.task?.title ?? "Task"}</p>
                          <p className="opacity-85">
                            {formatTime(new Date(b.start_at))} – {formatTime(new Date(b.end_at))}
                            <span className="opacity-75"> · {periodOf(new Date(b.start_at).getHours() * 60 + new Date(b.start_at).getMinutes()).label}</span>
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
                        <div className="h-0.5 bg-red-500" /><div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
                        <span className="absolute -top-2.5 right-1 rounded bg-red-500 px-1 text-[9px] font-semibold text-white">{formatTime(now)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>

        {/* Tasks to schedule */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col min-h-0 rounded-xl border bg-card">
          <header className="border-b px-3 pb-2.5 pt-3">
            <h2 className="flex items-center justify-between text-sm font-semibold">My tasks this week<span className="rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{candidates.length}</span></h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Drag a task onto a time. Drag to the top or bottom edge to scroll.</p>
          </header>
          <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto p-2">
            {candidates.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing left to schedule this week.</p>}
            {candidates.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData(TASK_DRAG_TYPE, t.id); setDragging({ title: t.title, minutes: Math.max(SNAP_MIN, Math.round((t.estimated_hours ?? 1) * 60)), offset: 0 }); }}
                onDragEnd={endDrag}
                onClick={() => openTask(t)}
                className="group flex cursor-grab items-start gap-2 rounded-lg border bg-background px-2.5 py-2 text-sm shadow-sm transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-md active:cursor-grabbing"
                style={{ borderLeft: `4px solid ${t.type?.color ?? t.color ?? t.project?.color ?? "#94a3b8"}` }}
              >
                <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {t.project && <><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.project.color ?? "#6366f1" }} /><span className="truncate">{t.project.name}</span></>}
                    {t.due_date && <span className="shrink-0">{t.project ? "· " : ""}Due {new Date(`${t.due_date}T00:00:00`).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })}</span>}
                    {!t.project && !t.due_date && "No brand"}
                  </span>
                </span>
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
        onBlock={(taskId, s, mins) => { setSlot(null); createBlock(taskId, s, mins); }}
      />

    </div>
  );
}

function SlotDialog({ slot, onClose, candidates, onBlock }: {
  slot: Slot | null;
  onClose: () => void;
  candidates: { id: string; title: string; estimated_hours: number | null }[];
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
          <DialogTitle>{start.toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "short" })} · {formatTime(start)}</DialogTitle>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!taskId} onClick={() => onBlock(taskId, start, Math.max(15, minutes))}>Block time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
