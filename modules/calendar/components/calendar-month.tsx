"use client";

import type { CalendarEvent } from "../types";
import { EVENT_CONFIG } from "../types";
import { cn } from "@/lib/utils";

interface CalendarMonthProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

export function CalendarMonth({ currentDate, events, onEventClick, onSlotClick }: CalendarMonthProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; currentMonth: boolean; date: Date }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({ day, currentMonth: false, date: new Date(year, month - 1, day) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const day = cells.length - daysInMonth - firstDay + 1;
    cells.push({ day, currentMonth: false, date: new Date(year, month + 1, day) });
  }

  function eventsForDate(date: Date) {
    return events.filter((e) => {
      const ed = new Date(e.start_time);
      return ed.getFullYear() === date.getFullYear() && ed.getMonth() === date.getMonth() && ed.getDate() === date.getDate();
    });
  }

  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <div className="flex-1 flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid grid-rows-5 divide-y divide-border">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-border min-h-[100px]">
            {week.map((cell, ci) => {
              const dayEvents = eventsForDate(cell.date);
              const isToday = cell.date.toDateString() === today.toDateString();
              return (
                <div
                  key={ci}
                  className={cn("p-1.5 cursor-pointer hover:bg-muted/20 transition-colors", !cell.currentMonth && "bg-muted/10")}
                  onClick={() => onSlotClick(cell.date)}
                >
                  <div className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 font-medium",
                    isToday ? "bg-purple-600 text-white" : cell.currentMonth ? "text-foreground" : "text-muted-foreground/40"
                  )}>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg = EVENT_CONFIG[ev.type];
                      return (
                        <div
                          key={ev.id}
                          className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity", cfg.bg, cfg.color)}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        >
                          {new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1.5">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
