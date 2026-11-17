"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBell, faComment, faCircleCheck, faMessage, faTrashCan } from "@fortawesome/free-regular-svg-icons";
import { faArrowRightArrowLeft, faListCheck, faAt, faTriangleExclamation, faVolumeHigh, faDesktop, faCheck } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_NOTIFICATION_PREFS, loadNotificationPrefs, saveNotificationPrefs, NOTIFICATION_PREFS_EVENT,
  type NotificationCategory, type NotificationPrefs,
} from "../preferences";
import { playNotificationSound } from "@/components/layout/notification-popup";
import { cn } from "@/lib/utils";

const ROWS: { key: NotificationCategory; label: string; desc: string; icon: IconDefinition }[] = [
  { key: "task_assigned", label: "Task assigned or reassigned", desc: "When someone assigns a task to you", icon: faListCheck },
  { key: "task_status", label: "Task updated", desc: "Status, dates, deadline or details change on your tasks", icon: faArrowRightArrowLeft },
  { key: "task_completed", label: "Task completed", desc: "When one of your tasks is marked as done", icon: faCircleCheck },
  { key: "task_deleted", label: "Task deleted", desc: "When one of your tasks is deleted", icon: faTrashCan },
  { key: "task_deadlines", label: "Task is overdue", desc: "Tasks that are overdue or due today or tomorrow", icon: faTriangleExclamation },
  { key: "task_messages", label: "New chat message", desc: "Messages in the chat of your tasks", icon: faComment },
  { key: "task_mentions", label: "Mentions", desc: "When someone @mentions you in a task chat", icon: faAt },
];

function Box({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("mx-auto flex h-5 w-5 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-foreground/50")}>
      {checked && <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />}
    </button>
  );
}

/** Notification preferences: what to be told about, and how. Saved on the account, applied straight away. */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    const read = () => setPrefs(loadNotificationPrefs());
    read();
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    window.addEventListener(NOTIFICATION_PREFS_EVENT, read);
    return () => window.removeEventListener(NOTIFICATION_PREFS_EVENT, read);
  }, []);

  const update = (next: NotificationPrefs) => { setPrefs(next); saveNotificationPrefs(next); };
  const off = !prefs.all;
  const browserReady = permission === "granted";

  async function enableBrowser() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") new Notification("Vivid View", { body: "Browser alerts are on. You will see task notifications here." });
    else if (result === "denied") toast.error("Browser alerts are blocked. Allow notifications for this site in your browser settings.");
  }

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FontAwesomeIcon icon={faBell} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">All notifications</h3>
          <p className="text-xs text-muted-foreground">{prefs.all ? "On. Choose below what you want to hear about." : "Off. Nothing will appear in the bell, pop up, alert or make a sound."}</p>
        </div>
        <Switch checked={prefs.all} onCheckedChange={(v) => update({ ...prefs, all: v })} aria-label="All notifications" />
      </section>

      <section className={cn("rounded-2xl border border-border bg-card p-5", off && "opacity-60")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-3 text-left text-sm font-semibold text-foreground">Task notifications</th>
                <th className="w-24 pb-3 text-center font-medium">In-app</th>
                <th className={cn("w-28 pb-3 text-center font-medium", !browserReady && "text-amber-600 dark:text-amber-400")} title={browserReady ? undefined : "Enable browser notifications below first"}>Browser alerts</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FontAwesomeIcon icon={r.icon} className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{r.label}</span>
                        <span className="block text-xs text-muted-foreground">{r.desc}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3"><Box checked={prefs[r.key]} disabled={off} label={`${r.label}: in-app`} onChange={(v) => update({ ...prefs, [r.key]: v })} /></td>
                  <td className="py-3"><Box checked={prefs[r.key] && prefs.browser[r.key]} disabled={off || !prefs[r.key] || !browserReady} label={`${r.label}: browser alert`}
                    onChange={(v) => update({ ...prefs, browser: { ...prefs.browser, [r.key]: v } })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">In-app covers the bell, the popup and the sound. Browser alerts appear on your desktop while Vivid View is open in another tab or minimised.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FontAwesomeIcon icon={faDesktop} className="h-3.5 w-3.5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Browser notifications</h3>
            <p className="text-xs text-muted-foreground">
              {permission === "unsupported" ? "This browser does not support desktop notifications."
                : permission === "granted" ? "Turned on for this browser."
                : permission === "denied" ? "Blocked in this browser. Allow notifications for this site in the browser's site settings, then reload."
                : "Turned off. Each browser you use has to be allowed once."}
            </p>
          </div>
          {permission === "default" && <Button type="button" size="sm" onClick={enableBrowser}>Enable notifications</Button>}
          {permission === "granted" && <Button type="button" variant="outline" size="sm" onClick={() => new Notification("Vivid View", { body: "This is how a browser alert looks." })}>Send a test</Button>}
        </div>
      </section>

      <section className={cn("rounded-2xl border border-border bg-card p-5", off && "opacity-60")}>
        <h3 className="text-sm font-semibold text-foreground">In-app style</h3>
        {[
          { key: "popups" as const, label: "Popups", desc: "Show a popup in the corner, with a quick reply for chat messages", icon: faMessage },
          { key: "sound" as const, label: "Sound", desc: "Play a short chime when a notification arrives", icon: faVolumeHigh },
        ].map((item) => (
          <div key={item.key} className="flex items-center gap-3 border-b border-border py-3 last:border-0 last:pb-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FontAwesomeIcon icon={item.icon} className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            {item.key === "sound" && <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={playNotificationSound}>Test</Button>}
            <Switch checked={prefs[item.key]} disabled={off} onCheckedChange={(v) => update({ ...prefs, [item.key]: v })} aria-label={item.label} />
          </div>
        ))}
      </section>
    </div>
  );
}
