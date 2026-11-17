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
    const channel = supabase.channel(`user-notify:${userId}`).on("broadcast", { event: "new" }, () => { load(); }).subscribe();
    // Safety net if the socket drops.
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [userId, load]);

  const markRead = useCallback((id: string) => {
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
    createClient().from("notifications").update({ read: true }).eq("id", id).then(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.read && notificationAllowed(prefs, n)).map((n) => n.id);
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    if (unreadIds.length) createClient().from("notifications").update({ read: true }).in("id", unreadIds).then(() => {});
  }, [notifications, prefs]);

  const visible = notifications.filter((n) => notificationAllowed(prefs, n));
  const unreadCount = visible.filter((n) => !n.read).length;

  return { notifications: visible, loading, markRead, markAllRead, unreadCount };
}
