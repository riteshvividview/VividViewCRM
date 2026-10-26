"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimeBlock } from "../types";
import { formatMinutes, todayISO } from "../dates";

/** Time blocks reserve calendar time to work on a task (Bordio "time blocks"). */
export function TaskTimeBlocks({ taskId, plannedDate, estimatedHours }: { taskId: string; plannedDate: string | null; estimatedHours: number | null }) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/time-blocks?task_id=${taskId}`);
    if (res.ok) setBlocks((await res.json()).blocks ?? []);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);
    const res = await fetch("/api/tasks/time-blocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, start_at: startAt.toISOString(), end_at: endAt.toISOString() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Could not add time block"); return; }
    setBlocks((b) => [...b, json.block].sort((a, c) => a.start_at.localeCompare(c.start_at)));
    setAdding(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/time-blocks?id=${id}`, { method: "DELETE" });
    if (res.ok) setBlocks((b) => b.filter((x) => x.id !== id));
  }

  const scheduledMin = blocks.reduce((t, b) => t + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000, 0);

  return (
    <div className="px-5 py-4 border-b border-border/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />Time blocks
          <span className="normal-case font-normal">
            {formatMinutes(scheduledMin)}{estimatedHours ? ` of ${formatMinutes(estimatedHours * 60)} estimated` : " scheduled"}
          </span>
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground"
          onClick={() => { setDate(plannedDate ?? todayISO()); setAdding(true); }}>
          <Plus className="h-3 w-3" />Add
        </Button>
      </div>
      {blocks.length === 0 && !adding && <p className="text-xs text-muted-foreground">Reserve time in your schedule to work on this task.</p>}
      <div className="space-y-1">
        {blocks.map((b) => {
          const s = new Date(b.start_at), e = new Date(b.end_at);
          return (
            <div key={b.id} className="group flex items-center gap-2 text-sm rounded-md px-2 py-1 hover:bg-muted/50">
              <span className="w-1 self-stretch rounded bg-primary/60" />
              <span className="flex-1">
                {s.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                {s.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}–{e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-xs text-muted-foreground">{formatMinutes((e.getTime() - s.getTime()) / 60000)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(b.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="date" className="h-8 w-36 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input type="time" className="h-8 w-24 text-xs" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="time" className="h-8 w-24 text-xs" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Button size="sm" className="h-8" onClick={add} disabled={!date}>Save</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
