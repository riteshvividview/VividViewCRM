"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCheck, faCalendar, faUser } from "@fortawesome/free-regular-svg-icons";
import { faPlus, faTableList, faTableColumns, faChevronLeft, faChevronRight, faSpinner, faPen } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasksContext } from "../context/tasks-context";
import { BordioKanban, type KanbanColumn } from "./bordio-kanban";
import { BordioTable } from "./bordio-table";
import { WeeklyPlanner } from "./weekly-planner";
import { TaskFilters, applyTaskFilters, EMPTY_FILTERS, type TaskFilterState } from "./task-filters";
import { TeamDialog } from "./team-dialog";
import { STATUS_CONFIG, type TaskStatus } from "../types";
import { initials } from "../lib/bordio";
import { cn } from "@/lib/utils";

type Tool = "tasks" | "calendar" | "members";
interface TeamMemberRow { id: string; full_name: string; avatar_url: string | null; email: string | null; role: string }

const TOOLS: { id: Tool; label: string; icon: typeof faSquareCheck }[] = [
  { id: "tasks", label: "Tasks", icon: faSquareCheck },
  { id: "calendar", label: "Calendar", icon: faCalendar },
  { id: "members", label: "Members", icon: faUser },
];
const COLUMNS: KanbanColumn[] = (Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => ({ id: s, name: STATUS_CONFIG[s].label, status_key: s }));
const ROLE_LABEL: Record<string, string> = { super_admin: "CEO", team_lead: "Team lead", hr: "HR", employee: "Employee" };

