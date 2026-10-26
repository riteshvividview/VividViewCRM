"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
  addTask: (input: AddTaskInput) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addAssignees: (id: string, payload: { user_ids?: string[]; team_id?: string }) => Promise<Task | null>;
  removeAssignee: (id: string, userId: string) => Promise<Task | null>;
  openTask: (task: Task) => void;
  /** Opens the quick-add dialog, optionally pre-filled (e.g. planned date / project). */
  openQuickAdd: (defaults?: Partial<AddTaskInput>) => void;
  refreshProjects: () => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function useTasksContext(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksContext must be used within a TasksProvider");
  return ctx;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function TasksProvider({ children }: { children: ReactNode }) {
  const {
    tasks, loading, fetchTasks, addTask, updateTask, deleteTask, currentUserId,
    addAssignees, removeAssignee, addLabel, removeLabel,
  } = useTasks();

  const [members, setMembers] = useState<TaskMember[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [projects, setProjects] = useState<TaskProjectListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDefaults, setQuickAddDefaults] = useState<Partial<AddTaskInput>>({});

  // The panel always shows the live copy of the selected task from the list.
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/projects");
      const json = await res.json();
      if (res.ok) setProjects(json.projects ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/tasks/members").then((r) => r.json()).then((json) => {
      setMembers(json.members ?? []);
      setTeams(json.teams ?? []);
    }).catch(() => {});
    fetch("/api/tasks/labels").then((r) => r.json()).then((json) => setLabels(json.labels ?? [])).catch(() => {});
    refreshProjects();
  }, [refreshProjects]);

  // Global "T" hotkey for quick add, available across every Tasks-module page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); setQuickAddDefaults({}); setQuickAddOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value: TasksContextValue = {
    tasks, loading, members, teams, labels, projects, currentUserId, refreshProjects,
    refreshTasks: fetchTasks,
    addTask: async (input) => {
      try { return await addTask(input); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    updateTask: async (id, updates) => {
      try { await updateTask(id, updates); } catch (e) { toast.error(errMsg(e)); }
    },
    deleteTask: async (id) => {
      await deleteTask(id);
      if (selectedId === id) { setPanelOpen(false); setSelectedId(null); }
    },
    addAssignees: async (id, payload) => {
      try { return await addAssignees(id, payload); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    removeAssignee: async (id, userId) => {
      try { return await removeAssignee(id, userId); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    openTask: (task) => { setSelectedId(task.id); setPanelOpen(true); },
    openQuickAdd: (defaults) => { setQuickAddDefaults(defaults ?? {}); setQuickAddOpen(true); },
  };

  return (
    <TasksContext.Provider value={value}>
      {children}

      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen && !!selectedTask}
        onClose={() => setPanelOpen(false)}
        onUpdate={value.updateTask}
        onDelete={value.deleteTask}
        members={members}
        teams={teams}
        labels={labels}
        projects={projects}
        currentUserId={currentUserId}
        onAddAssignees={(id, p) => { value.addAssignees(id, p); }}
        onRemoveAssignee={(id, u) => { value.removeAssignee(id, u); }}
        onAddLabel={(id, l) => { addLabel(id, l).catch((e) => toast.error(errMsg(e))); }}
        onRemoveLabel={(id, l) => { removeLabel(id, l).catch((e) => toast.error(errMsg(e))); }}
      />

      <QuickAddTask
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={async (input) => { await value.addTask({ ...quickAddDefaults, ...input }); }}
        members={members}
        teams={teams}
        projects={projects}
        defaults={quickAddDefaults}
      />
    </TasksContext.Provider>
  );
}
