"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import { AssigneePicker } from "@/modules/tasks/components/assignee-picker";
import { TASK_COLORS, type TaskMember } from "@/modules/tasks/types";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const { tasks, projects, members, teams, refreshProjects, currentUserId } = useTasksContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(TASK_COLORS[6]);
  const [team, setTeam] = useState<TaskMember[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tasks/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color, member_ids: team.map((m) => m.id) }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Could not create project"); return; }
    await refreshProjects();
    setOpen(false);
    setName(""); setDescription(""); setTeam([]);
    router.push(`/dashboard/actions/projects/${json.project.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description={`${projects.length} active project${projects.length !== 1 ? "s" : ""}`}
        action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New project</Button>}
      />

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground">Create a project to get a board with your own statuses, notes and chat.</p>
          <Button className="mt-4" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New project</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const list = tasks.filter((t) => t.project_id === p.id);
            const done = list.filter((t) => t.status === "done").length;
            const people = new Map(list.flatMap((t) => t.assignees).map((a) => [a.id, a]));
            const pct = list.length ? Math.round((done / list.length) * 100) : 0;
            return (
              <Link key={p.id} href={`/dashboard/actions/projects/${p.id}`}
                className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: p.color ?? "#6366f1" }}>
                    <FolderKanban className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{list.length - done} open · {done} done</p>
                  </div>
                </div>
                {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color ?? "#6366f1" }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{people.size} people working on it</p>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            <Textarea rows={2} placeholder="What is this project about? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-1.5">
              {TASK_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Members</span>
              <AssigneePicker
                value={team} members={members.filter((m) => m.id !== currentUserId)} teams={teams}
                onAddUsers={(ids) => setTeam((t) => [...t, ...members.filter((m) => ids.includes(m.id) && !t.some((x) => x.id === m.id))])}
                onAddTeam={(tid) => { const tm = teams.find((x) => x.id === tid); if (tm) setTeam((t) => [...t, ...members.filter((m) => tm.member_ids.includes(m.id) && m.id !== currentUserId && !t.some((x) => x.id === m.id))]); }}
                onRemove={(id) => setTeam((t) => t.filter((m) => m.id !== id))}
              />
            </div>
            <p className="text-xs text-muted-foreground">You&apos;ll be the owner. A board with To do · In progress · Waiting · Done is created; rename or add statuses anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Create project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
