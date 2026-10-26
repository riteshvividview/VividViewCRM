"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssigneePicker } from "./assignee-picker";
import type { CalendarEvent, TaskMember, TaskTeam } from "../types";
import { TASK_COLORS } from "../types";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface EventDraft { start: Date; end: Date }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Existing event to edit, or a draft time range for a new one. */
  event: CalendarEvent | null;
  draft?: EventDraft | null;
  members: TaskMember[];
  teams: TaskTeam[];
  currentUserId: string | null;
  onSaved: (e: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}

/** Create / edit a calendar event (meeting) shown in the planner and schedule. */
export function EventDialog({ open, onOpenChange, event, draft, members, teams, currentUserId, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [allDay, setAllDay] = useState(false);
  const [attendees, setAttendees] = useState<TaskMember[]>([]);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = !event || event.created_by === currentUserId;

  useEffect(() => {
    if (!open) return;
    const s = event ? new Date(event.start_time) : draft?.start ?? new Date();
    const e = event ? new Date(event.end_time) : draft?.end ?? new Date(s.getTime() + 3600_000);
    setTitle(event?.title ?? "");
    setDate(localDate(s));
    setStart(localTime(s));
    setEnd(localTime(e));
    setAllDay(event?.all_day ?? false);
    setAttendees(members.filter((m) => event?.attendees?.includes(m.id) && m.id !== currentUserId));
    setLink(event?.video_call_link ?? "");
    setNotes(event?.notes ?? "");
    setColor(event?.color_override ?? null);
  }, [open, event, draft, members, currentUserId]);

  async function save() {
    if (!title.trim()) { toast.error("Give the event a title"); return; }
    const s = allDay ? new Date(`${date}T00:00`) : new Date(`${date}T${start}`);
    const e = allDay ? new Date(`${date}T23:59`) : new Date(`${date}T${end}`);
    if (e <= s) { toast.error("End time must be after the start time"); return; }
    setSaving(true);
    const res = await fetch("/api/tasks/events", {
      method: event ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: event?.id, title: title.trim(), start_time: s.toISOString(), end_time: e.toISOString(), all_day: allDay,
        attendees: attendees.map((a) => a.id), video_call_link: link.trim(), notes: notes.trim(), color,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Could not save event"); return; }
    toast.success(event ? "Event updated" : "Event created");
    onSaved(json.event);
    onOpenChange(false);
  }

  async function remove() {
    if (!event || !window.confirm("Delete this event for everyone?")) return;
    const res = await fetch(`/api/tasks/events?id=${event.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Could not delete event"); return; }
    onDeleted(event.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{event ? (canEdit ? "Edit event" : event.title) : "New event"}</DialogTitle></DialogHeader>
        <fieldset disabled={!canEdit} className="grid gap-3">
          <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" className="h-9 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            {!allDay && <>
              <Input type="time" className="h-9 w-28" value={start} onChange={(e) => setStart(e.target.value)} />
              <span className="text-sm text-muted-foreground">–</span>
              <Input type="time" className="h-9 w-28" value={end} onChange={(e) => setEnd(e.target.value)} />
            </>}
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />All day</label>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground font-normal">Participants</Label>
            <AssigneePicker
              value={attendees} members={members.filter((m) => m.id !== currentUserId)} teams={teams}
              onAddUsers={(ids) => setAttendees((p) => [...p, ...members.filter((m) => ids.includes(m.id) && m.id !== currentUserId && !p.some((x) => x.id === m.id))])}
              onAddTeam={(tid) => { const t = teams.find((x) => x.id === tid); if (t) setAttendees((p) => [...p, ...members.filter((m) => t.member_ids.includes(m.id) && m.id !== currentUserId && !p.some((x) => x.id === m.id))]); }}
              onRemove={(id) => setAttendees((p) => p.filter((m) => m.id !== id))}
            />
          </div>
          <div className="relative">
            <Video className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Video call link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <Textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center gap-1.5">
            {TASK_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(color === c ? null : c)}
                className={cn("h-5 w-5 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />
            ))}
          </div>
        </fieldset>
        {event?.video_call_link && (
          <a href={event.video_call_link} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Join video call</a>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {event && canEdit ? <Button variant="ghost" className="text-red-600" onClick={remove}><Trash2 className="h-4 w-4 mr-1.5" />Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
