"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, CalendarDays, FolderKanban, Users, Plus } from "lucide-react";
import { useTasksContext } from "../context/tasks-context";
import { cn } from "@/lib/utils";

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          : "text-foreground/80 hover:bg-muted/60"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionHeader({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
    >
      {label}
    </Link>
  );
}

export function TasksSidebar() {
  const pathname = usePathname();
  const { projects, teams } = useTasksContext();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 pr-4 border-r border-border/60 gap-5">
      {/* My work */}
      <div>
        <SectionHeader href="/dashboard/actions" label="My work" />
        <div className="space-y-0.5">
          <NavLink href="/dashboard/actions" icon={ListTodo} label="Tasks" active={pathname === "/dashboard/actions"} />
          <NavLink href="/dashboard/actions/calendar" icon={CalendarDays} label="Calendar" active={pathname === "/dashboard/actions/calendar"} />
        </div>
      </div>

      {/* All projects */}
      <div>
        <div className="flex items-center justify-between px-2.5 mb-1">
          <Link
            href="/dashboard/actions/projects"
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            All projects
          </Link>
          <Link href="/dashboard/actions/projects" className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <Plus className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-0.5">
          {projects.slice(0, 8).map((p) => (
            <NavLink
              key={p.id}
              href={`/dashboard/actions/projects/${p.id}`}
              icon={FolderKanban}
              label={p.name}
              active={pathname === `/dashboard/actions/projects/${p.id}`}
            />
          ))}
          {projects.length === 0 && (
            <p className="px-2.5 text-xs text-muted-foreground">No projects yet</p>
          )}
        </div>
      </div>

      {/* Teams */}
      <div>
        <SectionHeader href="/dashboard/actions/teams" label="Teams" />
        <div className="space-y-0.5">
          {teams.slice(0, 8).map((t) => (
            <NavLink
              key={t.id}
              href={`/dashboard/actions/teams/${t.id}`}
              icon={Users}
              label={t.name}
              active={pathname === `/dashboard/actions/teams/${t.id}`}
            />
          ))}
          {teams.length === 0 && (
            <p className="px-2.5 text-xs text-muted-foreground">No teams yet</p>
          )}
        </div>
      </div>
    </aside>
  );
}
