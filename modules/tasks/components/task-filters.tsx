"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSliders, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Task, TaskMember, TaskType, TaskPriority } from "../types";
import { PriorityLabel } from "./task-icons";
import { cn } from "@/lib/utils";

export interface TaskFilterState { assignees: string[]; types: string[]; priorities: TaskPriority[]; search: string }
export const EMPTY_FILTERS: TaskFilterState = { assignees: [], types: [], priorities: [], search: "" };

export function applyTaskFilters(tasks: Task[], f: TaskFilterState): Task[] {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((t) =>
    (!f.assignees.length || t.assignees.some((a) => f.assignees.includes(a.id))) &&
    (!f.types.length || (t.type_id && f.types.includes(t.type_id))) &&
    (!f.priorities.length || f.priorities.includes(t.priority)) &&
    (!q || t.title.toLowerCase().includes(q)),
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Bordio filter button (assignee / type / priority) + search box. */
export function TaskFilters({ value, onChange, members, types }: {
  value: TaskFilterState; onChange: (f: TaskFilterState) => void; members: TaskMember[]; types: TaskType[];
}) {
  const active = value.assignees.length + value.types.length + value.priorities.length;
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button title="Filters" className={cn("relative flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground", active > 0 && "border-sky-500/60 text-sky-500")}>
            <FontAwesomeIcon icon={faSliders} className="h-3.5 w-3.5" />
            {active > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] text-white">{active}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Assignee</DropdownMenuLabel>
          {members.map((m) => (
            <DropdownMenuCheckboxItem key={m.id} checked={value.assignees.includes(m.id)} onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...value, assignees: toggle(value.assignees, m.id) })}>{m.full_name}</DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Type</DropdownMenuLabel>
          {types.map((t) => (
            <DropdownMenuCheckboxItem key={t.id} checked={value.types.includes(t.id)} onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...value, types: toggle(value.types, t.id) })}>
              <span className="mr-2 h-3 w-3 rounded" style={{ backgroundColor: t.color }} />{t.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Priority</DropdownMenuLabel>
          {(["urgent", "high", "medium", "low", "none"] as TaskPriority[]).map((p) => (
            <DropdownMenuCheckboxItem key={p} checked={value.priorities.includes(p)} onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...value, priorities: toggle(value.priorities, p) })}>
              <PriorityLabel priority={p} />
            </DropdownMenuCheckboxItem>
          ))}
          {active > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onChange({ ...value, assignees: [], types: [], priorities: [] })}>Clear filters</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] text-muted-foreground focus-within:border-sky-500/60">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3 w-3" />
        <input value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} placeholder="Search" className="w-28 bg-transparent text-foreground focus:outline-none sm:w-40" />
      </label>
    </div>
  );
}
