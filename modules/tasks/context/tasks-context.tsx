"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useTasks, type AddTaskInput } from "../hooks/use-tasks";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { createClient } from "@/lib/supabase/client";
import { TaskDetailModal } from "../components/task-detail-modal";
import { QuickAddTask } from "../components/quick-add-task";
import type { Task, TaskMember, TaskTeam, TaskProjectListItem, TaskType } from "../types";
import { readCache, writeCache } from "../lib/cache";
import { publishLists } from "../lib/shared-lists";

/** Everything besides the tasks, loaded in one request (/api/tasks/bootstrap). */
interface Bootstrap {
  members: TaskMember[]; teams: TaskTeam[]; projects: TaskProjectListItem[]; types: TaskType[];
  settings: { read_only: boolean; delete_rule: "creator" | "leads" };
  can_manage_teams?: boolean;
}

/** An open task of the current user that is overdue or due today / tomorrow. */
export interface TaskReminder { id: string; title: string; due_date: string; priority: string; days: number }

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  members: TaskMember[];
  teams: TaskTeam[];
  /** Reload the team list (after creating or editing a team). */
  refreshTeams: () => Promise<void>;
  projects: TaskProjectListItem[];
  /** CEO and team leads: create and manage brands, delete any task. */
  isLead: boolean;
  reminders: TaskReminder[];
  /** HR with view-only access: nothing can be created or changed. */
  readOnly: boolean;
  /** Whether the current user may delete this task (CEO setting). */
  canDelete: (task: Task) => boolean;
  types: TaskType[];
  refreshTypes: () => Promise<void>;
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
  /** Completed tasks older than the loaded window exist on the server. */
  hasOlderClosed: boolean;
  loadOlderClosed: () => Promise<void>;
  /** Loads completed tasks from this date (YYYY-MM-DD) if not loaded yet. */
  ensureClosedFrom: (date: string) => Promise<void>;
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
    tasks, loading, fetchTasks, refreshTaskIds, hasOlderClosed, loadOlderClosed, ensureClosedFrom, addTask, updateTask, deleteTask, refreshTask, currentUserId,
    addAssignees, removeAssignee,
  } = useTasks();
  const shellProfile = useShellProfile();
  const role = shellProfile?.role;
  const workspaceId = shellProfile?.workspace_id;
  const isLead = role === "super_admin" || role === "team_lead";
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [deleteRule, setDeleteRule] = useState<"creator" | "leads">("creator");
  const viewOnly = () => { toast.info("You have view-only access to Tasks"); };

  const [members, setMembers] = useState<TaskMember[]>([]);
  const [teams, setTeams] = useState<TaskTeam[]>([]);
  const refreshTeams = useCallback(async () => {
    try {
      const r = await fetch("/api/tasks/teams");
      if (r.ok) { const j = await r.json(); setTeams(j.teams ?? []); publishLists({ teams: j.teams ?? [], can_manage_teams: !!j.can_manage }); }
    } catch {}
  }, []);
  const [projects, setProjects] = useState<TaskProjectListItem[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const refreshTypes = useCallback(async () => {
    try { const r = await fetch("/api/tasks/types"); if (r.ok) setTypes((await r.json()).types ?? []); } catch {}
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDefaults, setQuickAddDefaults] = useState<Partial<AddTaskInput>>({});

  // The panel always shows the live copy of the selected task from the list.
  // A task opened from the Brands tab may not be in the user's own list (another team's task).
  const [outsideTask, setOutsideTask] = useState<Task | null>(null);
  const listed = tasks.find((t) => t.id === selectedId);
  const selectedTask = listed ? { ...listed, can_edit: outsideTask?.id === listed.id ? outsideTask.can_edit ?? listed.can_edit : listed.can_edit } : outsideTask?.id === selectedId ? outsideTask : null;

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/projects");
      const json = await res.json();
      if (res.ok) { setProjects(json.projects ?? []); publishLists({ projects: json.projects ?? [] }); }
    } catch {}
  }, []);

  // Members, teams, brands, types and settings: one request, shown from the cache first.
  const applyBootstrap = useCallback((b: Bootstrap) => {
    setMembers(b.members ?? []);
    setTeams(b.teams ?? []);
    setProjects(b.projects ?? []);
    setTypes(b.types ?? []);
    setReadOnly(!!b.settings?.read_only);
    if (b.settings?.delete_rule) setDeleteRule(b.settings.delete_rule);
    publishLists({ projects: b.projects, teams: b.teams, can_manage_teams: b.can_manage_teams });
  }, []);
  const loadBootstrap = useCallback(async () => {
    try {
      const r = await fetch("/api/tasks/bootstrap");
      if (!r.ok) return;
      const b = (await r.json()) as Bootstrap;
      applyBootstrap(b);
      writeCache(currentUserId, "bootstrap", b);
    } catch {}
  }, [applyBootstrap, currentUserId]);

  useEffect(() => {
    const cached = readCache<Bootstrap>(currentUserId, "bootstrap");
    if (cached) applyBootstrap(cached);
    loadBootstrap();
    // Deadline reminders (also saved to the notification bell, once per task per day).
    fetch("/api/tasks/reminders", { method: "POST" }).then((r) => r.json()).then((json) => setReminders(json.reminders ?? [])).catch(() => {});
  }, [applyBootstrap, loadBootstrap, currentUserId]);

  // Live sync: the server pings this channel after every change anyone makes.
  // A ping that names tasks re-reads only those; one without details re-reads
  // everything (team, brand or type changes). Pings arriving close together are merged.
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = new Set<string>();
    let full = false;
    const channel = supabase.channel(`tasks-sync:${workspaceId}`)
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        const ids = (payload as { tasks?: string[] } | undefined)?.tasks;
        if (!Array.isArray(ids)) full = true;
        else ids.forEach((id) => pending.add(id));
        clearTimeout(timer);
        timer = setTimeout(() => {
          const ids = [...pending];
          pending = new Set();
          if (full || ids.length > 40) { full = false; fetchTasks(true); loadBootstrap(); }
          else if (ids.length) refreshTaskIds(ids);
        }, 300);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [workspaceId, fetchTasks, refreshTaskIds, loadBootstrap]);

  // Deep link: /dashboard/actions/...?task=<id> opens that task once tasks are loaded.
  useEffect(() => {
    if (loading) return;
    const id = new URLSearchParams(window.location.search).get("task");
    if (id && tasks.some((t) => t.id === id)) { setSelectedId(id); setPanelOpen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Global "T" hotkey for quick add, available across every Tasks-module page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); window.dispatchEvent(new Event("tasks:quick-add")); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const open = () => { if (readOnly) viewOnly(); else { setQuickAddDefaults({}); setQuickAddOpen(true); } };
    window.addEventListener("tasks:quick-add", open);
    return () => window.removeEventListener("tasks:quick-add", open);
  }, [readOnly]);

  const value: TasksContextValue = {
    tasks, loading, members, teams, refreshTeams, projects, types, refreshTypes, currentUserId, refreshProjects, isLead, readOnly,
    canDelete: (task) => !readOnly && (isLead || (deleteRule === "creator" && task.created_by === currentUserId)),
    reminders: reminders.filter((r) => tasks.some((t) => t.id === r.id && t.status !== "done")),
    refreshTasks: () => fetchTasks(),
    hasOlderClosed, loadOlderClosed, ensureClosedFrom,
    addTask: async (input) => {
      if (readOnly) { viewOnly(); return null; }
      try { return await addTask(input); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    updateTask: async (id, updates) => {
      if (readOnly) { viewOnly(); return; }
      if (tasks.find((t) => t.id === id)?.can_edit === false) { toast.info("Only the people working on this task can change it."); return; }
      try { await updateTask(id, updates); } catch (e) {
        toast.error(errMsg(e));
        // Completing needs the main file: open the task so it can be uploaded right away.
        if (/main file/i.test(errMsg(e))) { setSelectedId(id); setPanelOpen(true); }
      }
    },
    deleteTask: async (id) => {
      await deleteTask(id);
      if (selectedId === id) { setPanelOpen(false); setSelectedId(null); }
    },
    addAssignees: async (id, payload) => {
      if (tasks.find((t) => t.id === id)?.can_edit === false) { toast.info("Only the people working on this task can change it."); return null; }
      try { return await addAssignees(id, payload); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    removeAssignee: async (id, userId) => {
      if (tasks.find((t) => t.id === id)?.can_edit === false) { toast.info("Only the people working on this task can change it."); return null; }
      try { return await removeAssignee(id, userId); } catch (e) { toast.error(errMsg(e)); return null; }
    },
    openTask: (task) => { setOutsideTask(task); setSelectedId(task.id); setPanelOpen(true); },
    openQuickAdd: (defaults) => { if (readOnly) { viewOnly(); return; } setQuickAddDefaults(defaults ?? {}); setQuickAddOpen(true); },
  };

  return (
    <TasksContext.Provider value={value}>
      {children}

      <TaskDetailModal
        task={selectedTask}
        open={panelOpen && !!selectedTask}
        onClose={() => setPanelOpen(false)}
        onUpdate={value.updateTask}
        onDelete={value.deleteTask}
        onDuplicate={async (t) => {
          const copy = await value.addTask({
            // A fresh copy: same details, back to To do, no dates and no files (it gets its own folder).
            title: `${t.title} (copy)`, description: t.description, project_id: t.project_id, status: "todo",
            type_id: t.type_id, priority: t.priority, due_date: null, planned_date: null, recurring_pattern: t.recurring_pattern,
            brief_note: t.brief_note, reference_note: t.reference_note, team_id: t.team_id,
            assignee_ids: t.assignees.map((a) => a.id),
          });
          if (copy) { toast.success("Task duplicated"); setSelectedId(copy.id); }
        }}
        onRefresh={(id) => { refreshTask(id); }}
        members={members}
        teams={teams}
        types={types}
        projects={projects}
        currentUserId={currentUserId}
        isLead={isLead}
        canDelete={selectedTask ? value.canDelete(selectedTask) : false}
        onTypesChange={() => { refreshTypes(); fetchTasks(); }}
        onAddAssignees={(id, p) => { value.addAssignees(id, p); }}
        onRemoveAssignee={(id, u) => { value.removeAssignee(id, u); }}
      />

      <QuickAddTask
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={(input) => value.addTask({ ...quickAddDefaults, ...input })}
        members={members}
        teams={teams}
        projects={projects}
        types={types}
        currentUserId={currentUserId}
        defaults={quickAddDefaults}
        onUploaded={(id) => { refreshTask(id); }}
      />
    </TasksContext.Provider>
  );
}
