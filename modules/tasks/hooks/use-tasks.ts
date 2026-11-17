"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import type { Task } from "../types";
import { TASKS_CHANGED_EVENT, countPending } from "./use-pending-task-count";
import { readCache, writeCache } from "../lib/cache";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export interface AddTaskInput extends Partial<Task> {
  assignee_ids?: string[];
  /** false = keep the task unassigned when no assignee_ids are given (default: assign the creator). */
  assign_to_me?: boolean;
  label_ids?: string[];
}

const EMPTY_TASK: Omit<Task, "id" | "created_at" | "updated_at"> = {
  title: "",
  description: "",
  status: "todo",
  priority: "none",
  due_date: null,
  assignee_id: null,
  assignee_name: null,
  assignees: [],
  reporter: null,
  labels: [],
  linked_entity_type: null,
  linked_entity_id: null,
  linked_entity_name: null,
  parent_task_id: null,
  sub_tasks: [],
  recurring_pattern: null,
  tags: [],
  project_id: null,
  board_id: null,
  board_column_id: null,
  planned_date: null,
  color: null,
  recurrence_parent_id: null,
  type_id: null,
  type: null,
  number: null,
  comment_count: 0,
  attachment_count: 0,
  has_main_file: false,
  team_id: null,
  team: null,
  brief_note: null,
  reference_note: null,
  main_note: null,
  project: null,
  board: null,
  position: 0,
  story_points: null,
  start_date: null,
  estimated_hours: null,
  actual_hours: null,
  started_at: null,
  completed_at: null,
  created_by: null,
  workspace_id: null,
};

/** Completed tasks older than this are loaded only when someone asks for them. */
const CLOSED_WINDOW_DAYS = 60;
const windowStart = () => new Date(Date.now() - CLOSED_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);

