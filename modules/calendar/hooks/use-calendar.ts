"use client";
import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, EventType } from "../types";

function dt(daysOffset: number, hours: number, mins = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, mins, 0, 0);
  return d.toISOString();
}

export const MOCK_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "TechFlow Discovery Call", type: "call", start_time: dt(0, 10), end_time: dt(0, 11), attendees: ["Alex Kumar", "Sarah Chen"], linked_entity_type: "contact", linked_entity_id: "c1", linked_entity_name: "Sarah Chen", notes: "Discuss Q2 requirements and budget", video_call_link: "https://meet.google.com/abc-defg-hij", created_by: "u1", color_override: null },
  { id: "e2", title: "CloudBase Demo", type: "demo", start_time: dt(0, 14), end_time: dt(0, 15, 30), attendees: ["Alex Kumar", "Elena Vasquez"], linked_entity_type: "company", linked_entity_id: "co3", linked_entity_name: "CloudBase Labs", notes: "Enterprise features walkthrough", video_call_link: "https://zoom.us/j/123456", created_by: "u1", color_override: null },
  { id: "e3", title: "Nexus Partnership Meeting", type: "meeting", start_time: dt(1, 11), end_time: dt(1, 12), attendees: ["Priya Singh", "Marcus Webb"], linked_entity_type: "deal", linked_entity_id: "d2", linked_entity_name: "Partnership – Nexus Digital", notes: "", video_call_link: null, created_by: "u2", color_override: null },
  { id: "e4", title: "Q2 Proposal Deadline", type: "deadline", start_time: dt(2, 9), end_time: dt(2, 9, 30), all_day: true, attendees: ["Alex Kumar"], linked_entity_type: "deal", linked_entity_id: "d1", linked_entity_name: "Enterprise License – TechFlow", notes: "Submit final proposal by 9 AM", video_call_link: null, created_by: "u1", color_override: null },
  { id: "e5", title: "Meridian Follow-up Call", type: "follow_up", start_time: dt(3, 15), end_time: dt(3, 16), attendees: ["Sam Tiwari", "James Okafor"], linked_entity_type: "contact", linked_entity_id: "c4", linked_entity_name: "James Okafor", notes: "Follow up on procurement decision", video_call_link: "https://meet.google.com/xyz-uvwx", created_by: "u3", color_override: null },
  { id: "e6", title: "David Kim Onboarding", type: "meeting", start_time: dt(5, 10), end_time: dt(5, 11, 30), attendees: ["Priya Singh", "David Kim"], linked_entity_type: "contact", linked_entity_id: "c6", linked_entity_name: "David Kim", notes: "Week 1 onboarding session", video_call_link: "https://zoom.us/j/789012", created_by: "u2", color_override: null },
  { id: "e7", title: "Weekly Team Sync", type: "meeting", start_time: dt(7, 9), end_time: dt(7, 10), attendees: ["Alex Kumar", "Priya Singh", "Sam Tiwari"], linked_entity_type: null, linked_entity_id: null, linked_entity_name: null, notes: "Weekly pipeline and OKR review", video_call_link: "https://meet.google.com/team-sync", created_by: "u1", color_override: null },
  { id: "e8", title: "Spark Analytics Check-in", type: "call", start_time: dt(-1, 14), end_time: dt(-1, 14, 30), attendees: ["Sam Tiwari", "Lily Nguyen"], linked_entity_type: "contact", linked_entity_id: "c5", linked_entity_name: "Lily Nguyen", notes: "", video_call_link: null, created_by: "u3", color_override: null },
];

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 300)); setEvents(MOCK_EVENTS); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("calendar_events").select("*").order("start_time");
      setEvents(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const addEvent = useCallback(async (e: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const n: CalendarEvent = {
      id: crypto.randomUUID(),
      title: e.title ?? "New Event",
      type: e.type ?? "meeting",
      start_time: e.start_time ?? new Date().toISOString(),
      end_time: e.end_time ?? new Date(Date.now() + 3600000).toISOString(),
      attendees: e.attendees ?? [],
      linked_entity_type: e.linked_entity_type ?? null,
      linked_entity_id: e.linked_entity_id ?? null,
      linked_entity_name: e.linked_entity_name ?? null,
      notes: e.notes ?? "",
      video_call_link: e.video_call_link ?? null,
      created_by: "u1",
      color_override: null,
    };
    setEvents((p) => [...p, n]);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().from("calendar_events").insert([n]);
    }
    return n;
  }, []);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    setEvents((p) => p.map((e) => e.id === id ? { ...e, ...updates } : e));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("calendar_events").update(updates).eq("id", id);
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((p) => p.filter((e) => e.id !== id));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("calendar_events").delete().eq("id", id);
  }, []);

  return { events, loading, fetchEvents, addEvent, updateEvent, deleteEvent, setEvents };
}
