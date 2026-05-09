"use client";
import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus } from "../types";

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

export const MOCK_TASKS: Task[] = [
  { id: "t1", title: "Send TechFlow proposal", description: "Prepare and send the enterprise license proposal to Sarah Chen.", status: "in_progress", priority: "urgent", due_date: today, assignee_id: "u1", assignee_name: "Alex Kumar", linked_entity_type: "deal", linked_entity_id: "d1", linked_entity_name: "Enterprise License – TechFlow", parent_task_id: null, sub_tasks: [{ id: "st1", title: "Draft pricing table", checked: true }, { id: "st2", title: "Legal review", checked: false }], recurring_pattern: null, tags: ["proposal"], created_by: "u1", workspace_id: null, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-07T14:00:00Z" },
  { id: "t2", title: "Follow up with Marcus Webb", description: "Call Marcus regarding the Nexus Digital partnership terms.", status: "todo", priority: "high", due_date: tomorrow, assignee_id: "u2", assignee_name: "Priya Singh", linked_entity_type: "contact", linked_entity_id: "c2", linked_entity_name: "Marcus Webb", parent_task_id: null, sub_tasks: [], recurring_pattern: null, tags: ["follow-up"], created_by: "u1", workspace_id: null, created_at: "2026-05-05T10:00:00Z", updated_at: "2026-05-07T09:00:00Z" },
  { id: "t3", title: "Update Meridian Corp deal stage", description: "", status: "todo", priority: "medium", due_date: next7, assignee_id: "u3", assignee_name: "Sam Tiwari", linked_entity_type: "deal", linked_entity_id: "d3", linked_entity_name: "Industrial Suite – Meridian", parent_task_id: null, sub_tasks: [], recurring_pattern: null, tags: [], created_by: "u3", workspace_id: null, created_at: "2026-05-06T10:00:00Z", updated_at: "2026-05-06T10:00:00Z" },
  { id: "t4", title: "Prepare demo for CloudBase Labs", description: "Set up demo environment with custom branding for Elena Vasquez.", status: "in_progress", priority: "high", due_date: next7, assignee_id: "u1", assignee_name: "Alex Kumar", linked_entity_type: "company", linked_entity_id: "co3", linked_entity_name: "CloudBase Labs", parent_task_id: null, sub_tasks: [{ id: "st3", title: "Set up sandbox account", checked: true }, { id: "st4", title: "Load sample data", checked: false }, { id: "st5", title: "Rehearse demo script", checked: false }], recurring_pattern: null, tags: ["demo"], created_by: "u2", workspace_id: null, created_at: "2026-05-04T10:00:00Z", updated_at: "2026-05-07T08:00:00Z" },
  { id: "t5", title: "Weekly pipeline review", description: "Review all open deals and update stages.", status: "todo", priority: "medium", due_date: next7, assignee_id: "u1", assignee_name: "Alex Kumar", linked_entity_type: null, linked_entity_id: null, linked_entity_name: null, parent_task_id: null, sub_tasks: [], recurring_pattern: "weekly", tags: ["recurring"], created_by: "u1", workspace_id: null, created_at: "2026-04-28T10:00:00Z", updated_at: "2026-05-06T10:00:00Z" },
  { id: "t6", title: "Onboarding call with David Kim", description: "Initial onboarding session — walk through the platform.", status: "waiting", priority: "medium", due_date: next14, assignee_id: "u2", assignee_name: "Priya Singh", linked_entity_type: "contact", linked_entity_id: "c6", linked_entity_name: "David Kim", parent_task_id: null, sub_tasks: [], recurring_pattern: null, tags: ["onboarding"], created_by: "u2", workspace_id: null, created_at: "2026-05-05T10:00:00Z", updated_at: "2026-05-05T10:00:00Z" },
  { id: "t7", title: "Send Spark Analytics quote", description: "Finalize pricing and send to Lily Nguyen for approval.", status: "done", priority: "high", due_date: yesterday, assignee_id: "u3", assignee_name: "Sam Tiwari", linked_entity_type: "contact", linked_entity_id: "c5", linked_entity_name: "Lily Nguyen", parent_task_id: null, sub_tasks: [], recurring_pattern: null, tags: ["quote"], created_by: "u3", workspace_id: null, created_at: "2026-05-03T10:00:00Z", updated_at: "2026-05-06T16:00:00Z" },
  { id: "t8", title: "Update CRM contacts data", description: "Import new contacts from the trade show CSV.", status: "todo", priority: "low", due_date: next14, assignee_id: "u3", assignee_name: "Sam Tiwari", linked_entity_type: null, linked_entity_id: null, linked_entity_name: null, parent_task_id: null, sub_tasks: [], recurring_pattern: null, tags: ["data"], created_by: "u3", workspace_id: null, created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T10:00:00Z" },
];

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 350)); setTasks(MOCK_TASKS); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("tasks").select("*").order("created_at", { ascending: false });
      setTasks(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (t: Partial<Task>): Promise<Task> => {
    const n: Task = {
      id: crypto.randomUUID(),
      title: t.title ?? "Untitled task",
      description: t.description ?? "",
      status: t.status ?? "todo",
      priority: t.priority ?? "medium",
      due_date: t.due_date ?? null,
      assignee_id: t.assignee_id ?? null,
      assignee_name: t.assignee_name ?? null,
      linked_entity_type: t.linked_entity_type ?? null,
      linked_entity_id: t.linked_entity_id ?? null,
      linked_entity_name: t.linked_entity_name ?? null,
      parent_task_id: null,
      sub_tasks: t.sub_tasks ?? [],
      recurring_pattern: t.recurring_pattern ?? null,
      tags: t.tags ?? [],
      created_by: "u1",
      workspace_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((p) => [n, ...p]);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().from("tasks").insert([n]);
    }
    return n;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("tasks").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("tasks").delete().eq("id", id);
  }, []);

  return { tasks, loading, fetchTasks, addTask, updateTask, deleteTask, setTasks };
}
