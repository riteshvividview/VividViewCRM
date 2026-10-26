"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  UserRoundSearch, Handshake, Users, Building2, CircleCheck,
  Inbox, PhoneCall, Mail, Megaphone, CalendarDays, Target,
  Package, FileText, BarChart3, Puzzle, Settings2, Settings,
  ChevronLeft, ChevronRight, Home, ShieldCheck, UserRound,
  Clock, CalendarOff, Banknote, LayoutDashboard, Receipt, FilePlus,
  LayoutGrid, Laptop, Network, HandCoins, LifeBuoy, LogOut,
  Star, Award, Briefcase, ClipboardCheck, FolderKanban,
} from "lucide-react";
import { APPS, getAppForPath } from "@/lib/rbac/modules";
import { AppSwitcher } from "./app-switcher";
import { cn } from "@/lib/utils";
import { getNavGroups, type NavItem } from "./nav-config";
import { useShellProfile, useAllowedModuleIds } from "@/lib/supabase/profile-context";
import type { UserRole } from "@/types";
import type { ModuleId } from "@/lib/rbac/modules";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";
import { usePendingTaskCount } from "@/modules/tasks/hooks/use-pending-task-count";

const ICON_MAP: Record<string, React.ElementType> = {
  UserRoundSearch, Handshake, Users, Building2, CircleCheck,
  Inbox, PhoneCall, Mail, Megaphone, CalendarDays, Target,
  Package, FileText, BarChart3, Puzzle, Settings2, Settings, Home,
  ShieldCheck, UserRound, Clock, CalendarOff, Banknote, LayoutDashboard,
  Receipt, FilePlus, LayoutGrid, Laptop, Network, HandCoins, LifeBuoy, LogOut,
  Star, Award, Briefcase, ClipboardCheck, FolderKanban,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavItemRow({
  item, collapsed, active, badge,
}: {
  item: NavItem; collapsed: boolean; active: boolean; badge?: number;
}) {
  const Icon = ICON_MAP[item.icon] ?? Home;

  const inner = (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 relative",
        active
          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
        collapsed && "justify-center px-2"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-700 rounded-r-full" />
      )}
      <Icon className={cn(
        "shrink-0 h-4 w-4",
        active ? "text-purple-700 dark:text-purple-300" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300"
      )} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {badge ? (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-xs font-semibold px-1">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {badge ? <Badge variant="secondary" className="h-4 px-1 text-xs">{badge}</Badge> : null}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const profile = useShellProfile();
  const allowedModuleIds = useAllowedModuleIds();
  const pendingTaskCount = usePendingTaskCount();

  const role = (profile?.role ?? "employee") as UserRole;
  const hasTasks = allowedModuleIds.includes("tasks" as ModuleId);

  const allowedSet = useMemo(
    () => new Set<ModuleId>(allowedModuleIds),
    [allowedModuleIds]
  );
  const currentApp = getAppForPath(pathname);
  const appDef = APPS.find((a) => a.id === currentApp);
  const navGroups = useMemo(
    () => getNavGroups(allowedSet, role, currentApp),
    [allowedSet, role, currentApp]
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-16" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-14 px-4 border-b border-sidebar-border shrink-0 gap-3",
          collapsed && "justify-center px-2"
        )}>
          <div className="relative w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-violet-700 p-1">
            <Image src="/vividviewlogo.png" alt="Vivid View" fill sizes="32px" className="object-contain brightness-0 invert p-0.5" priority />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">Vivid View</p>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase leading-tight">{appDef?.label ?? "Workspace"}</p>
            </div>
          )}
        </div>

        {/* App switcher (Alt+1…9 / Alt+0 work anywhere in the dashboard) */}
        <div className="px-2 pt-2 shrink-0">
          <AppSwitcher currentApp={currentApp} allowedModuleIds={allowedModuleIds} collapsed={collapsed} />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
          {navGroups.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && <Separator className="my-2 mx-1" />}
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  badge={
                    item.id === "actions" && hasTasks && pendingTaskCount > 0
                      ? pendingTaskCount
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Toggle */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground transition-colors",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
