"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "@/components/shared/fa-icons";
import { cn } from "@/lib/utils";

interface TeamLink { id: string; name: string; color: string | null; member_ids: string[] }

/**
 * "Teams" list in the main sidebar of the Tasks app. The CEO and team leads see
 * every team and can add one; everyone else sees the teams they belong to.
 */
export function TaskTeamsNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [teams, setTeams] = useState<TeamLink[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/tasks/teams").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setTeams(j.teams ?? []); setCanManage(!!j.can_manage); } }).catch(() => {});
    };
    load();
    window.addEventListener("tasks:changed", load);
    return () => window.removeEventListener("tasks:changed", load);
  }, [pathname]);

  if (collapsed) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-3 py-1">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground">
          <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />Teams
        </button>
        {canManage && <Link href="/dashboard/actions/teams?new=1" title="New team" className="text-muted-foreground/70 hover:text-foreground"><Plus className="h-3.5 w-3.5" /></Link>}
      </div>
      {open && (
        <div className="space-y-0.5">
          {teams.map((t) => {
            const active = pathname === `/dashboard/actions/teams/${t.id}`;
            return (
              <Link key={t.id} href={`/dashboard/actions/teams/${t.id}`}
                className={cn("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-slate-100 font-medium text-foreground dark:bg-slate-800" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}>
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: t.color ?? "#6366f1" }} />
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-[11px] text-muted-foreground">{t.member_ids.length}</span>
              </Link>
            );
          })}
          {teams.length === 0 && <p className="px-3 py-1 text-xs text-muted-foreground">{canManage ? "No teams yet" : "You are not in a team yet"}</p>}
        </div>
      )}
    </div>
  );
}
