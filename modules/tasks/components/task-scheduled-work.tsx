"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-regular-svg-icons";
import { faPlus, faTrashCan, faChevronDown, faStopwatch } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TaskMember, TimeBlock } from "../types";
import { formatMinutes, todayISO } from "../dates";
import { initials } from "../lib/bordio";
import { cn } from "@/lib/utils";

export interface TimeEntry {
  id: string; user_id: string; started_at: string; ended_at: string | null; duration_minutes: number | null;
  description: string | null; is_manual: boolean; user: TaskMember | null;
}

/** Bordio "Scheduled work" (time blocks) + logged time sessions. */
export function TaskScheduledWork({ taskId, plannedDate, members, currentUserId, entries, onEntriesChange }: {
  taskId: string; plannedDate: string | null; members: TaskMember[]; currentUserId: string | null;
  entries: TimeEntry[]; onEntriesChange: () => void;
}) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [open, setOpen] = useState(true);
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
    const res = await fetch("/api/tasks/time-blocks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, start_at: new Date(`${date}T${start}`).toISOString(), end_at: new Date(`${date}T${end}`).toISOString() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Could not schedule"); return; }
    setBlocks((b) => [...b, json.block].sort((x, y) => x.start_at.localeCompare(y.start_at)));
    setAdding(false);
  }

  async function removeBlock(id: string) {
    const res = await fetch(`/api/tasks/time-blocks?id=${id}`, { method: "DELETE" });
    if (res.ok) setBlocks((b) => b.filter((x) => x.id !== id));
  }

  async function removeEntry(id: string) {
    const res = await fetch(`/api/tasks/${taskId}/time?entry_id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Could not delete"); return; }
    onEntriesChange();
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const logged = entries.filter((e) => e.ended_at);
  const loggedTotal = logged.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  return (
    <section className="border-t px-6 py-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-sm font-medium">
        <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
        Scheduled work <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{blocks.length}</span>
        <FontAwesomeIcon icon={faChevronDown} className={cn("ml-auto h-3 w-3 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>

      {open && (
        <div className="mt-3">
          {blocks.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Date</th><th className="pb-2 font-normal">User</th><th className="pb-2 font-normal">Planned time</th><th />
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const s = new Date(b.start_at), e = new Date(b.end_at);
                  const u = b.user_id ? byId.get(b.user_id) : null;
                  return (
                    <tr key={b.id} className="group border-t">
                      <td className="py-2">
                        <span className="block text-[10px] uppercase text-muted-foreground">{s.toLocaleDateString("en-IN", { month: "short" })}</span>
                        <span className="text-base font-semibold leading-none">{s.getDate()}</span>
                      </td>
                      <td className="py-2">
                        <span title={u?.full_name} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{initials(u?.full_name)}</span>
                      </td>
                      <td className="py-2">
                        {s.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} – {e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        <span className="ml-2 text-xs text-muted-foreground">{formatMinutes((e.getTime() - s.getTime()) / 60000)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <button className="opacity-0 group-hover:opacity-60 hover:!opacity-100" onClick={() => removeBlock(b.id)} aria-label="Remove">
                          <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {adding ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input type="date" className="h-8 w-36 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" className="h-8 w-24 text-xs" value={start} onChange={(e) => setStart(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" className="h-8 w-24 text-xs" value={end} onChange={(e) => setEnd(e.target.value)} />
              <Button size="sm" className="h-8" onClick={add} disabled={!date}>Save</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => { setDate(plannedDate ?? todayISO()); setAdding(true); }} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
              <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Schedule more work
            </button>
          )}

          {logged.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">Time logged · {formatMinutes(loggedTotal)}</p>
              {logged.map((e) => (
                <div key={e.id} className="group flex items-center gap-2 py-1 text-[13px]">
                  <span className="w-16 text-xs text-muted-foreground">{new Date(e.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="flex-1 truncate">{e.user?.full_name ?? "—"}{e.description ? ` · ${e.description}` : ""}</span>
                  <span className="inline-flex items-center gap-1 text-xs">{!e.is_manual && <FontAwesomeIcon icon={faStopwatch} className="h-3 w-3 text-muted-foreground" title="Tracked with timer" />}{formatMinutes(e.duration_minutes ?? 0)}</span>
                  {e.user_id === currentUserId && (
                    <button className="opacity-0 group-hover:opacity-60" onClick={() => removeEntry(e.id)} aria-label="Delete entry"><FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
