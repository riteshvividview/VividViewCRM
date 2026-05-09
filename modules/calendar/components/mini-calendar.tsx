"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onNavigate: (d: Date) => void;
  eventDates?: Set<string>;
}

export function MiniCalendar({ currentDate, selectedDate, onSelectDate, onNavigate, eventDates = new Set() }: MiniCalendarProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function prev() { const d = new Date(year, month - 1, 1); onNavigate(d); }
  function next() { const d = new Date(year, month + 1, 1); onNavigate(d); }

  return (
    <div className="bg-card border border-border rounded-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prev} className="p-1 rounded hover:bg-muted transition-colors"><ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" /></button>
        <span className="text-xs font-semibold text-foreground">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={next} className="p-1 rounded hover:bg-muted transition-colors"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(year, month, day);
          d.setHours(0, 0, 0, 0);
          const isToday = d.toDateString() === today.toDateString();
          const isSelected = d.toDateString() === selectedDate.toDateString();
          const hasEvent = eventDates.has(d.toISOString().split("T")[0]);
          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={cn(
                "relative flex flex-col items-center justify-center h-7 w-7 rounded-full mx-auto text-[11px] transition-colors",
                isSelected ? "bg-purple-600 text-white font-bold" :
                  isToday ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold" :
                  "text-foreground hover:bg-muted"
              )}
            >
              {day}
              {hasEvent && !isSelected && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-purple-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
