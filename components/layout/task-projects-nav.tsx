"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectLink { id: string; name: string; color: string | null }

/** Bordio-style "Projects" list in the main sidebar of the Tasks app. */
export function TaskProjectsNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectLink[]>([]);
  const [open, setOpen] = useState(true);

  // Refetch on navigation so new / renamed / archived projects show up.
  useEffect(() => {
    fetch("/api/tasks/projects").then((r) => (r.ok ? r.json() : { projects: [] })).then((j) => setProjects(j.projects ?? [])).catch(() => {});
  }, [pathname]);

  if (collapsed) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-3 py-1">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground">
          <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />Projects
        </button>
        <Link href="/dashboard/actions/projects?new=1" title="New project" className="text-muted-foreground/70 hover:text-foreground"><Plus className="h-3.5 w-3.5" /></Link>
      </div>
      {open && (
        <div className="space-y-0.5">
          {projects.map((p) => {
            const active = pathname === `/dashboard/actions/projects/${p.id}`;
            return (
              <Link key={p.id} href={`/dashboard/actions/projects/${p.id}`}
                className={cn("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-slate-100 font-medium text-foreground dark:bg-slate-800" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                <span className="truncate">{p.name}</span>
              </Link>
            );
          })}
          {projects.length === 0 && <p className="px-3 py-1 text-xs text-muted-foreground">No projects yet</p>}
        </div>
      )}
    </div>
  );
}
