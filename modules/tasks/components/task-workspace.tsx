"use client";

import { useMemo, useState } from "react";
import { Search, LayoutGrid, Table2, List, GanttChartSquare, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskBoard } from "./task-board";
import { TaskTable } from "./task-table";
import { TaskTimeline } from "./task-timeline";
import { TaskList } from "./task-list";
import { useTasksContext } from "../context/tasks-context";
import type { Task } from "../types";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "table" | "timeline" | "list";
type FilterPreset = "all" | "mine" | "overdue" | "today";

const VIEW_ICONS = { board: LayoutGrid, table: Table2, timeline: GanttChartSquare, list: List };

interface TaskWorkspaceProps {
  /** Pre-scoped task list (e.g. all tasks, a project's tasks, a team's tasks). */
  tasks: Task[];
  /** Show the All/My Tasks/Overdue/Due Today filter chips. Default true. */
  showFilters?: boolean;
  defaultView?: ViewMode;
}

export function TaskWorkspace({ tasks, showFilters = true, defaultView = "board" }: TaskWorkspaceProps) {
  const { loading, updateTask, deleteTask, addTask, addAssignees, members, currentUserId, openTask } = useTasksContext();
  const [view, setView] = useState<ViewMode>(defaultView);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPreset>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [listGroupBy, setListGroupBy] = useState<"assignee" | "due_date" | "status">("due_date");

  const filtered = useMemo(() => {
    let result = tasks;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (filter === "mine") result = result.filter((t) => t.assignees.some((a) => a.id === currentUserId));
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

  function handleBulkDelete() { selectedIds.forEach((id) => deleteTask(id)); setSelectedIds([]); }

  async function handleBulkAssign(userId: string) {
    await Promise.all(selectedIds.map((id) => addAssignees(id, { user_ids: [userId] })));
    setSelectedIds([]);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        {showFilters && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-0.5">
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
        )}

        <div className="relative flex-1 min-w-0 sm:min-w-[180px] sm:max-w-xs sm:ml-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{selectedIds.length} selected</span>
              <Select onValueChange={handleBulkAssign}>
                <SelectTrigger className="h-6 text-xs border-0 bg-transparent text-purple-700 dark:text-purple-300 w-auto gap-1 focus:ring-0 px-1">
                  <Users className="h-3 w-3 mr-1" />Assign
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
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

      {filtered.length === 0 && !loading && tasks.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">No tasks here yet.</div>
      )}
    </div>
  );
}
