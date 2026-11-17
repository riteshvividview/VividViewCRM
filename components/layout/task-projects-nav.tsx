"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "@/components/shared/fa-icons";
import { cn } from "@/lib/utils";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { LISTS_EVENT, currentLists, type SharedLists } from "@/modules/tasks/lib/shared-lists";

interface ProjectLink { id: string; name: string; color?: string | null }

/** "Brands" list in the main sidebar of the Tasks app. Only the CEO and team leads can add one. */
export function TaskProjectsNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectLink[]>(() => currentLists().projects ?? []);
  const [open, setOpen] = useState(true);
  const role = useShellProfile()?.role;
  const canCreate = role === "super_admin" || role === "team_lead";

  // The Tasks app shares its brand list (kept live); fetch only if it never arrives.
  useEffect(() => {
    let heard = !!currentLists().projects;
    const on = (e: Event) => { const l = (e as CustomEvent<SharedLists>).detail; if (l.projects) { heard = true; setProjects(l.projects); } };
    window.addEventListener(LISTS_EVENT, on);
    const t = setTimeout(() => {
      if (!heard) fetch("/api/tasks/projects").then((r) => (r.ok ? r.json() : { projects: [] })).then((j) => setProjects(j.projects ?? [])).catch(() => {});
    }, 1500);
    return () => { clearTimeout(t); window.removeEventListener(LISTS_EVENT, on); };
  }, []);

  if (collapsed) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-3 py-1">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground">
          <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />Brands
        </button>
        {canCreate && <Link href="/dashboard/actions/brands?new=1" title="New brand" className="text-muted-foreground/70 hover:text-foreground"><Plus className="h-3.5 w-3.5" /></Link>}
      </div>
      {open && (
        <div className="space-y-0.5">
          {projects.map((p) => {
            const active = pathname === `/dashboard/actions/brands/${p.id}`;
            return (
              <Link key={p.id} href={`/dashboard/actions/brands/${p.id}`}
                className={cn("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-slate-100 font-medium text-foreground dark:bg-slate-800" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                <span className="truncate">{p.name}</span>
              </Link>
            );
          })}
          {projects.length === 0 && <p className="px-3 py-1 text-xs text-muted-foreground">No brands yet</p>}
        </div>
      )}
    </div>
  );
}
