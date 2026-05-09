"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Video, ArrowRight, Clock } from "lucide-react";
import { useCalendar } from "@/modules/calendar/hooks/use-calendar";
import { EVENT_CONFIG } from "@/modules/calendar/types";
import { cn } from "@/lib/utils";

export function TodaysSchedule() {
  const { events, loading } = useCalendar();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const todayEvents = events
    .filter((e) => {
      const d = new Date(e.start_time);
      return d.toDateString() === now.toDateString();
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const next = todayEvents.find((e) => new Date(e.end_time) > now);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Today&apos;s Schedule</h3>
        <Link href="/dashboard/sales-calendar" className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : todayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <p className="text-sm text-muted-foreground">No events today</p>
          <Link href="/dashboard/sales-calendar" className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-1">Add an event</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {todayEvents.map((ev) => {
            const cfg = EVENT_CONFIG[ev.type];
            const start = new Date(ev.start_time);
            const isPast = new Date(ev.end_time) < now;
            const isCurrent = start <= now && new Date(ev.end_time) > now;
            const isNext = ev === next;
            return (
              <div key={ev.id} className={cn("flex items-start gap-2.5 p-2.5 rounded-xl transition-colors", isCurrent ? cn(cfg.bg, "border", cfg.border) : "hover:bg-muted/30", isPast && "opacity-50")}>
                <div className="text-center shrink-0 w-12">
                  <p className={cn("text-xs font-semibold", isCurrent ? cfg.color : "text-foreground")}>
                    {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  {isCurrent && <p className="text-[9px] text-emerald-500 font-medium">NOW</p>}
                </div>
                <div className={cn("w-0.5 self-stretch rounded-full shrink-0", isCurrent ? cfg.dot : "bg-border")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", isPast ? "text-muted-foreground" : "text-foreground")}>{ev.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[10px] font-medium", cfg.color)}>{cfg.label}</span>
                    {ev.video_call_link && (
                      <a href={ev.video_call_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>
                        <Video className="h-2.5 w-2.5" />Join
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Current time */}
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} local time
      </div>
    </div>
  );
}
