"use client";

import { useMemo } from "react";
import type { Task } from "../types";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "../types";
import { cn } from "@/lib/utils";

const DAY_WIDTH = 48; // px per day
const TOTAL_DAYS = 30;

interface TaskTimelineProps {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
}

export function TaskTimeline({ tasks, onTaskClick }: TaskTimelineProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i - 3); // start 3 days before today
      return d;
    });
  }, [today]);

  const tasksWithDates = tasks.filter((t) => t.due_date);

  function dayOffset(date: Date) {
    const diff = Math.floor((date.getTime() - days[0].getTime()) / 86400000);
    return diff;
  }

  const todayOffset = dayOffset(today);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div style={{ minWidth: TOTAL_DAYS * DAY_WIDTH + 200 }}>
        {/* Header */}
        <div className="flex border-b border-border sticky top-0 bg-card z-10">
          <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border bg-muted/30">
            Task
          </div>
          <div className="flex">
            {days.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  style={{ width: DAY_WIDTH }}
                  className={cn(
                    "shrink-0 py-2 text-center text-[10px] border-r border-border/50",
                    isToday ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 font-bold" : isWeekend ? "bg-muted/30 text-muted-foreground/60" : "text-muted-foreground"
                  )}
                >
                  <div className="font-medium">{d.getDate()}</div>
                  <div>{d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {tasksWithDates.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks with due dates
          </div>
        ) : (
          tasksWithDates.map((task) => {
            const dueDate = new Date(task.due_date!);
            dueDate.setHours(0, 0, 0, 0);
            const offset = dayOffset(dueDate);
            const priCfg = PRIORITY_CONFIG[task.priority];
            const stsCfg = STATUS_CONFIG[task.status];
            const isOverdue = dueDate < today && task.status !== "done";
            const barLeft = Math.max(0, offset);
            const barWidth = Math.max(1, 1);

            return (
              <div key={task.id} className="flex border-b border-border/50 hover:bg-muted/20 transition-colors">
                <div className="w-48 shrink-0 px-3 py-3 border-r border-border text-sm font-medium text-foreground truncate cursor-pointer" onClick={() => onTaskClick(task)}>
                  <p className={cn("truncate text-sm", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stsCfg.label}</p>
                </div>
                <div className="flex-1 relative" style={{ height: 56 }}>
                  {/* Grid lines */}
                  {days.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={i} style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }} className={cn("absolute top-0 bottom-0 border-r border-border/30", isWeekend && "bg-muted/20")} />
                    );
                  })}
                  {/* Today line */}
                  <div style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }} className="absolute top-0 bottom-0 w-px bg-purple-500/60 z-10" />
                  {/* Task bar (pin at due date) */}
                  {offset >= 0 && offset < TOTAL_DAYS && (
                    <div
                      style={{ left: offset * DAY_WIDTH + 4, top: 12 }}
                      className={cn(
                        "absolute flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer z-10 border shadow-sm max-w-[140px] truncate",
                        isOverdue ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600" : cn(priCfg.bg, priCfg.color, "border-border")
                      )}
                      onClick={() => onTaskClick(task)}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isOverdue ? "bg-red-500" : stsCfg.dot)} />
                      <span className="truncate">{task.title}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
