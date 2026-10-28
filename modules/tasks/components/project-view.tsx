"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCheck, faCalendar, faNoteSticky, faUser } from "@fortawesome/free-regular-svg-icons";
import {
  faPlus, faCheck, faTableList, faTableColumns, faEllipsis, faChevronLeft, faChevronRight, faPen, faBoxArchive, faTrashCan, faSpinner, faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTasksContext } from "../context/tasks-context";
import { BordioKanban, type KanbanColumn } from "./bordio-kanban";
import { BordioTable } from "./bordio-table";
import { ProjectNotes } from "./project-notes";
import { WeeklyPlanner } from "./weekly-planner";
import { TaskFilters, applyTaskFilters, EMPTY_FILTERS, type TaskFilterState } from "./task-filters";
import { AssigneePicker } from "./assignee-picker";
import { StatusIcon } from "./task-icons";
import type { BoardColumn, TaskMember, TaskStatus } from "../types";
import { STATUS_CONFIG, TASK_COLORS } from "../types";
import { initials } from "../lib/bordio";
import { cn } from "@/lib/utils";

type Tool = "tasks" | "calendar" | "notes" | "members";
interface ProjectInfo { id: string; name: string; description: string | null; color: string | null; archived_at: string | null; owner_id: string | null; key: string | null }
interface ProjectMember extends TaskMember { role: "owner" | "admin" | "member"; email: string | null }

const TOOLS: { id: Tool; label: string; icon: typeof faSquareCheck }[] = [
  { id: "tasks", label: "Tasks", icon: faSquareCheck },
  { id: "calendar", label: "Calendar", icon: faCalendar },
  { id: "notes", label: "Notes", icon: faNoteSticky },
  { id: "members", label: "Members", icon: faUser },
];

const ROLE_LABEL = { owner: "Project owner", admin: "Project admin", member: "Project member" } as const;