export function useTasks() {
  const profile = useShellProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = profile?.user_id ?? null;

  // Completed tasks are loaded from this date on; earlier ones on request.
  const [closedFrom, setClosedFrom] = useState(windowStart);
  const [hasOlderClosed, setHasOlderClosed] = useState(false);
  const closedFromRef = useRef(closedFrom);
  closedFromRef.current = closedFrom;

  /** `silent` re-reads without the loading state (used for live updates). */
  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Open tasks plus everything completed in the window (kept wider if the person paged back).
      const result = await apiFetch<{ items: Task[]; older_closed?: boolean }>(`/api/tasks?limit=1000&done_since=${closedFromRef.current}`);
      setTasks(result.items ?? []);
      setHasOlderClosed(!!result.older_closed);
    } catch (e) {
      console.error("[useTasks] fetchTasks failed:", e);
      if (!silent) setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Adds tasks to the list, replacing copies already there. */
  const mergeIn = useCallback((items: Task[]) => {
    if (!items.length) return;
    const fresh = new Map(items.map((t) => [t.id, t]));
    setTasks((prev) => [...prev.map((t) => fresh.get(t.id) ?? t), ...items.filter((t) => !prev.some((p) => p.id === t.id))]);
  }, []);

  /** "Show older completed tasks": the next 50 before the oldest one shown. */
  const loadOlderClosed = useCallback(async () => {
    const shown = tasks.filter((t) => t.status === "done" && t.completed_at).map((t) => t.completed_at as string).sort();
    const before = shown[0] ?? new Date(`${closedFromRef.current}T00:00:00Z`).toISOString();
    const { items } = await apiFetch<{ items: Task[] }>(`/api/tasks?status=done&done_before=${encodeURIComponent(before)}&limit=50`);
    mergeIn(items ?? []);
    setHasOlderClosed((items ?? []).length === 50);
    const oldest = (items ?? []).map((t) => t.completed_at as string).filter(Boolean).sort()[0];
    if (oldest && oldest.slice(0, 10) < closedFromRef.current) setClosedFrom(oldest.slice(0, 10));
  }, [tasks, mergeIn]);

  /** Makes sure completed tasks from this date on are loaded (planners going back in time). */
  const ensureClosedFrom = useCallback(async (date: string) => {
    if (date >= closedFromRef.current) return;
    const until = closedFromRef.current;
    setClosedFrom(date);
    try {
      const { items } = await apiFetch<{ items: Task[] }>(`/api/tasks?status=done&done_since=${date}&done_before=${until}&limit=1000`);
      mergeIn(items ?? []);
    } catch {}
  }, [mergeIn]);

  /**
   * Re-reads only these tasks (after someone changed them) and merges them in.
   * Tasks that no longer come back were deleted or are now hidden from this person.
   */
  const refreshTaskIds = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const { items } = await apiFetch<{ items: Task[] }>(`/api/tasks?ids=${ids.join(",")}&limit=50`);
      const fresh = new Map((items ?? []).map((t) => [t.id, t]));
      setTasks((prev) => {
        const kept = prev.filter((t) => !ids.includes(t.id) || fresh.has(t.id)).map((t) => fresh.get(t.id) ?? t);
        const added = (items ?? []).filter((t) => !prev.some((p) => p.id === t.id));
        return [...added, ...kept];
      });
    } catch {
      fetchTasks(true);
    }
  }, [fetchTasks]);

  // Show the cached list at once, then refresh it quietly from the server.
  useEffect(() => {
    const cached = readCache<Task[]>(currentUserId, "tasks");
    if (cached?.length) { setTasks(cached); setLoading(false); fetchTasks(true); }
    else fetchTasks();
  }, [fetchTasks, currentUserId]);

  // Keep the cache in step, and give the sidebar badge its count (no request of its own).
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      writeCache(currentUserId, "tasks", tasks.filter((x) => !x.id.startsWith("temp-")));
      window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT, { detail: { count: countPending(tasks, currentUserId) } }));
    }, 500);
    return () => clearTimeout(t);
  }, [tasks, loading, currentUserId]);

  const addTask = useCallback(async (t: AddTaskInput): Promise<Task> => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: Task = {
      ...EMPTY_TASK,
      ...t,
      id: tempId,
      title: t.title ?? "Untitled task",
      created_by: currentUserId,
      created_at: now,
      updated_at: now,
      assignees: t.assignees ?? [],
      labels: t.labels ?? [],
    };
    setTasks((prev) => [optimistic, ...prev]);
    try {
      const { task } = await apiFetch<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: optimistic.title,
          description: optimistic.description,
          status: optimistic.status,
          priority: optimistic.priority,
          due_date: optimistic.due_date,
          linked_entity_type: optimistic.linked_entity_type,
          linked_entity_id: optimistic.linked_entity_id,
          linked_entity_name: optimistic.linked_entity_name,
          parent_task_id: optimistic.parent_task_id,
          sub_tasks: optimistic.sub_tasks,
          recurring_pattern: optimistic.recurring_pattern,
          tags: optimistic.tags,
          project_id: optimistic.project_id,
          board_column_id: optimistic.board_column_id,
          planned_date: optimistic.planned_date,
          color: optimistic.color,
          type_id: optimistic.type_id,
          start_date: optimistic.start_date,
          estimated_hours: optimistic.estimated_hours,
          brief_note: optimistic.brief_note,
          reference_note: optimistic.reference_note,
          main_note: optimistic.main_note,
          assignee_ids: t.assignee_ids,
          assign_to_me: t.assign_to_me,
          team_id: t.team_id,
          label_ids: t.label_ids,
        }),
      });
      setTasks((prev) => prev.map((existing) => existing.id === tempId ? task : existing));
      return task;
    } catch (e) {
      console.error("[useTasks] addTask failed, removing optimistic row:", e);
      setTasks((prev) => prev.filter((existing) => existing.id !== tempId));
      throw e;
    }
  }, [currentUserId]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...updates, updated_at: new Date().toISOString() };
        // The deadline never falls before the scheduled day: moving the task later moves the deadline too.
        if (updates.planned_date && next.due_date && next.due_date < updates.planned_date) next.due_date = updates.planned_date;
        return next;
      });
    });
    try {
      const { task, next_task } = await apiFetch<{ task: Task; next_task: Task | null }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      // Completing a recurring task returns its next occurrence.
      setTasks((prev) => {
        const updated = prev.map((t) => t.id === id ? task : t);
        return next_task && !updated.some((t) => t.id === next_task.id) ? [next_task, ...updated] : updated;
      });
      return task;
    } catch (e) {
      console.error("[useTasks] updateTask failed, reverting:", e);
      setTasks(snapshot);
      throw e;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    let snapshot: Task[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.filter((t) => t.id !== id);
    });
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("[useTasks] deleteTask failed, reverting:", e);
      setTasks(snapshot);
    }
  }, []);

  const refreshTask = useCallback(async (id: string) => {
    try {
      const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}`);
      setTasks((prev) => prev.map((t) => t.id === id ? task : t));
      return task;
    } catch (e) {
      console.error("[useTasks] refreshTask failed:", e);
      return null;
    }
  }, []);

  const addAssignees = useCallback(async (id: string, payload: { user_ids?: string[]; team_id?: string }) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}/assignees`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? task : t));
    return task;
  }, []);

  const removeAssignee = useCallback(async (id: string, userId: string) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}/assignees`, {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId }),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? task : t));
    return task;
  }, []);

  const addLabel = useCallback(async (id: string, labelId: string) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}/labels`, {
      method: "POST",
      body: JSON.stringify({ label_id: labelId }),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? task : t));
    return task;
  }, []);

  const removeLabel = useCallback(async (id: string, labelId: string) => {
    const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}/labels`, {
      method: "DELETE",
      body: JSON.stringify({ label_id: labelId }),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? task : t));
    return task;
  }, []);

  return {
    tasks, refreshTaskIds, hasOlderClosed, loadOlderClosed, ensureClosedFrom, loading, fetchTasks, addTask, updateTask, deleteTask, refreshTask,
    addAssignees, removeAssignee, addLabel, removeLabel, setTasks, currentUserId,
  };
}
