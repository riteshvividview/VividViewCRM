"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, LayoutGrid, Table2, List, GanttChartSquare, Trash2, Users, CalendarDays, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/modules/tasks/components/task-board";
import { TaskTable } from "@/modules/tasks/components/task-table";
import { TaskTimeline } from "@/modules/tasks/components/task-timeline";
import { TaskList } from "@/modules/tasks/components/task-list";
import { TaskDetailPanel } from "@/modules/tasks/components/task-detail-panel";
import { QuickAddTask } from "@/modules/tasks/components/quick-add-task";
import { useTasks } from "@/modules/tasks/hooks/use-tasks";
import type { Task, TaskStatus } from "@/modules/tasks/types";
import { PRIORITY_CONFIG } from "@/modules/tasks/types";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "table" | "timeline" | "list";
type FilterPreset = "all" | "mine" | "overdue" | "today";

const VIEW_ICONS = { board: LayoutGrid, table: Table2, timeline: GanttChartSquare, list: List };

const FALLBACK_ASSIGNEES = [
  { id: "u1", name: "Alex Kumar" },
  { id: "u2", name: "Priya Singh" },
  { id: "u3", name: "Sam Tiwari" },
];

export default function ActionsPage() {
  const { tasks, loading, addTask, updateTask, deleteTask, currentUserId } = useTasks();
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPreset>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [listGroupBy, setListGroupBy] = useState<"assignee" | "due_date" | "status">("due_date");
  const [assignees, setAssignees] = useState(FALLBACK_ASSIGNEES);

  useEffect(() => {
    async function fetchAssignees() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return;
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().from("profiles").select("user_id, full_name");
        if (data && data.length > 0) {
          setAssignees(data.map((r) => ({ id: r.user_id as string, name: (r.full_name as string) || "Unknown" })));
        }
      } catch {}
    }
    fetchAssignees();
  }, []);

  // Global "T" hotkey for quick add
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") { e.preventDefault(); setQuickAddOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let result = tasks;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (filter === "mine") result = result.filter((t) => t.assignee_id === currentUserId);
    if (filter === "overdue") result = result.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");
    if (filter === "today") result = result.filter((t) => t.due_date && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= today);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || (t.linked_entity_name ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [tasks, filter, search, currentUserId]);

  const overdueCt = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
  const todayCt = tasks.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  function openTask(t: Task) { setSelectedTask(t); setPanelOpen(true); }

  async function handleUpdate(id: string, updates: Partial<Task>) {
    await updateTask(id, updates);
    setSelectedTask((p) => p?.id === id ? { ...p, ...updates } : p);
  }

  async function handleAdd(partial: Partial<Task>) { await addTask(partial); }

  function handleBulkDelete() { selectedIds.forEach((id) => deleteTask(id)); setSelectedIds([]); }

  async function handleBulkAssign(assignee_name: string) {
    const a = assignees.find((a) => a.name === assignee_name);
    await Promise.all(selectedIds.map((id) => updateTask(id, { assignee_id: a?.id ?? null, assignee_name })));
    setSelectedIds([]);
  }

  return (
    <div>
      <PageHeader
        title="Action Items"
        description={`${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">T</kbd> to quick add
            </Button>
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setQuickAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />New Task
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { id: "all", label: "All" },
            { id: "mine", label: "My Tasks" },
            { id: "overdue", label: `Overdue${overdueCt > 0 ? ` (${overdueCt})` : ""}`, warn: overdueCt > 0 },
            { id: "today", label: `Due Today${todayCt > 0 ? ` (${todayCt})` : ""}` },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f.id ? "bg-purple-600 text-white" :
                  f.id === "overdue" && overdueCt > 0 ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-200" :
                  "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs ml-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{selectedIds.length} selected</span>
              <Select onValueChange={handleBulkAssign}>
                <SelectTrigger className="h-6 text-xs border-0 bg-transparent text-purple-700 dark:text-purple-300 w-auto gap-1 focus:ring-0 px-1">
                  <Users className="h-3 w-3 mr-1" />Assign
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500 hover:text-red-700 px-1" onClick={handleBulkDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {view === "list" && (
            <Select value={listGroupBy} onValueChange={(v) => setListGroupBy(v as typeof listGroupBy)}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Group by Due Date</SelectItem>
                <SelectItem value="assignee">Group by Assignee</SelectItem>
                <SelectItem value="status">Group by Status</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* View switcher */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {(Object.keys(VIEW_ICONS) as ViewMode[]).map((v) => {
              const Icon = VIEW_ICONS[v];
              return (
                <button
                  key={v}
                  title={v.charAt(0).toUpperCase() + v.slice(1)}
                  className={cn("px-2.5 py-1.5 transition-colors", view === v ? "bg-muted" : "hover:bg-muted/50")}
                  onClick={() => setView(v)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[220px] space-y-2">
              <div className="h-8 rounded-lg bg-muted/40 animate-pulse" />
              {[...Array(3)].map((_, j) => <div key={j} className="h-24 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : view === "board" ? (
        <TaskBoard
          tasks={filtered}
          onTaskClick={openTask}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onAddTask={(status) => { addTask({ status }); }}
        />
      ) : view === "table" ? (
        <TaskTable
          tasks={filtered}
          onTaskClick={openTask}
          onStatusToggle={(id, s) => updateTask(id, { status: s })}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          globalFilter={search}
        />
      ) : view === "timeline" ? (
        <TaskTimeline tasks={filtered} onTaskClick={openTask} />
      ) : (
        <TaskList
          tasks={filtered}
          groupBy={listGroupBy}
          onTaskClick={openTask}
          onStatusToggle={(id, s) => updateTask(id, { status: s })}
        />
      )}

      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onUpdate={handleUpdate}
        onDelete={deleteTask}
        assignees={assignees}
      />

      <QuickAddTask
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
