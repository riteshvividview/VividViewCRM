"use client";

import { Video, Link2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import type { CalendarEvent } from "../types";
import { EVENT_CONFIG } from "../types";
import { cn } from "@/lib/utils";

interface CalendarAgendaProps {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

export function CalendarAgenda({ events, onEventClick }: CalendarAgendaProps) {
  const sorted = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = sorted.filter((e) => new Date(e.start_time) >= today);

  // Group by date
  const grouped = new Map<string, CalendarEvent[]>();
  upcoming.forEach((e) => {
    const key = new Date(e.start_time).toDateString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  });

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-sm text-muted-foreground gap-2">
        <CalendarIcon />
        <p>No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from(grouped.entries()).map(([dateStr, dayEvents]) => {
        const date = new Date(dateStr);
        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();
        const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

        return (
          <div key={dateStr}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold shrink-0", isToday ? "bg-purple-600 text-white" : "bg-muted text-foreground")}>
                <span className="text-[9px] leading-none">{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                <span className="text-base leading-none">{date.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground">{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="ml-4 border-l-2 border-border pl-4 space-y-2">
              {dayEvents.map((ev) => {
                const cfg = EVENT_CONFIG[ev.type];
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                return (
                  <div
                    key={ev.id}
                    className={cn("rounded-xl p-3 cursor-pointer hover:brightness-95 transition-all border", cfg.bg, cfg.border)}
                    onClick={() => onEventClick(ev)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", cfg.color)}>{cfg.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                        {ev.linked_entity_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Link2 className="h-3 w-3" />{ev.linked_entity_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-foreground">
                          {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{duration}m</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {ev.attendees.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {ev.attendees.slice(0, 3).map((a, i) => (
                            <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[9px] font-bold">{a.split(" ").map((n) => n[0]).join("")}</span>
                          ))}
                          {ev.attendees.length > 3 && <span className="text-[11px]">+{ev.attendees.length - 3}</span>}
                        </div>
                      )}
                      {ev.video_call_link && (
                        <a href={ev.video_call_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          <Video className="h-3 w-3" />Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarIcon() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
      <FontAwesomeIcon icon={faCalendarDays} className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}
