"use client";

import { dateLocale } from "@/lib/user-prefs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Pen, Users } from "@/components/shared/fa-icons";
import { TeamDialog } from "./team-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useTasksContext } from "../context/tasks-context";
import { TASK_DRAG_TYPE } from "./task-card";
import { AssigneeAvatar } from "./assignee-picker";
import type { Task } from "../types";
import { cardColor } from "../lib/bordio";
import { addDays, formatWeekRange, startOfWeek, toISODate, todayISO, weekDays } from "../dates";
import { cn } from "@/lib/utils";

/** One task inside a member's day: a single compact line, full title on hover. */
function TaskChip({ task, memberId, onOpen }: { task: Task; memberId: string; onOpen: (t: Task) => void }) {
  const done = task.status === "done";
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        e.dataTransfer.setData("text/member", memberId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(task)}
      title={task.title}
      className={cn(
        "flex w-full cursor-grab items-center gap-1.5 rounded-md border bg-background px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors hover:border-foreground/25 hover:bg-muted/50 active:cursor-grabbing",
        done && "opacity-60",
      )}
    >
      <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: cardColor(task) }} />
      <span className={cn("min-w-0 flex-1 truncate font-medium", done && "line-through")}>{task.title}</span>
    </button>
  );
}

/** Team calendar: members of one team × days. Drag a task to another day or person to replan / reassign it. */
export function TeamPlanner({ teamId }: { teamId?: string }) {
  const { tasks, members, teams, refreshTeams, isLead, readOnly, currentUserId, updateTask, addAssignees, removeAssignee, openTask, openQuickAdd, ensureClosedFrom } = useTasksContext();
  const router = useRouter();
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  const canManage = isLead && !readOnly;
  // The sidebar "+" opens this page with ?new=1.
  useEffect(() => {
    if (canManage && new URLSearchParams(window.location.search).get("new") === "1") {
      setDialog("new");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [canManage]);

  // Only teams the person belongs to (team leads and the CEO manage every team). No "everyone" view.
  const myTeams = useMemo(
    () => teams.filter((t) => isLead || (!!currentUserId && t.member_ids.includes(currentUserId))),
    [teams, isLead, currentUserId],
  );
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [team, setTeam] = useState<string>(teamId ?? "");
  useEffect(() => {
    if (!myTeams.length) return;
    if (!myTeams.some((t) => t.id === team)) setTeam(myTeams.find((t) => t.id === teamId)?.id ?? myTeams[0].id);
  }, [myTeams, team, teamId]);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const current = myTeams.find((t) => t.id === team) ?? null;
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  // An older week shows its completed tasks too (they load on demand).
  useEffect(() => { ensureClosedFrom(toISODate(weekStart)); }, [weekStart, ensureClosedFrom]);
  const today = todayISO();
  const from = toISODate(weekStart), to = toISODate(addDays(weekStart, 6));

  const rows = useMemo(() => (current ? members.filter((m) => current.member_ids.includes(m.id)) : []), [members, current]);

  const cell = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!current || t.team_id !== current.id) continue;
      if (!t.planned_date || t.planned_date < from || t.planned_date > to) continue;
      for (const a of t.assignees) {
        const key = `${a.id}|${t.planned_date}`;
        map.set(key, [...(map.get(key) ?? []), t]);
      }
    }
    // Open tasks first, then by title.
    for (const list of map.values()) list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.title.localeCompare(b.title));
    return map;
  }, [tasks, from, to, current]);

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

  const grid = "minmax(170px, 200px) repeat(7, minmax(120px, 1fr))";

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[520px]">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <h1 className="mr-2 text-lg font-semibold">Team</h1>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
        <div className="flex items-center rounded-lg border">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" aria-label="Previous week" onClick={() => setWeekStart((w) => addDays(w, -7))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none border-l" aria-label="Next week" onClick={() => setWeekStart((w) => addDays(w, 7))}><ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <div className="ml-auto flex items-center gap-2">
          {canManage && current && <Button variant="outline" size="sm" className="h-8" onClick={() => setDialog("edit")}><Pen className="mr-1.5 h-3.5 w-3.5" />Edit team</Button>}
          {canManage && <Button size="sm" className="h-8" onClick={() => setDialog("new")}><Plus className="mr-1.5 h-3.5 w-3.5" />New team</Button>}
          {myTeams.length > 0 && (
            <Select value={current?.id ?? ""} onValueChange={setTeam}>
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: current?.color ?? "#6366f1" }} />
                  <span className="truncate">{current?.name ?? "Choose a team"}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {myTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color ?? "#6366f1" }} />{t.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <TeamDialog
        open={dialog !== null} team={dialog === "edit" ? current : null} members={members}
        onClose={() => setDialog(null)}
        onSaved={(saved) => { setDialog(null); refreshTeams(); router.push(`/dashboard/actions/teams/${saved.id}`); }}
        onDeleted={() => { setDialog(null); refreshTeams(); setTeam(""); router.push("/dashboard/actions/teams"); }}
      />

      {!current ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed text-center">
          <Users className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-medium">{teams.length ? "Choose a team" : isLead ? "No teams yet. Create one from the sidebar." : "You are not in a team yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {canManage ? "Create a team and add people to see their week here." : "A team lead adds you to a team. You will then see your team's week here."}
          </p>
          {canManage && <Button size="sm" className="mt-4" onClick={() => setDialog("new")}><Plus className="mr-1.5 h-3.5 w-3.5" />New team</Button>}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
          <div className="min-w-[1080px]">
            <div className="sticky top-0 z-10 grid border-b bg-card" style={{ gridTemplateColumns: grid }}>
              <div className="flex items-center px-3 py-2 text-xs text-muted-foreground">{rows.length} member{rows.length === 1 ? "" : "s"}</div>
              {days.map((d) => {
                const iso = toISODate(d);
                return (
                  <div key={iso} className={cn("border-l px-2 py-2 text-center", iso === today && "bg-primary/[0.04]")}>
                    <span className={cn("text-[11px] font-medium uppercase tracking-wide", iso === today ? "text-primary" : "text-muted-foreground")}>{d.toLocaleDateString(dateLocale(), { weekday: "short" })} </span>
                    <span className={cn("text-sm font-semibold", iso === today && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members in this team yet.</p>}
            {rows.map((m) => {
              const weekTasks = days.flatMap((d) => cell.get(`${m.id}|${toISODate(d)}`) ?? []);
              const open = weekTasks.filter((t) => t.status !== "done").length;
              return (
                <div key={m.id} className="grid border-b last:border-0" style={{ gridTemplateColumns: grid }}>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <AssigneeAvatar member={m} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium" title={m.full_name}>{m.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{open ? `${open} open this week` : "Nothing open this week"}</p>
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
                        className={cn("group flex min-h-[72px] flex-col border-l p-1.5 transition-colors", iso === today && "bg-primary/[0.03]", dragOver === key && "bg-primary/10")}
                      >
                        {/* Any number of tasks fits: the day scrolls on its own after a few lines. */}
                        <div className="max-h-[132px] space-y-1 overflow-y-auto pr-0.5 scrollbar-thin">
                          {list.map((t) => <TaskChip key={t.id} task={t} memberId={m.id} onOpen={openTask} />)}
                        </div>
                        {list.length > 4 && <p className="mt-1 text-center text-[10px] text-muted-foreground">{list.length} tasks</p>}
                        {!readOnly && (
                          <button
                            onClick={() => openQuickAdd({ planned_date: iso, assignee_ids: [m.id], team_id: current.id })}
                            className="mt-auto hidden w-full items-center justify-center rounded py-0.5 text-[11px] text-muted-foreground hover:bg-muted group-hover:flex"
                          >
                            <Plus className="mr-0.5 h-3 w-3" />Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
