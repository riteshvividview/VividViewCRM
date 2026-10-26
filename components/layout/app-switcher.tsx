"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, LayoutGrid, Users, CircleCheck, Handshake, Receipt, ShieldCheck } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllowedApps, getAppHome, type AppId, type ModuleId } from "@/lib/rbac/modules";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = { Users, CircleCheck, Handshake, Receipt, ShieldCheck };

/** "⌥" on Apple devices, "Alt" elsewhere — resolved after mount to avoid hydration mismatch. */
function useAltLabel() {
  const [label, setLabel] = useState("Alt+");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setLabel("⌥");
  }, []);
  return label;
}

/**
 * Sidebar app switcher with global shortcuts:
 *   Alt+1…9  jump straight to the Nth app (launcher order)
 *   Alt+0    open the app launcher
 */
export function AppSwitcher({ currentApp, allowedModuleIds, collapsed }: {
  currentApp: AppId | null;
  allowedModuleIds: ModuleId[];
  collapsed: boolean;
}) {
  const router = useRouter();
  const alt = useAltLabel();
  const allowed = useMemo(() => new Set<ModuleId>(allowedModuleIds), [allowedModuleIds]);
  const apps = useMemo(
    () => getAllowedApps(allowed).map((a) => ({ ...a, href: getAppHome(a.id, allowed) ?? "/dashboard" })),
    [allowed],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // e.code is layout-independent (Alt+digit produces special characters on macOS).
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (!m) return;
      const n = Number(m[1]);
      const target = n === 0 ? "/dashboard" : apps[n - 1]?.href;
      if (!target) return;
      e.preventDefault();
      router.push(target);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apps, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors",
          "hover:bg-slate-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800 data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800",
          collapsed && "justify-center px-2",
        )}
        title={`Switch app (${alt}1–${apps.length})`}
      >
        <ArrowLeftRight className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Switch app</span>
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">{alt}1–{apps.length}</kbd>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Switch to</DropdownMenuLabel>
        {apps.map((app, i) => {
          const Icon = ICONS[app.icon] ?? Users;
          const active = app.id === currentApp;
          return (
            <DropdownMenuItem key={app.id} onSelect={() => router.push(app.href)} className="gap-2.5 py-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-white", app.accent)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1">{app.label}</span>
              {active ? <Check className="h-4 w-4 text-muted-foreground" /> : <DropdownMenuShortcut>{alt}{i + 1}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard")} className="gap-2.5 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border">
            <LayoutGrid className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">All apps</span>
          <DropdownMenuShortcut>{alt}0</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
