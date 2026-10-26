"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Moon, Sun, LogOut, User, Settings, ChevronRight, Menu, LayoutGrid } from "lucide-react";
import { APPS, getAppForPath, getAppHome } from "@/lib/rbac/modules";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import type { Profile, UserRole } from "@/types";
import { getNavGroups } from "./nav-config";
import { useAllowedModuleIds } from "@/lib/supabase/profile-context";
import type { ModuleId } from "@/lib/rbac/modules";
import { useMemo } from "react";
import Link from "next/link";

interface TopbarProps {
  profile: Profile | null;
  onMenuOpen?: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Breadcrumb trail: App → page → sub-page. Labels come from the nav registry;
 * the app's home page isn't repeated and record IDs read as "Details".
 */
function useBreadcrumb(role: UserRole, allowedModuleIds: ModuleId[]) {
  const pathname = usePathname();
  const allowedSet = useMemo(() => new Set<ModuleId>(allowedModuleIds), [allowedModuleIds]);
  const navItems = useMemo(
    () => getNavGroups(allowedSet, role).flatMap((g) => g.items),
    [allowedSet, role]
  );
  const appId = getAppForPath(pathname);
  const app = APPS.find((a) => a.id === appId);
  const appHome = app ? getAppHome(app.id, allowedSet) : null;

  const crumbs: { label: string; href: string }[] = [];
  if (app && appHome) crumbs.push({ label: app.label, href: appHome });

  const segments = pathname.split("/").filter(Boolean);
  let path = "";
  for (const seg of segments) {
    path += "/" + seg;
    if (path === "/dashboard" || path === appHome) continue;
    if (appHome && appHome.startsWith(path + "/")) continue; // parent of the app home
    const navItem = navItems.find((i) => i.href === path);
    crumbs.push({
      label: navItem?.label ?? (UUID_RE.test(seg) ? "Details" : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ")),
      href: path,
    });
  }
  if (crumbs.length === 0) crumbs.push({ label: pathname === "/dashboard" ? "All apps" : "Dashboard", href: pathname });
  return crumbs;
}

export function Topbar({ profile, onMenuOpen }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const allowedModuleIds = useAllowedModuleIds();
  const crumbs = useBreadcrumb((profile?.role ?? "employee") as UserRole, allowedModuleIds);

  useEffect(() => setMounted(true), []);

  const displayName = profile?.full_name?.trim()
    || profile?.email?.split("@")[0]
    || "User";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/auth/login";
  }

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-3 sm:px-4 gap-2 sm:gap-4 shrink-0 sticky top-0 z-30">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8 shrink-0"
        onClick={onMenuOpen}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-1 min-w-0 items-center overflow-hidden">
        <ol className="flex min-w-0 items-center gap-0.5 text-sm leading-none">
          <li className="flex items-center">
            <Link
              href="/dashboard"
              title="All apps"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
            </Link>
          </li>
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={crumb.href} className={cn("flex min-w-0 items-center gap-0.5", !last && "hidden sm:flex")}>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
                {last ? (
                  <span aria-current="page" className="flex h-8 items-center truncate rounded-md px-2 font-semibold text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="flex h-8 items-center truncate rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Global search hint */}
      <button className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg px-3 py-1.5 transition-colors border border-border">
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile?.avatar_url ?? ""} />
                <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {displayName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal">{profile?.email}</span>
                {profile?.role && (
                  <span className="text-[10px] text-muted-foreground/70 font-normal capitalize">
                    {profile.role.replace("_", " ")}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
