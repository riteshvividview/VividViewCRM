"use client";

import { useEffect, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { todayISO } from "../dates";

export const TASKS_CHANGED_EVENT = "tasks:changed";

interface Countable {
  status: string;
  planned_date: string | null;
  due_date: string | null;
  assignee_id?: string | null;
  assignees?: { id: string }[];
}

/**
 * Open tasks of this person that need attention today: scheduled for today (or an
 * earlier day and still open), or with a deadline today or already passed.
 */
export function countPending(tasks: Countable[], userId: string | null): number {
  if (!userId) return 0;
  const today = todayISO();
  return tasks.filter((t) => t.status !== "done"
    && (t.assignee_id === userId || !!t.assignees?.some((a) => a.id === userId))
    && ((t.planned_date && t.planned_date <= today) || (t.due_date && t.due_date <= today))).length;
}

/**
 * Number for the sidebar badge. Inside the Tasks app it comes from the task list
 * that is already loaded (no request of its own); elsewhere it asks the server once.
 */
export function usePendingTaskCount(): number {
  const userId = useShellProfile()?.user_id;
  const [count, setCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try { return Number(sessionStorage.getItem("vv-badge") ?? 0) || 0; } catch { return 0; }
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let heard = false;
    const save = (n: number) => {
      if (cancelled) return;
      setCount(n);
      try { sessionStorage.setItem("vv-badge", String(n)); } catch {}
    };
    const onChange = (e: Event) => {
      const n = (e as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof n === "number") { heard = true; save(n); }
    };
    window.addEventListener(TASKS_CHANGED_EVENT, onChange);

    // Outside the Tasks app nothing publishes the count: fetch it once.
    const t = setTimeout(async () => {
      if (heard) return;
      try {
        const res = await fetch(`/api/tasks?include_done=0&assignee_id=${userId}&limit=500`);
        const json = await res.json();
        if (res.ok && !heard) save(countPending(json.items ?? [], userId));
      } catch {}
    }, 1500);

    return () => { cancelled = true; clearTimeout(t); window.removeEventListener(TASKS_CHANGED_EVENT, onChange); };
  }, [userId]);

  return count;
}
