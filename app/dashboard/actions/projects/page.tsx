"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import { cn } from "@/lib/utils";

const PROJECT_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#64748b"];

export default function ProjectsPage() {
  const { tasks, projects, refreshProjects } = useTasksContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      });
      if (res.ok) {
        await refreshProjects();
        setOpen(false);
        setName("");
        setDescription("");
        setColor(PROJECT_COLORS[0]);
      }
    } finally {
      setSaving(false);
    }
  }

  function taskCount(projectId: string) {
    return tasks.filter((t) => t.project_id === projectId).length;
  }

  return (
    <div>
      <PageHeader
        title="All Projects"
        description={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />New Project
          </Button>
        }
      />

      {projects.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No projects yet. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/actions/projects/${p.id}`}
              className="block bg-card border border-border rounded-2xl p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                <h3 className="text-sm font-semibold text-foreground truncate flex-1">{p.name}</h3>
              </div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5" />
                {taskCount(p.id)} task{taskCount(p.id) !== 1 ? "s" : ""}
                <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{p.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <div className="flex items-center gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn("w-6 h-6 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
