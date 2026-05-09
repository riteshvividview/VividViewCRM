"use client";

import { useEffect, useState } from "react";
import { X, Trash2, Video, Link2, Users, Clock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarEvent, EventType } from "../types";
import { EVENT_CONFIG } from "../types";
import { cn } from "@/lib/utils";

interface EventDetailPopupProps {
  event: CalendarEvent | null;
  isNew?: boolean;
  initialTime?: { start: string; end: string };
  open: boolean;
  onClose: () => void;
  onSave: (e: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
}

export function EventDetailPopup({ event, isNew = false, initialTime, open, onClose, onSave, onDelete }: EventDetailPopupProps) {
  const [form, setForm] = useState<Partial<CalendarEvent>>({});

  useEffect(() => {
    if (event) {
      setForm(event);
    } else if (isNew) {
      setForm({
        title: "",
        type: "meeting",
        start_time: initialTime?.start ?? new Date().toISOString(),
        end_time: initialTime?.end ?? new Date(Date.now() + 3600000).toISOString(),
        attendees: [],
        notes: "",
        video_call_link: null,
        linked_entity_type: null,
        linked_entity_id: null,
        linked_entity_name: null,
      });
    }
  }, [event, isNew, initialTime, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof CalendarEvent>(key: K, value: CalendarEvent[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toDateTimeLocal(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  const cfg = EVENT_CONFIG[form.type ?? "meeting"];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header stripe */}
          <div className={cn("px-5 pt-4 pb-3 border-b border-border", cfg.bg)}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold flex items-center gap-1.5", cfg.color)}>
                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                {cfg.label}
              </span>
              <div className="flex items-center gap-1">
                {!isNew && onDelete && event && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onDelete(event.id); onClose(); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            {isNew ? (
              <Input
                className="mt-2 text-lg font-bold border-0 bg-transparent p-0 focus-visible:ring-0 text-foreground placeholder:text-foreground/40"
                placeholder="Event title…"
                value={form.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                autoFocus
              />
            ) : (
              <h2 className="text-lg font-bold text-foreground mt-1">{form.title}</h2>
            )}
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Type */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Type</span>
              <Select value={form.type ?? "meeting"} onValueChange={(v) => set("type", v as EventType)}>
                <SelectTrigger className="h-8 text-xs flex-1 max-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_CONFIG) as EventType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className={cn("flex items-center gap-2", EVENT_CONFIG[t].color)}>
                        <span className={cn("w-2 h-2 rounded-full", EVENT_CONFIG[t].dot)} />
                        {EVENT_CONFIG[t].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1.5"><Clock className="h-3 w-3" />Start</span>
              <Input type="datetime-local" className="h-8 text-xs flex-1" value={form.start_time ? toDateTimeLocal(form.start_time) : ""} onChange={(e) => set("start_time", new Date(e.target.value).toISOString())} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1.5"><Clock className="h-3 w-3" />End</span>
              <Input type="datetime-local" className="h-8 text-xs flex-1" value={form.end_time ? toDateTimeLocal(form.end_time) : ""} onChange={(e) => set("end_time", new Date(e.target.value).toISOString())} />
            </div>

            {/* Video call */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1.5"><Video className="h-3 w-3" />Video Link</span>
              <Input className="h-8 text-xs flex-1" placeholder="https://meet.google.com/…" value={form.video_call_link ?? ""} onChange={(e) => set("video_call_link", e.target.value || null)} />
            </div>

            {/* Linked entity */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 flex items-center gap-1.5"><Link2 className="h-3 w-3" />Linked To</span>
              <Input className="h-8 text-xs flex-1" placeholder="Contact or deal name…" value={form.linked_entity_name ?? ""} onChange={(e) => set("linked_entity_name", e.target.value || null)} />
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <Textarea className="text-sm resize-none" rows={3} placeholder="Add notes…" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {/* Attendees */}
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="h-3 w-3" />Attendees</p>
              <div className="flex flex-wrap gap-1.5">
                {(form.attendees ?? []).map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                    {a}
                    <button onClick={() => set("attendees", (form.attendees ?? []).filter((_, j) => j !== i))}>
                      <X className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/30">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { onSave(form); onClose(); }} disabled={!form.title?.trim()}>
              {isNew ? "Create Event" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
