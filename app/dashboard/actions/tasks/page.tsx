"use client";

import { useMemo, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTableList, faTableColumns, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import { BordioKanban, type KanbanColumn } from "@/modules/tasks/components/bordio-kanban";
import { BordioTable } from "@/modules/tasks/components/bordio-table";
import { TaskFilters, applyTaskFilters, EMPTY_FILTERS, type TaskFilterState } from "@/modules/tasks/components/task-filters";
import { STATUS_CONFIG, type TaskStatus } from "@/modules/tasks/types";
import { cn } from "@/lib/utils";
import { MentionsInbox } from "@/modules/tasks/components/mentions-inbox";
import { useShellProfile } from "@/lib/supabase/profile-context";

const COLUMNS: KanbanColumn[] = (Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => ({ id: s, name: STATUS_CONFIG[s].label, status_key: s }));

/** My work across all brands — table / kanban with filters. */
export default function AllTasksPage() {
  const { tasks, members, types, projects, teams, isLead, currentUserId, openQuickAdd, openTask, updateTask } = useTasksContext();
  // People outside every team only see tasks without a team and their own: say so, instead of an unexplained empty list.
  const inNoTeam = !isLead && !!currentUserId && teams.length > 0 && !teams.some((t) => t.member_ids.includes(currentUserId));
  // Remembers Table or Kanban on this browser.
  const [view, setViewState] = useState<"table" | "kanban">("kanban");
  useEffect(() => { try { if (localStorage.getItem("vividview-tasks-view") === "table") setViewState("table"); } catch {} }, []);
  const setView = (v: "table" | "kanban") => { setViewState(v); try { localStorage.setItem("vividview-tasks-view", v); } catch {} };
  // The CEO doesn't do tasks: Everyone, plus a Mentions inbox, instead of "My work".
  const isCeo = useShellProfile()?.role === "super_admin";
  const [mineOnly, setMineOnly] = useState(!isCeo);
  const [mentions, setMentions] = useState(false);
  const openById = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t) openTask(t); else window.location.assign(`/dashboard/actions/tasks?task=${id}`);
  };
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);

  const visible = useMemo(() => {
    const scoped = mineOnly ? tasks.filter((t) => t.assignees.some((a) => a.id === currentUserId) || (!t.assignees.length && t.created_by === currentUserId)) : tasks;
    return applyTaskFilters(scoped, filters);
  }, [tasks, mineOnly, currentUserId, filters]);

  return (
    <div className="-m-3 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <Button className="h-9 rounded-full px-4" onClick={() => openQuickAdd()}>
          <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />New task
        </Button>
        <div className={cn("flex rounded-full bg-muted p-1", mentions && "pointer-events-none opacity-40")}>
          {([["table", "Table view", faTableList], ["kanban", "Kanban board", faTableColumns]] as const).map(([v, label, icon]) => (
            <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        {isCeo ? (
          <div className="flex rounded-full bg-muted p-1">
            {([[false, "Everyone"], [true, "Mentions"]] as const).map(([v, label]) => (
              <button key={label} onClick={() => { setMentions(v); setMineOnly(false); }} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", mentions === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        ) : (
          <div className="flex rounded-full bg-muted p-1">
            {([[true, "My work"], [false, "Everyone"]] as const).map(([v, label]) => (
              <button key={label} onClick={() => setMineOnly(v)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", mineOnly === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        )}
        <div className={cn("ml-auto", mentions && "pointer-events-none opacity-40")}><TaskFilters value={filters} onChange={setFilters} members={members} types={types} brands={projects} /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {inNoTeam && (
          <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
            <FontAwesomeIcon icon={faCircleInfo} className="h-3.5 w-3.5 shrink-0" />
            You’re not in a team yet. Team tasks appear here once you’re added to a team.
          </p>
        )}
        {mentions ? (
          <MentionsInbox onOpen={openById} />
        ) : view === "kanban" ? (
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