/** A team's workspace, Bordio style: tools on the left (Tasks, Calendar, Members), board or table, brand filter. */
export function TeamView({ teamId }: { teamId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { tasks, members, types, projects, teams, refreshTeams, isLead, readOnly, openQuickAdd, openTask, updateTask } = useTasksContext();
  const [tool, setTool] = useState<Tool>((search.get("tool") as Tool) || "tasks");
  const [view, setView] = useState<"table" | "kanban">(search.get("view") === "kanban" ? "kanban" : "table");
  const [showTools, setShowTools] = useState(true);
  const [brand, setBrand] = useState("all");
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const team = teams.find((t) => t.id === teamId) ?? null;
  const canManage = isLead && !readOnly;

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/tasks/teams/${teamId}`);
    if (res.ok) setTeamMembers((await res.json()).members ?? []);
    else setTeamMembers([]);
  }, [teamId]);
  useEffect(() => { loadMembers(); }, [loadMembers, team?.member_ids.length]);

  // Keep tool / view in the URL (shareable, survives refresh).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    qs.set("tool", tool); if (tool === "tasks") qs.set("view", view); else qs.delete("view");
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [tool, view]);

  const teamTasks = useMemo(() => tasks.filter((t) => t.team_id === teamId), [tasks, teamId]);
  const visible = useMemo(() => applyTaskFilters(
    teamTasks.filter((t) => brand === "all" || (brand === "none" ? !t.project_id : t.project_id === brand)), filters,
  ), [teamTasks, brand, filters]);
  const people = useMemo(() => members.filter((m) => team?.member_ids.includes(m.id)), [members, team]);

  if (!team) {
    return (
      <div className="flex flex-col items-center py-24 text-sm text-muted-foreground">
        {teams.length ? "This team does not exist or you are not part of it." : <FontAwesomeIcon icon={faSpinner} spin />}
      </div>
    );
  }

  const brandSelect = (
    <Select value={brand} onValueChange={setBrand}>
      <SelectTrigger className="h-9 w-[160px] rounded-full text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All brands</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color ?? "#6366f1" }} />{p.name}</span></SelectItem>
        ))}
        <SelectItem value="none">No brand</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="-m-3 flex h-[calc(100vh-3.5rem)] sm:-m-6">
      {/* Tools */}
      {showTools ? (
        <nav className="hidden w-[190px] shrink-0 flex-col border-r bg-muted/20 px-3 py-4 md:flex">
          <p className="mb-2 flex items-center gap-2 px-2 text-[13px] font-semibold">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: team.color ?? "#6366f1" }} /><span className="truncate">{team.name}</span>
          </p>
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={cn("mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors", tool === t.id ? "bg-muted font-medium text-primary" : "text-foreground/85 hover:bg-muted/60")}>
              <FontAwesomeIcon icon={t.icon} className="h-4 w-4" />{t.label}
            </button>
          ))}
          <button onClick={() => setShowTools(false)} className="mt-auto flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">
            <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" />Hide tools
          </button>
        </nav>
      ) : (
        <button onClick={() => setShowTools(true)} className="hidden w-8 shrink-0 items-start justify-center border-r pt-5 text-muted-foreground hover:text-foreground md:flex" title="Show tools">
          <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        {tool !== "calendar" && (
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            {!readOnly && (
              <Button className="h-9 rounded-full px-4" onClick={() => openQuickAdd({ team_id: teamId })}>
                <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />Add new
              </Button>
            )}
            {tool === "tasks" && (
              <div className="flex rounded-full bg-muted p-1">
                {([["table", "Table view", faTableList], ["kanban", "Kanban board", faTableColumns]] as const).map(([v, label, icon]) => (
                  <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            )}
            {tool === "tasks" && brandSelect}
            {tool === "tasks" && <TaskFilters value={filters} onChange={setFilters} members={people} types={types} />}

            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => setTool("members")} className="flex -space-x-2" title="Members">
                {people.slice(0, 5).map((m) => (
                  <span key={m.id} title={m.full_name} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted text-[10px] font-semibold">
                    {m.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                      : initials(m.full_name)}
                  </span>
                ))}
                {people.length > 5 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px]">+{people.length - 5}</span>}
              </button>
              {canManage && (
                <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setEditOpen(true)}>
                  <FontAwesomeIcon icon={faPen} className="mr-1.5 h-3 w-3" />Edit team
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mobile tool switcher */}
        <div className="flex gap-1 border-b px-3 py-2 md:hidden">
          {TOOLS.map((t) => <button key={t.id} onClick={() => setTool(t.id)} className={cn("rounded-full px-3 py-1 text-xs", tool === t.id ? "bg-muted font-medium" : "text-muted-foreground")}>{t.label}</button>)}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tool === "tasks" && view === "kanban" && (
            <BordioKanban
              columns={COLUMNS}
              columnOf={(t) => t.status}
              tasks={visible}
              onMove={(t, col) => updateTask(t.id, { status: col.status_key })}
              onOpen={openTask}
              onToggleDone={(t) => updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })}
              onAdd={(col) => openQuickAdd({ status: col.status_key, team_id: teamId })}
            />
          )}
          {tool === "tasks" && view === "table" && (
            <BordioTable tasks={visible} onOpen={openTask} onCreate={() => openQuickAdd({ team_id: teamId })} />
          )}
          {tool === "calendar" && <WeeklyPlanner teamId={teamId} title={team.name} />}
          {tool === "members" && (
            <div className="max-w-5xl">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2.5 font-semibold text-foreground">Active users <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{teamMembers?.length ?? people.length}</span></th>
                    <th className="py-2.5 font-normal">Email</th>
                    <th className="py-2.5 font-normal">Role</th>
                    <th className="py-2.5 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(teamMembers ?? []).map((m) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold">
                            {m.avatar_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                              : initials(m.full_name)}
                          </span>{m.full_name}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{m.email ?? "—"}</td>
                      <td className="py-2.5">{ROLE_LABEL[m.role] ?? m.role}</td>
                      <td className="py-2.5"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamMembers === null && <div className="flex justify-center py-10"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>}
              {teamMembers?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No one is in this team yet.</p>}
              {canManage && <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditOpen(true)}><FontAwesomeIcon icon={faPen} className="mr-1.5 h-3 w-3" />Add or remove members</Button>}
            </div>
          )}
        </div>
      </div>

      <TeamDialog
        open={editOpen} team={team} members={members}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); refreshTeams(); loadMembers(); }}
        onDeleted={() => { setEditOpen(false); refreshTeams(); toast.success("Team deleted"); router.push("/dashboard/actions/teams"); }}
      />
    </div>
  );
}
