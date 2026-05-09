"use client";

import { useRef } from "react";
import type { CalendarEvent } from "../types";
import { EVENT_CONFIG } from "../types";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 56; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface CalendarWeekProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

export function CalendarWeek({ currentDate, events, onEventClick, onSlotClick }: CalendarWeekProps) {
  const today = new Date();
  const containerRef = useRef<HTMLDivElement>(null);

  // Get week start (Sunday)
  const weekStart = new Date(currentDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function eventsForDay(date: Date) {
    return events.filter((e) => {
      const ed = new Date(e.start_time);
      return ed.toDateString() === date.toDateString();
    });
  }

  function eventTop(event: CalendarEvent) {
    const start = new Date(event.start_time);
    return (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
  }

  function eventHeight(event: CalendarEvent) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const diff = (end.getTime() - start.getTime()) / 3600000;
    return Math.max(diff * HOUR_HEIGHT, 24);
  }

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} className="flex-1 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-semibold mt-0.5", isToday ? "bg-purple-600 text-white" : "text-foreground")}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} style={{ top: h * HOUR_HEIGHT }} className="absolute right-2 text-[10px] text-muted-foreground -translate-y-2">
                {h === 0 ? "" : `${h % 12 || 12}${h < 12 ? "a" : "p"}`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const dayEvents = eventsForDay(day);
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={di} className="flex-1 relative border-l border-border">
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div key={h} style={{ top: h * HOUR_HEIGHT }} className="absolute left-0 right-0 border-t border-border/40"
                    onClick={() => { const d = new Date(day); d.setHours(h, 0, 0, 0); onSlotClick(d); }} />
                ))}
                {/* Now line */}
                {isToday && (
                  <div style={{ top: nowTop }} className="absolute left-0 right-0 flex items-center z-10">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}
                {/* Events */}
                {dayEvents.map((ev) => {
                  const cfg = EVENT_CONFIG[ev.type];
                  const top = eventTop(ev);
                  const height = eventHeight(ev);
                  return (
                    <div
                      key={ev.id}
                      style={{ top, height, left: 2, right: 2 }}
                      className={cn("absolute rounded-lg px-2 py-1 cursor-pointer border overflow-hidden z-10 hover:brightness-95 transition-all", cfg.bg, cfg.border)}
                      onClick={() => onEventClick(ev)}
                    >
                      <p className={cn("text-[10px] font-bold truncate", cfg.color)}>{ev.title}</p>
                      {height > 30 && (
                        <p className={cn("text-[9px] truncate", cfg.color, "opacity-80")}>
                          {new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
