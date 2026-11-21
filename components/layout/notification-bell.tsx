"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBell } from "@fortawesome/free-regular-svg-icons";
import {
  faListCheck, faCodeMerge, faUserPlus, faAt, faCalendarDays, faTriangleExclamation, faFilePen, faCalendarCheck, faCircleCheck, faInbox, faCirclePause, faCirclePlay,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import type { Notification, NotificationType } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationPopup, isTaskMessage, playNotificationSound } from "./notification-popup";
import { browserAlertAllowed, loadNotificationPrefs } from "@/modules/notifications/preferences";
import { attachmentLabel, parseNotificationBody } from "@/modules/notifications/body";
import { faPaperclip } from "@fortawesome/free-solid-svg-icons";

const TYPE_CONFIG: Record<NotificationType, { icon: IconDefinition; color: string }> = {
  task_assigned:      { icon: faListCheck,     color: "text-purple-500" },
  task_due:           { icon: faTriangleExclamation, color: "text-red-500" },
  task_completed:     { icon: faCircleCheck,   color: "text-emerald-500" },
  deal_stage_changed: { icon: faCodeMerge,     color: "text-blue-500" },
  lead_assigned:      { icon: faUserPlus,      color: "text-emerald-500" },
  mention:            { icon: faAt,            color: "text-amber-500" },
  event_reminder:     { icon: faCalendarDays,  color: "text-indigo-500" },
  attendance_correction_request:  { icon: faFilePen,       color: "text-amber-500" },
  attendance_correction_decision: { icon: faCircleCheck,   color: "text-emerald-500" },
  attendance_monthly_processed:   { icon: faCalendarCheck, color: "text-blue-500" },
  leave_request:                  { icon: faCalendarDays,  color: "text-muted-foreground" },
  leave_decision:                 { icon: faCalendarCheck, color: "text-muted-foreground" },
  hr_request:                     { icon: faFilePen,       color: "text-muted-foreground" },
  report_resolved:                { icon: faCircleCheck,   color: "text-emerald-500" },
  task_on_hold:                   { icon: faCirclePause,   color: "text-amber-500" },
  task_resumed:                   { icon: faCirclePlay,    color: "text-emerald-500" },
  hold_digest:                    { icon: faCirclePause,   color: "text-amber-500" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Set after the hook below; lets the popup call the latest handlers.
  const actions = useRef<{ read: (id: string) => void; open: (n: Notification) => void }>({ read: () => {}, open: () => {} });

  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications((fresh) => {
    // A chat that is already open on screen needs no popup: just mark its messages read.
    const openChat = document.body.dataset.openTaskChat;
    const quiet = fresh.filter((n) => isTaskMessage(n) && n.entity_id === openChat);
    quiet.forEach((n) => actions.current.read(n.id));
    const loud = fresh.filter((n) => !quiet.includes(n));
    if (!loud.length) return;
    // Playing Draw and Guess with notifications turned off: no sound or popups (they still land in the bell).
    if (document.body.dataset.gameQuiet === "1") return;
    const prefs = loadNotificationPrefs();
    // Desktop alert from the browser when the app is not the window in front.
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && (document.hidden || !document.hasFocus())) {
      for (const n of loud.filter((x) => browserAlertAllowed(prefs, x)).slice(0, 3)) {
        const { text, attachments } = parseNotificationBody(n.body);
        const alert = new Notification(n.title, { body: text || (attachments ? attachmentLabel(attachments) : ""), tag: n.id });
        alert.onclick = () => { window.focus(); actions.current.open(n); alert.close(); };
      }
    }
    if (prefs.sound) playNotificationSound();
    if (!prefs.popups) return;
    for (const n of loud.slice(0, 3)) {
      toast.custom((id) => (
        <NotificationPopup n={n} toastId={id} onRead={() => actions.current.read(n.id)} onOpen={() => actions.current.open(n)} />
      ), { duration: isTaskMessage(n) ? 20000 : 8000, position: "top-right" });
    }
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function openNotification(n: Notification) {
    markRead(n.id);
    if (n.entity_type === "task_deleted") return; // the task no longer exists
    if (n.entity_type === "hold_list") { setOpen(false); router.push("/dashboard/actions/on-hold"); return; }
    if (n.entity_type?.startsWith("task") && n.entity_id) {
      setOpen(false);
      // A full navigation, so the Tasks app opens this task from the ?task= link.
      window.location.assign(`/dashboard/actions/tasks?task=${n.entity_id}`);
    } else if (n.type.startsWith("leave")) { setOpen(false); router.push("/dashboard/hrms/leaves"); }
  }

  actions.current = { read: markRead, open: openNotification };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <FontAwesomeIcon icon={faBell} className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[340px] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 ? (
              <button className="text-xs text-primary hover:underline" onClick={markAllRead}>Mark all read</button>
            ) : notifications.length > 0 && (
              // Only once everything is read: deletes this person's notifications for good.
              <button
                className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                onClick={async () => { const err = await clearAll(); if (err) toast.error(err); }}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <FontAwesomeIcon icon={faInbox} className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You are all caught up</p>
              </div>
            ) : (
              notifications.map((n) => <NotificationItem key={n.id} notification={n} onOpen={() => openNotification(n)} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onOpen }: { notification: Notification; onOpen: () => void }) {
  const cfg = TYPE_CONFIG[n.type] ?? { icon: faBell, color: "text-muted-foreground" };
  const { text, attachments } = parseNotificationBody(n.body);

  return (
    <button
      type="button"
      className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40", !n.read && "bg-primary/[0.04]")}
      onClick={onOpen}
    >
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", !n.read && "bg-primary/10")}>
        <FontAwesomeIcon icon={cfg.icon} className={cn("h-3.5 w-3.5", cfg.color)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block break-words text-xs font-medium text-foreground", !n.read && "font-semibold")}>{n.title}</span>
        {text && <span className="mt-0.5 block break-words text-[11px] leading-snug text-muted-foreground">{text}</span>}
        {attachments && (
          <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground">
            <FontAwesomeIcon icon={faPaperclip} className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="truncate">{attachmentLabel(attachments)}</span>
          </span>
        )}
        <span className="mt-1 block text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
      </span>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}
