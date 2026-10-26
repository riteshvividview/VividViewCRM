"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTasks, type AddTaskInput } from "../hooks/use-tasks";
import { TaskDetailPanel } from "../components/task-detail-panel";
import { QuickAddTask } from "../components/quick-add-task";
import type { Task, TaskMember, TaskTeam, TaskLabel, TaskProjectListItem } from "../types";

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  members: TaskMember[];
  teams: TaskTeam[];
  labels: TaskLabel[];
  projects: TaskProjectListItem[];
  currentUserId: string | null;
  addTask: (input: AddTaskInput) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addAssignees: (id: string, payload: { user_ids?: string[]; team_id?: string }) => Promise<Task>;
  openTask: (task: Task) => void;
  openQuickAdd: () => void;
  refreshProjects: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function useTasksContext(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext must be used within a TasksProvider");
  return ctx;
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const {
    tasks, loading, addTask, updateTask, deleteTask, currentUserId,
    addAssignees, removeAssignee, addLabel, removeLabel,
  } = useTasks();

  const [members, setMembers] = useState<TaskMember[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [projects, setProjects] = useState<TaskProjectListItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  async function refreshProjects() {
    try {
      const res = await fetch("/api/tasks/projects");
      const json = await res.json();
      if (res.ok) setProjects(json.projects ?? []);
    } catch {}
  }

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch("/api/tasks/members");
        const json = await res.json();
        if (res.ok) {
          setMembers(json.members ?? []);
          setTeams(json.teams ?? []);
        }
      } catch {}
    }
    async function fetchLabels() {
      try {
        const res = await fetch("/api/tasks/labels");
        const json = await res.json();
        if (res.ok) setLabels(json.labels ?? []);
      } catch {}
    }
    fetchMembers();
    fetchLabels();
    refreshProjects();
  }, []);

  // Global "T" hotkey for quick add, available across every Tasks-module page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); setQuickAddOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openTask(task: Task) {
    setSelectedTask(task);
    setPanelOpen(true);
  }

  function openQuickAdd() {
    setQuickAddOpen(true);
  }

  async function handleUpdate(id: string, updates: Partial<Task>) {
    await updateTask(id, updates);
    setSelectedTask((p) => (p?.id === id ? { ...p, ...updates } : p));
  }

  async function handleAddAssignees(id: string, payload: { user_ids?: string[]; team_id?: string }) {
    const task = await addAssignees(id, payload);
    setSelectedTask((p) => (p?.id === id ? task : p));
  }

  async function handleRemoveAssignee(id: string, userId: string) {
    const task = await removeAssignee(id, userId);
    setSelectedTask((p) => (p?.id === id ? task : p));
  }

  async function handleAddLabel(id: string, labelId: string) {
    const task = await addLabel(id, labelId);
    setSelectedTask((p) => (p?.id === id ? task : p));
  }

  async function handleRemoveLabel(id: string, labelId: string) {
    const task = await removeLabel(id, labelId);
    setSelectedTask((p) => (p?.id === id ? task : p));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setSelectedTask((p) => (p?.id === id ? null : p));
    setPanelOpen((open) => (selectedTask?.id === id ? false : open));
  }

  async function handleAdd(input: AddTaskInput) {
    await addTask(input);
  }

  return (
    <TasksContext.Provider
      value={{
        tasks, loading, members, teams, labels, projects, currentUserId,
        addTask, updateTask, deleteTask, addAssignees, openTask, openQuickAdd, refreshProjects,
      }}
    >
      {children}

      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        members={members}
        teams={teams}
        labels={labels}
        currentUserId={currentUserId}
        onAddAssignees={handleAddAssignees}
        onRemoveAssignee={handleRemoveAssignee}
        onAddLabel={handleAddLabel}
        onRemoveLabel={handleRemoveLabel}
      />

      <QuickAddTask
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={handleAdd}
        members={members}
        teams={teams}
      />
    </TasksContext.Provider>
  );
}
