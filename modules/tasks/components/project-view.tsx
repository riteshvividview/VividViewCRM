"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, KanbanSquare, List, FileText, MessageSquare, Users, MoreHorizontal, Pencil, Trash2, Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTasksContext } from "../context/tasks-context";
import { ProjectBoard } from "./project-board";
import { ProjectNotes } from "./project-notes";
import { ProjectChat } from "./project-chat";
import { TaskWorkspace } from "./task-workspace";
import { AssigneeAvatar, AssigneePicker } from "./assignee-picker";
import type { BoardColumn, TaskMember } from "../types";
import { TASK_COLORS } from "../types";
import { cn } from "@/lib/utils";

type Tab = "board" | "list" | "notes" | "chat" | "members";
interface ProjectInfo { id: string; name: string; description: string | null; color: string | null; archived_at: string | null; owner_id: string | null }
interface ProjectMember extends TaskMember { role: "owner" | "member" }

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "list", label: "List", icon: List },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "members", label: "Members", icon: Users },
];

export function ProjectView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { tasks, members, teams, refreshProjects, refreshTasks, openQuickAdd } = useTasksContext();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [editOpen, setEditOpen] = useState(false);

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

  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === projectId), [tasks, projectId]);
  const done = projectTasks.filter((t) => t.status === "done").length;

  async function patch(body: Record<string, unknown>, ok?: string) {
    const res = await fetch(`/api/tasks/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed"); return false; }
    setProject(json.project);
    refreshProjects();
    if (ok) toast.success(ok);
    return true;
  }

  async function remove() {
    if (!window.confirm(`Delete "${project?.name}"? Its tasks are kept but removed from the project. This cannot be undone.`)) return;
    const res = await fetch(`/api/tasks/projects/${projectId}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Failed"); return; }
    toast.success("Project deleted");
    await Promise.all([refreshProjects(), refreshTasks()]);
    router.push("/dashboard/actions/projects");
  }

  async function addMembers(ids: string[]) {
    const res = await fetch(`/api/tasks/projects/${projectId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_ids: ids }) });
    if (!res.ok) { toast.error((await res.json()).error ?? "Failed"); return; }
    load();
  }

  async function removeMember(id: string) {
    const res = await fetch(`/api/tasks/projects/${projectId}/members?user_id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Failed"); return; }
    load();
  }

  if (error) return <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>;
  if (!project) return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-1.5 h-4 w-4 shrink-0 rounded" style={{ backgroundColor: project.color ?? "#6366f1" }} />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {project.name}
            {project.archived_at && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Archived</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project.description || "No description"} · {projectTasks.length} tasks · {done} done
          </p>
          {projectTasks.length > 0 && (
            <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-emerald-500" style={{ width: `${(done / projectTasks.length) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex -space-x-1.5">
            {projectMembers.slice(0, 5).map((m) => <AssigneeAvatar key={m.id} member={m} />)}
          </div>
          <Button size="sm" onClick={() => openQuickAdd({ project_id: projectId })}><Plus className="h-4 w-4 mr-1.5" />Task</Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit project</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => patch({ archived: !project.archived_at }, project.archived_at ? "Project restored" : "Project archived")}>
                  <Archive className="h-3.5 w-3.5 mr-2" />{project.archived_at ? "Restore" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={remove}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete project</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.id === "members" && <span className="text-xs text-muted-foreground">{projectMembers.length}</span>}
          </button>
        ))}
      </div>

      {tab === "board" && <ProjectBoard projectId={projectId} columns={columns} tasks={projectTasks} onColumnsChange={() => { load(); refreshTasks(); }} />}
      {tab === "list" && <TaskWorkspace tasks={projectTasks} defaultView="table" />}
      {tab === "notes" && <ProjectNotes projectId={projectId} />}
      {tab === "chat" && <ProjectChat projectId={projectId} members={members} canModerate={canManage} />}
      {tab === "members" && (
        <div className="max-w-2xl space-y-3">
          {canManage && (
            <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <span className="text-sm text-muted-foreground">Add people</span>
              <AssigneePicker
                value={[]} members={members.filter((m) => !projectMembers.some((p) => p.id === m.id))} teams={teams}
                onAddUsers={addMembers}
                onAddTeam={(tid) => addMembers(teams.find((t) => t.id === tid)?.member_ids ?? [])}
                onRemove={() => {}}
              />
            </div>
          )}
          <div className="divide-y rounded-xl border bg-card">
            {projectMembers.map((m) => {
              const open = projectTasks.filter((t) => t.status !== "done" && t.assignees.some((a) => a.id === m.id)).length;
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <AssigneeAvatar member={m} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role} · {open} open task{open === 1 ? "" : "s"}</p>
                  </div>
                  {canManage && m.role !== "owner" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)} aria-label="Remove member"><X className="h-4 w-4" /></Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} onSave={(b) => patch(b, "Project updated").then((ok) => ok && setEditOpen(false))} />
    </div>
  );
}

function EditProjectDialog({ open, onOpenChange, project, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; project: ProjectInfo; onSave: (b: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color ?? "#6366f1");
  useEffect(() => { if (open) { setName(project.name); setDescription(project.description ?? ""); setColor(project.color ?? "#6366f1"); } }, [open, project]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <div className="flex gap-1.5">
            {TASK_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }}>
                {color === c && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), description: description.trim(), color })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
