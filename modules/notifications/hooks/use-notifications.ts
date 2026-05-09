"use client";
import { useCallback, useEffect, useState } from "react";
import type { Notification } from "../types";

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "task_assigned", title: "Task assigned to you", body: 'Alex assigned "Send TechFlow proposal" to you.', read: false, entity_type: "task", entity_id: "t1", created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "n2", type: "deal_stage_changed", title: "Deal stage updated", body: "Enterprise License moved to Negotiations.", read: false, entity_type: "deal", entity_id: "d1", created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "n3", type: "mention", title: "You were mentioned", body: "Priya mentioned you in a comment on CloudBase deal.", read: false, entity_type: "deal", entity_id: "d5", created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "n4", type: "task_due", title: "Task due today", body: '"Send TechFlow proposal" is due today.', read: true, entity_type: "task", entity_id: "t1", created_at: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: "n5", type: "lead_assigned", title: "New lead assigned", body: "Aisha Patel from TechFlow has been assigned to you.", read: true, entity_type: "lead", entity_id: "l1", created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "n6", type: "event_reminder", title: "Meeting in 15 minutes", body: "CloudBase Demo starts at 2:00 PM.", read: true, entity_type: "event", entity_id: "e2", created_at: new Date(Date.now() - 30 * 60000).toISOString() },
];

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) {
        await new Promise((r) => setTimeout(r, 200));
        setNotifications(MOCK_NOTIFICATIONS);
        setLoading(false);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      setNotifications(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, markRead, markAllRead, unreadCount };
}
