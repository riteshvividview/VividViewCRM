"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasksContext } from "../context/tasks-context";
import { TaskCard, TASK_DRAG_TYPE } from "./task-card";
import { AssigneeAvatar } from "./assignee-picker";
import type { Task } from "../types";
import { addDays, formatMinutes, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
import { cn } from "@/lib/utils";

/** Team calendar: members × days. Drag a task to another day or person to replan / reassign it. */
export function TeamPlanner({ teamId }: { teamId?: string }) {
  const { tasks, members, teams, updateTask, addAssignees, removeAssignee, openTask, openQuickAdd } = useTasksContext();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [team, setTeam] = useState<string>(teamId ?? "all");
  const [dragOver, setDragOver] = useState<string | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = todayISO();
  const from = toISODate(weekStart), to = toISODate(addDays(weekStart, 6));

  const rows = useMemo(() => {
    const t = teams.find((x) => x.id === team);
    return t ? members.filter((m) => t.member_ids.includes(m.id)) : members;
  }, [members, teams, team]);

  const cell = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.planned_date || t.planned_date < from || t.planned_date > to) continue;
      for (const a of t.assignees) {
        const key = `${a.id}|${t.planned_date}`;
        map.set(key, [...(map.get(key) ?? []), t]);
      }
    }
    return map;
  }, [tasks, from, to]);

  async function onDrop(e: React.DragEvent, memberId: string, day: string) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(TASK_DRAG_TYPE);
    const fromMember = e.dataTransfer.getData("text/member");
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.planned_date !== day) await updateTask(id, { planned_date: day });
    if (fromMember && fromMember !== memberId && !task.assignees.some((a) => a.id === memberId)) {
      await addAssignees(id, { user_ids: [memberId] });
      await removeAssignee(id, fromMember);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[520px]">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h1 className="text-lg font-semibold mr-2">Team</h1>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <div className="ml-auto">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border bg-card">
        <div className="min-w-[1100px]">
          <div className="sticky top-0 z-10 grid border-b bg-card" style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}>
            <div className="px-3 py-2 text-xs text-muted-foreground">Member</div>
            {days.map((d) => {
              const iso = toISODate(d);
              return (
                <div key={iso} className="border-l px-2 py-2 text-center">
                  <span className="text-[11px] uppercase text-muted-foreground">{d.toLocaleDateString("en-IN", { weekday: "short" })} </span>
                  <span className={cn("text-sm font-semibold", iso === today && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members in this team.</p>}
          {rows.map((m) => {
            const weekTasks = days.flatMap((d) => cell.get(`${m.id}|${toISODate(d)}`) ?? []);
            const load = weekTasks.filter((t) => t.status !== "done").reduce((s, t) => s + (t.estimated_hours ?? 0) * 60, 0);
            return (
              <div key={m.id} className="grid border-b last:border-0" style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}>
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <AssigneeAvatar member={m} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{weekTasks.filter((t) => t.status !== "done").length} open · {formatMinutes(load)}</p>
                  </div>
                </div>
                {days.map((d) => {
                  const iso = toISODate(d);
                  const key = `${m.id}|${iso}`;
                  const list = cell.get(key) ?? [];
                  return (
                    <div
                      key={iso}
                      onDragOver={(e) => { e.preventDefault(); if (dragOver !== key) setDragOver(key); }}
                      onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver(null); }}
                      onDrop={(e) => onDrop(e, m.id, iso)}
                      className={cn("group min-h-[84px] space-y-1 border-l p-1.5 transition-colors", iso === today && "bg-primary/[0.03]", dragOver === key && "bg-primary/10")}
                    >
                      {list.map((t) => (
                        <div key={t.id} onDragStart={(e) => e.dataTransfer.setData("text/member", m.id)}>
                          <TaskCard task={t} compact onOpen={openTask} onToggleDone={(x) => updateTask(x.id, { status: x.status === "done" ? "todo" : "done" })} />
                        </div>
                      ))}
                      <button
                        onClick={() => openQuickAdd({ planned_date: iso, assignee_ids: [m.id] })}
                        className="hidden w-full items-center justify-center rounded py-0.5 text-[11px] text-muted-foreground hover:bg-muted group-hover:flex"
                      >
                        <Plus className="h-3 w-3 mr-0.5" />Add
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
