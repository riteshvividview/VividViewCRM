"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, CalendarDays, User } from "lucide-react";
import type { Task } from "../types";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "../types";
import { cn } from "@/lib/utils";

type GroupBy = "assignee" | "due_date" | "status";

interface TaskListProps {
  tasks: Task[];
  groupBy: GroupBy;
  onTaskClick: (t: Task) => void;
  onStatusToggle: (id: string, status: Task["status"]) => void;
}

function TaskRow({ task, onTaskClick, onStatusToggle }: { task: Task; onTaskClick: () => void; onStatusToggle: () => void }) {
  const priCfg = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div
      className={cn("group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors border-l-4", priCfg.border)}
      onClick={onTaskClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onStatusToggle(); }}
        className="shrink-0"
      >
        {task.status === "done"
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <Circle className="h-4 w-4 text-muted-foreground hover:text-emerald-500 transition-colors" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</span>
        {task.linked_entity_name && (
          <span className="text-[11px] text-muted-foreground ml-2">{task.linked_entity_name}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", priCfg.bg, priCfg.color)}>{priCfg.label}</span>
        {task.due_date && (
          <span className={cn("flex items-center gap-0.5 text-[11px]", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            <CalendarDays className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.assignee_name && (
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <User className="h-3 w-3" />
            {task.assignee_name.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

export function TaskList({ tasks, groupBy, onTaskClick, onStatusToggle }: TaskListProps) {
  const groups = useMemo(() => {
    if (groupBy === "assignee") {
      const map = new Map<string, Task[]>();
      tasks.forEach((t) => {
        const key = t.assignee_name ?? "Unassigned";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      });
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }
    if (groupBy === "due_date") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
      const groups: { label: string; items: Task[] }[] = [
        { label: "Overdue", items: tasks.filter((t) => t.due_date && new Date(t.due_date) < today && t.status !== "done") },
        { label: "Today", items: tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() === today.toDateString()) },
        { label: "Tomorrow", items: tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() === tomorrow.toDateString()) },
        { label: "This Week", items: tasks.filter((t) => { if (!t.due_date) return false; const d = new Date(t.due_date); return d > tomorrow && d <= nextWeek; }) },
        { label: "Later", items: tasks.filter((t) => t.due_date && new Date(t.due_date) > nextWeek) },
        { label: "No Due Date", items: tasks.filter((t) => !t.due_date) },
      ];
      return groups.filter((g) => g.items.length > 0);
    }
    // status
    return (["todo", "in_progress", "waiting", "done"] as const).map((s) => ({
      label: STATUS_CONFIG[s].label,
      items: tasks.filter((t) => t.status === s),
    })).filter((g) => g.items.length > 0);
  }, [tasks, groupBy]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">{g.label}</h3>
          <div className="space-y-1">
            {g.items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onTaskClick={() => onTaskClick(t)}
                onStatusToggle={() => onStatusToggle(t.id, t.status === "done" ? "todo" : "done")}
              />
            ))}
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">No tasks found</div>
      )}
    </div>
  );
}
