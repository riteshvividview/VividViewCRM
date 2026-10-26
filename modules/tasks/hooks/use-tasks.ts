"use client";

import { useCallback, useEffect, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import type { Task } from "../types";

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
  team_id?: string;
  label_ids?: string[];
}

const EMPTY_TASK: Omit<Task, "id" | "created_at" | "updated_at"> = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
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

export function useTasks() {
  const profile = useShellProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = profile?.user_id ?? null;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ items: Task[] }>("/api/tasks?limit=200");
      setTasks(result.items ?? []);
    } catch (e) {
      console.error("[useTasks] fetchTasks failed:", e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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
          board_id: optimistic.board_id,
          estimated_hours: optimistic.estimated_hours,
          assignee_ids: t.assignee_ids,
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
      return prev.map((t) => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t);
    });
    try {
      const { task } = await apiFetch<{ task: Task }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setTasks((prev) => prev.map((t) => t.id === id ? task : t));
    } catch (e) {
      console.error("[useTasks] updateTask failed, reverting:", e);
      setTasks(snapshot);
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
    tasks, loading, fetchTasks, addTask, updateTask, deleteTask, refreshTask,
    addAssignees, removeAssignee, addLabel, removeLabel, setTasks, currentUserId,
  };
}
