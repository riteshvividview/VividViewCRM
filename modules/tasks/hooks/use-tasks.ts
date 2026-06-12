"use client";

import { useCallback, useEffect, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import type { Task, TaskStatus } from "../types";
import { tasksApi } from "@/lib/api-client";

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

// ── Mock data ─────────────────────────────────────────────────────────────────
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

// ── Type normalizer ───────────────────────────────────────────────────────────
// NestJS task response includes extra board/sprint fields and relation counts.
// We extract only the fields the CRM task views use.

type ApiTask = Task & {
  project_id?: string | null;
  board_id?: string | null;
  sprint_id?: string | null;
  task_assignees?: unknown[];
  task_label_assignments?: unknown[];
  _count?: Record<string, number>;
};

function normalizeTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: (t.status as TaskStatus) ?? "todo",
    priority: t.priority ?? "medium",
    due_date: t.due_date ?? null,
    assignee_id: t.assignee_id ?? null,
    assignee_name: t.assignee_name ?? null,
    linked_entity_type: t.linked_entity_type ?? null,
    linked_entity_id: t.linked_entity_id ?? null,
    linked_entity_name: t.linked_entity_name ?? null,
    parent_task_id: t.parent_task_id ?? null,
    sub_tasks: Array.isArray(t.sub_tasks) ? (t.sub_tasks as Task["sub_tasks"]) : [],
    recurring_pattern: t.recurring_pattern ?? null,
    tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
    created_by: t.created_by ?? null,
    workspace_id: t.workspace_id ?? null,
    created_at: t.created_at ?? new Date().toISOString(),
    updated_at: t.updated_at ?? new Date().toISOString(),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTasks() {
  const profile = useShellProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = profile?.user_id ?? null;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tasksApi.list({ limit: "200" }) as { items: ApiTask[] };
      setTasks((result.items ?? []).map(normalizeTask));
    } catch (e) {
      console.warn("[useTasks] NestJS API unavailable, falling back to mock data:", e);
      setTasks(MOCK_TASKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (t: Partial<Task>): Promise<Task> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Task = {
      id: tempId,
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
      created_by: currentUserId,
      workspace_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [optimistic, ...prev]);
    try {
      const created = await tasksApi.create({
        title: optimistic.title,
        description: optimistic.description,
        status: optimistic.status,
        priority: optimistic.priority,
        due_date: optimistic.due_date,
        assignee_id: optimistic.assignee_id,
        linked_entity_type: optimistic.linked_entity_type,
        linked_entity_id: optimistic.linked_entity_id,
        linked_entity_name: optimistic.linked_entity_name,
        tags: optimistic.tags,
        sub_tasks: optimistic.sub_tasks,
        recurring_pattern: optimistic.recurring_pattern,
      }) as ApiTask;
      const normalized = normalizeTask(created);
      setTasks((prev) => prev.map((task) => task.id === tempId ? normalized : task));
      return normalized;
    } catch (e) {
      console.error("[useTasks] addTask failed, removing optimistic row:", e);
      setTasks((prev) => prev.filter((task) => task.id !== tempId));
      return optimistic;
    }
  }, [currentUserId]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
    try {
      await tasksApi.update(id, updates);
    } catch (e) {
      console.error("[useTasks] updateTask failed, reverting:", e);
      setTasks(snapshot);
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const snapshot = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await tasksApi.delete(id);
    } catch (e) {
      console.error("[useTasks] deleteTask failed, reverting:", e);
      setTasks(snapshot);
    }
  }, [tasks]);

  return { tasks, loading, fetchTasks, addTask, updateTask, deleteTask, setTasks, currentUserId };
}