export function ProjectView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { tasks, members, teams, types, refreshProjects, refreshTasks, openQuickAdd, openTask, updateTask } = useTasksContext();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>((search.get("tool") as Tool) || "tasks");
  const [view, setView] = useState<"table" | "kanban">(search.get("view") === "table" ? "table" : "kanban");
  const [showTools, setShowTools] = useState(true);
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
  const [editOpen, setEditOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/projects/${projectId}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not load project"); return; }
    setProject(json.project);
    setColumns(json.columns ?? []);
    setProjectMembers(json.members ?? []);
    setCanManage(!!json.can_manage);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // Keep tool/view in the URL (shareable, survives refresh)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    qs.set("tool", tool); if (tool === "tasks") qs.set("view", view); else qs.delete("view");
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [tool, view]);

  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === projectId), [tasks, projectId]);
  const visible = useMemo(() => applyTaskFilters(projectTasks, filters), [projectTasks, filters]);

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(`/api/tasks/projects/${projectId}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error ?? "Failed"); return null; }
    return json;
  }
  const colRun = async (path: string, method: string, body?: unknown) => { if (await api(`/columns${path}`, method, body)) { load(); refreshTasks(); } };

  if (error) return <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>;
  if (!project) return <div className="flex justify-center py-24"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>;

  const kanbanColumns: KanbanColumn[] = columns.map((c, i) => ({
    id: c.id, name: c.name, status_key: c.status_key,
    menu: canManage ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className="rounded p-1 text-muted-foreground hover:bg-muted"><FontAwesomeIcon icon={faEllipsis} className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => { const n = window.prompt("Rename status", c.name); if (n?.trim()) colRun("", "PATCH", { id: c.id, name: n.trim() }); }}><FontAwesomeIcon icon={faPen} className="mr-2 h-3 w-3" />Rename</DropdownMenuItem>
          <DropdownMenuItem disabled={i === 0} onSelect={() => { const o = columns.map((x) => x.id); [o[i - 1], o[i]] = [o[i], o[i - 1]]; colRun("", "PATCH", { order: o }); }}><FontAwesomeIcon icon={faChevronLeft} className="mr-2 h-3 w-3" />Move left</DropdownMenuItem>
          <DropdownMenuItem disabled={i === columns.length - 1} onSelect={() => { const o = columns.map((x) => x.id); [o[i + 1], o[i]] = [o[i], o[i + 1]]; colRun("", "PATCH", { order: o }); }}><FontAwesomeIcon icon={faChevronRight} className="mr-2 h-3 w-3" />Move right</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Counts as</DropdownMenuLabel>
          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((k) => (
            <DropdownMenuItem key={k} onSelect={() => colRun("", "PATCH", { id: c.id, status_key: k })}>
              <StatusIcon status={k} className="mr-2" />{STATUS_CONFIG[k].label}
              {c.status_key === k && <FontAwesomeIcon icon={faCheck} className="ml-auto h-3 w-3" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:text-red-600" disabled={columns.length <= 1}
            onSelect={() => window.confirm(`Delete "${c.name}"? Its tasks move to another status.`) && colRun(`?column_id=${c.id}`, "DELETE")}>
            <FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3 w-3" />Delete status
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : undefined,
  }));

  const firstCol = columns[0];

  return (
    <div className="-m-3 flex h-[calc(100vh-3.5rem)] sm:-m-6">
      {/* Tools */}
      {showTools ? (
        <nav className="hidden w-[190px] shrink-0 flex-col border-r bg-muted/20 px-3 py-4 md:flex">
          <p className="mb-2 px-2 text-[13px] font-semibold">Tools</p>
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={cn("mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors", tool === t.id ? "bg-muted font-medium text-sky-500" : "text-foreground/85 hover:bg-muted/60")}>
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
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <Button className="h-9 rounded-full bg-sky-500 px-4 text-white hover:bg-sky-600" onClick={() => openQuickAdd({ project_id: projectId, board_column_id: firstCol?.id })}>
            <FontAwesomeIcon icon={faPlus} className="mr-1.5 h-3.5 w-3.5" />Add new
          </Button>
          {tool === "tasks" && (
            <div className="flex rounded-full bg-muted p-1">
              {([["table", "Table view", faTableList], ["kanban", "Kanban board", faTableColumns]] as const).map(([v, label, icon]) => (
                <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          )}
          {tool === "tasks" && <TaskFilters value={filters} onChange={setFilters} members={projectMembers.length ? projectMembers : members} types={types} />}

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm font-semibold md:inline" title={project.name}>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color ?? "#6366f1" }} />{project.name}
            </span>
            <button onClick={() => setTool("members")} className="flex -space-x-2" title="Members">
              {projectMembers.slice(0, 5).map((m) => (
                <span key={m.id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold">{initials(m.full_name)}</span>
              ))}
              {projectMembers.length > 5 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px]">+{projectMembers.length - 5}</span>}
            </button>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"><FontAwesomeIcon icon={faEllipsis} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}><FontAwesomeIcon icon={faPen} className="mr-2 h-3 w-3" />Edit project</DropdownMenuItem>
                  <DropdownMenuItem onSelect={async () => { if (await api("", "PATCH", { archived: !project.archived_at })) { load(); refreshProjects(); toast.success(project.archived_at ? "Project restored" : "Project archived"); } }}>
                    <FontAwesomeIcon icon={faBoxArchive} className="mr-2 h-3 w-3" />{project.archived_at ? "Restore project" : "Archive project"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={async () => {
                    if (!window.confirm(`Delete "${project.name}"? Tasks are kept but removed from the project.`)) return;
                    if (await api("", "DELETE")) { await Promise.all([refreshProjects(), refreshTasks()]); router.push("/dashboard/actions/projects"); }
                  }}><FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3 w-3" />Delete project</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Mobile tool switcher */}
        <div className="flex gap-1 border-b px-3 py-2 md:hidden">
          {TOOLS.map((t) => <button key={t.id} onClick={() => setTool(t.id)} className={cn("rounded-full px-3 py-1 text-xs", tool === t.id ? "bg-muted font-medium" : "text-muted-foreground")}>{t.label}</button>)}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tool === "tasks" && view === "kanban" && (
            <BordioKanban
              columns={kanbanColumns}
              columnOf={(t) => (columns.some((c) => c.id === t.board_column_id) ? t.board_column_id! : columns.find((c) => c.status_key === t.status)?.id ?? firstCol?.id ?? "")}
              tasks={visible}
              onMove={(t, col) => updateTask(t.id, { board_column_id: col.id })}
              onOpen={openTask}
              onToggleDone={(t) => updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })}
              onAdd={(col) => openQuickAdd({ project_id: projectId, board_column_id: col.id })}
              trailing={canManage ? (
                <div className="w-56 shrink-0 px-3 pt-2.5">
                  <Input placeholder="+ Add status" className="h-9" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newStatus.trim()) { colRun("", "POST", { name: newStatus.trim(), status_key: "in_progress" }); setNewStatus(""); } }} />
                </div>
              ) : undefined}
            />
          )}
          {tool === "tasks" && view === "table" && (
            <BordioTable tasks={visible} columns={columns} onOpen={openTask} onCreate={() => openQuickAdd({ project_id: projectId, board_column_id: firstCol?.id })} />
          )}
          {tool === "calendar" && <WeeklyPlanner projectId={projectId} title={project.name} />}
          {tool === "notes" && <ProjectNotes projectId={projectId} />}
          {tool === "members" && (
            <MembersTool
              members={projectMembers} canManage={canManage} workspaceMembers={members} teams={teams}
              onAdd={async (ids) => { if (await api("/members", "POST", { user_ids: ids })) load(); }}
              onRemove={async (id) => { if (await api(`/members?user_id=${id}`, "DELETE")) load(); }}
              onRole={async (id, role) => { if (await api("/members", "PATCH", { user_id: id, role })) load(); }}
            />
          )}
        </div>
      </div>

      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project}
        onSave={async (b) => { if (await api("", "PATCH", b)) { setEditOpen(false); load(); refreshProjects(); refreshTasks(); toast.success("Project updated"); } }} />
    </div>
  );
}

function MembersTool({ members, canManage, workspaceMembers, teams, onAdd, onRemove, onRole }: {
  members: ProjectMember[]; canManage: boolean; workspaceMembers: TaskMember[]; teams: { id: string; name: string; member_ids: string[] }[];
  onAdd: (ids: string[]) => void; onRemove: (id: string) => void; onRole: (id: string, role: "admin" | "member") => void;
}) {
  const sorted = [...members].sort((a, b) => ["owner", "admin", "member"].indexOf(a.role) - ["owner", "admin", "member"].indexOf(b.role) || a.full_name.localeCompare(b.full_name));
  return (
    <div className="max-w-5xl">
      {canManage && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">Invite to project</span>
          <AssigneePicker value={[]} members={workspaceMembers.filter((m) => !members.some((p) => p.id === m.id))} teams={teams}
            onAddUsers={onAdd} onAddTeam={(tid) => onAdd(teams.find((t) => t.id === tid)?.member_ids ?? [])} onRemove={() => {}} />
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2.5 font-semibold text-foreground">Active users <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{members.length}</span></th>
            <th className="py-2.5 font-normal">Email</th>
            <th className="py-2.5 font-normal">Role in project</th>
            <th className="py-2.5 font-normal">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.id} className="group border-b border-border/60">
              <td className="py-2.5">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{initials(m.full_name)}</span>{m.full_name}
                </span>
              </td>
              <td className="py-2.5 text-muted-foreground">{m.email ?? "—"}</td>
              <td className="py-2.5">
                {canManage && m.role !== "owner" ? (
                  <select value={m.role} onChange={(e) => onRole(m.id, e.target.value as "admin" | "member")} className="rounded bg-transparent py-1 hover:bg-muted focus:outline-none">
                    <option value="member">Project member</option>
                    <option value="admin">Project admin</option>
                  </select>
                ) : ROLE_LABEL[m.role]}
              </td>
              <td className="py-2.5"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Active</span></td>
              <td className="py-2.5 text-right">
                {canManage && m.role !== "owner" && (
                  <button className="opacity-0 group-hover:opacity-70" onClick={() => window.confirm(`Remove ${m.full_name} from the project?`) && onRemove(m.id)} aria-label="Remove">
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditProjectDialog({ open, onOpenChange, project, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; project: ProjectInfo; onSave: (b: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color ?? "#6366f1");
  useEffect(() => { if (open) { setName(project.name); setKey(project.key ?? ""); setDescription(project.description ?? ""); setColor(project.color ?? "#6366f1"); } }, [open, project]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
            <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))} placeholder="KEY" className="w-24 font-mono" title="Task key prefix, e.g. DES" />
          </div>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <div className="flex gap-1.5">
            {TASK_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} aria-label={c} />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || key.length < 2} onClick={() => onSave({ name: name.trim(), key, description: description.trim(), color })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
