"use client";

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTableList, faTableColumns } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import { BordioKanban, type KanbanColumn } from "@/modules/tasks/components/bordio-kanban";
import { BordioTable } from "@/modules/tasks/components/bordio-table";
import { TaskFilters, applyTaskFilters, EMPTY_FILTERS, type TaskFilterState } from "@/modules/tasks/components/task-filters";
import { STATUS_CONFIG, type TaskStatus } from "@/modules/tasks/types";
import { cn } from "@/lib/utils";

const COLUMNS: KanbanColumn[] = (Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => ({ id: s, name: STATUS_CONFIG[s].label, status_key: s }));

/** My work across all projects — Bordio table / kanban with filters. */
export default function AllTasksPage() {
  const { tasks, members, types, currentUserId, openQuickAdd, openTask, updateTask } = useTasksContext();
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [mineOnly, setMineOnly] = useState(true);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);

  const visible = useMemo(() => {
    const scoped = mineOnly ? tasks.filter((t) => t.assignees.some((a) => a.id === currentUserId) || (!t.assignees.length && t.created_by === currentUserId)) : tasks;
    return applyTaskFilters(scoped, filters);
  }, [tasks, mineOnly, currentUserId, filters]);

  return (
    <div className="-m-3 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <Button className="h-9 rounded-full bg-sky-500 px-4 text-white hover:bg-sky-600" onClick={() => openQuickAdd()}>
          <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />Add new
        </Button>
        <div className="flex rounded-full bg-muted p-1">
          {([["table", "Table view", faTableList], ["kanban", "Kanban board", faTableColumns]] as const).map(([v, label, icon]) => (
            <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-muted p-1">
          {([[true, "My work"], [false, "Everyone"]] as const).map(([v, label]) => (
            <button key={label} onClick={() => setMineOnly(v)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", mineOnly === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <div className="ml-auto"><TaskFilters value={filters} onChange={setFilters} members={members} types={types} /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {view === "kanban" ? (
          <BordioKanban
            columns={COLUMNS}
            columnOf={(t) => t.status}
            tasks={visible}
            onMove={(t, col) => updateTask(t.id, { status: col.status_key })}
            onOpen={openTask}
            onToggleDone={(t) => updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })}
            onAdd={(col) => openQuickAdd({ status: col.status_key })}
          />
        ) : (
          <BordioTable tasks={visible} onOpen={openTask} onCreate={() => openQuickAdd()} />
        )}
      </div>
    </div>
  );
}
