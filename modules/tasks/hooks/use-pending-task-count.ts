"use client";
import { useEffect, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { todayISO } from "../dates";

/** Fired after any task change so the sidebar badge stays in step with the planner. */
export const TASKS_CHANGED_EVENT = "tasks:changed";

/**
 * Number of the current user's open tasks that need attention today:
 * scheduled for today (or an earlier day and still open), or with a deadline today or already passed.
 */
export function usePendingTaskCount(): number {
  const userId = useShellProfile()?.user_id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/tasks?include_done=0&assignee_id=${userId}&limit=500`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        const today = todayISO();
        const due = (json.items ?? []).filter((t: { planned_date: string | null; due_date: string | null }) =>
          (t.planned_date && t.planned_date <= today) || (t.due_date && t.due_date <= today));
        if (!cancelled) setCount(due.length);
      } catch {
        if (!cancelled) setCount(0);
      }
    }
    load();
    window.addEventListener(TASKS_CHANGED_EVENT, load);
    return () => { cancelled = true; window.removeEventListener(TASKS_CHANGED_EVENT, load); };
  }, [userId]);

  return count;
}
