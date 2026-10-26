"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Zap, GitMerge, UserPlus, AtSign, CalendarDays, AlertCircle, FileEdit, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import type { Notification, NotificationType } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  task_assigned:      { icon: CheckCheck,  color: "text-purple-500" },
  deal_stage_changed: { icon: GitMerge,    color: "text-blue-500" },
  lead_assigned:      { icon: UserPlus,    color: "text-emerald-500" },
  mention:            { icon: AtSign,      color: "text-amber-500" },
  event_reminder:     { icon: CalendarDays, color: "text-indigo-500" },
  task_due:           { icon: AlertCircle, color: "text-red-500" },
  attendance_correction_request:  { icon: FileEdit,     color: "text-amber-500" },
  attendance_correction_decision: { icon: CheckCheck,   color: "text-emerald-500" },
  attendance_monthly_processed:   { icon: CalendarCheck, color: "text-blue-500" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button className="text-xs text-purple-600 dark:text-purple-400 hover:underline" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Zap className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={() => markRead(n.id)} />
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-border bg-muted/30">
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onRead }: { notification: Notification; onRead: () => void }) {
  const cfg = TYPE_CONFIG[n.type] ?? { icon: Bell, color: "text-muted-foreground" };
  const Icon = cfg.icon;

  return (
    <div
      className={cn("flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors", !n.read && "bg-purple-50/50 dark:bg-purple-950/20")}
      onClick={onRead}
    >
      <div className={cn("w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5", !n.read && "bg-purple-100 dark:bg-purple-900/40")}>
        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium text-foreground", !n.read && "font-semibold")}>{n.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />}
    </div>
  );
}
