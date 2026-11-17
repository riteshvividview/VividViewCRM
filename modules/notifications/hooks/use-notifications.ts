"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useShellProfile } from "@/lib/supabase/profile-context";
import type { Notification } from "../types";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_PREFS_EVENT, loadNotificationPrefs, notificationAllowed } from "../preferences";

/**
 * The signed-in user's notifications, kept live: the server pings the user's
 * Realtime channel whenever it saves one, and the list is re-read.
 * `onNew` is called with notifications that arrived after the page loaded.
 */
export function useNotifications(onNew?: (fresh: Notification[]) => void) {
  const userId = useShellProfile()?.user_id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // What this device wants to be told about (Settings → Notifications).
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  useEffect(() => {
    const read = () => setPrefs(loadNotificationPrefs());
    read();
    window.addEventListener(NOTIFICATION_PREFS_EVENT, read);
    return () => window.removeEventListener(NOTIFICATION_PREFS_EVENT, read);
  }, []);
  const known = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const load = useCallback(async () => {
    const { data } = await createClient().from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    const list = (data ?? []) as Notification[];
    setNotifications(list);
    setLoading(false);
    if (known.current) {
      const now = loadNotificationPrefs();
      const fresh = list.filter((n) => !n.read && !known.current!.has(n.id) && notificationAllowed(now, n));
      if (fresh.length) onNewRef.current?.(fresh);
    }
    known.current = new Set(list.map((n) => n.id));
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    const supabase = createClient();
    // Live: the server pings this channel. The slow check runs only while that connection is down.
    let live = false, connectedBefore = false;
    const channel = supabase.channel(`user-notify:${userId}`).on("broadcast", { event: "new" }, () => { load(); })
      .subscribe((status) => {
        const was = live;
        live = status === "SUBSCRIBED";
        // After a reconnection, catch up on anything missed while it was down.
        if (live && !was) { if (connectedBefore) load(); connectedBefore = true; }
      });
    const t = setInterval(() => { if (!live && document.visibilityState === "visible") load(); }, 60000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [userId, load]);

  const markRead = useCallback((id: string) => {
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
    createClient().from("notifications").update({ read: true }).eq("id", id).then(() => {});
  }, []);

  // Every unread notification of mine, including older ones not loaded here.
  const markAllRead = useCallback(() => {
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    fetch("/api/notifications", { method: "PATCH" }).then((r) => { if (!r.ok) load(); }).catch(() => load());
  }, [load]);

  /** Deletes all my notifications. The server refuses while any of them is unread. */
  const clearAll = useCallback(async (): Promise<string | null> => {
    const before = notifications;
    setNotifications([]);
    try {
      const r = await fetch("/api/notifications", { method: "DELETE" });
      if (r.ok) return null;
      const j = await r.json().catch(() => ({}));
      setNotifications(before);
      load();
      return j.error ?? "Could not clear notifications";
    } catch {
      setNotifications(before);
      return "Could not clear notifications";
    }
  }, [notifications, load]);

  const visible = notifications.filter((n) => notificationAllowed(prefs, n));
  const unreadCount = visible.filter((n) => !n.read).length;

  return { notifications: visible, loading, markRead, markAllRead, clearAll, unreadCount };
}
