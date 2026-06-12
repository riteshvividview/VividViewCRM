"use client";

import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Task, TaskStatus } from "../types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "../types";
import { cn } from "@/lib/utils";

function PriorityDot({ priority }: { priority: Task["priority"] }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0 inline-block"
      style={{
        backgroundColor:
          priority === "urgent" ? "#ef4444"
          : priority === "high" ? "#f59e0b"
          : priority === "medium" ? "#3b82f6"
          : "#94a3b8",
      }}
    />
  );
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const priCfg = PRIORITY_CONFIG[task.priority];
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card border border-border rounded-xl p-3 cursor-pointer group",
        "hover:shadow-sm hover:border-purple-200 dark:hover:border-purple-800 transition-all border-l-4",
        priCfg.border,
        isDragging && "opacity-40 shadow-xl"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium text-foreground leading-snug",
            task.status === "done" && "line-through text-muted-foreground"
          )}>
            {task.title}
          </p>
          {task.linked_entity_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {task.linked_entity_name}
            </p>
          )}
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", priCfg.bg, priCfg.color)}>
          {priCfg.label}
        </span>
        {task.due_date && (
          <span className={cn("text-[10px] font-medium", isOverdue ? "text-red-500" : "text-muted-foreground")}>
            {isOverdue ? "⚠ " : ""}
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.sub_tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {task.sub_tasks.filter((s) => s.checked).length}/{task.sub_tasks.length}
          </span>
        )}
        {task.assignee_name && (
          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {task.assignee_name.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  status, tasks, onTaskClick, onAddTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex-1 min-w-[260px] max-w-[320px]">
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-3", cfg.bg)}>
        <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
        <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
        <span className={cn("ml-auto text-xs font-medium", cfg.color)}>{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
          ))}
        </div>
      </SortableContext>
      <button
        className="mt-2 w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
        onClick={() => onAddTask(status)}
      >
        <Plus className="h-3.5 w-3.5" />Add task
      </button>
    </div>
  );
}

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function TaskBoard({ tasks, onTaskClick, onStatusChange, onAddTask }: TaskBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<TaskStatus>("todo");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const statuses: TaskStatus[] = ["todo", "in_progress", "waiting", "done"];

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragId(null);
    if (!over) return;
    const targetStatus =
      statuses.find((s) => s === over.id) ?? tasks.find((t) => t.id === over.id)?.status;
    if (targetStatus && active.id !== over.id) {
      onStatusChange(active.id as string, targetStatus);
    }
  }

  const dragTask = tasks.find((t) => t.id === dragId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }: DragStartEvent) => setDragId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      {/* ── Mobile: one column at a time with tab switcher ── */}
      <div className="md:hidden">
        {/* Tab row */}
        <div className="flex gap-1 mb-4 bg-muted p-1 rounded-xl overflow-x-auto">
          {statuses.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const count = tasks.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setMobileTab(s)}
                className={cn(
                  "flex-1 min-w-[72px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  mobileTab === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                {cfg.label}
                <span className={cn(
                  "text-[10px] font-bold px-1.5 rounded-full",
                  mobileTab === s ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" : "bg-muted-foreground/10"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active column cards */}
        <div className="space-y-2">
          {tasks
            .filter((t) => t.status === mobileTab)
            .map((t) => (
              <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
            ))}
          {tasks.filter((t) => t.status === mobileTab).length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No tasks in this column
            </div>
          )}
        </div>

        <button
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm text-muted-foreground border border-dashed border-border hover:bg-muted/40 transition-colors"
          onClick={() => onAddTask(mobileTab)}
        >
          <Plus className="h-4 w-4" />Add task to {STATUS_CONFIG[mobileTab].label}
        </button>
      </div>

      {/* ── Desktop: all columns side by side with drag ── */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {dragTask && (
          <div className={cn(
            "bg-card border border-border rounded-xl p-3 shadow-xl text-sm font-medium border-l-4",
            PRIORITY_CONFIG[dragTask.priority].border
          )}>
            {dragTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
