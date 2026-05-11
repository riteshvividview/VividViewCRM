"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Moon, Sun, LogOut, User, Settings, ChevronRight, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import type { Profile } from "@/types";
import { NAV_GROUPS } from "./nav-config";
import Link from "next/link";

interface TopbarProps {
  profile: Profile | null;
  onMenuOpen?: () => void;
}

function useBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += "/" + seg;
    const navItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === path);
    crumbs.push({ label: navItem?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "), href: path });
  }
  return crumbs;
}

export function Topbar({ profile, onMenuOpen }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const crumbs = useBreadcrumb();

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
      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0 overflow-hidden">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
            <Link
              href={crumb.href}
              className={
                i === crumbs.length - 1
                  ? "font-semibold text-foreground truncate"
                  : "hover:text-foreground transition-colors truncate hidden sm:block"
              }
            >
              {crumb.label}
            </Link>
          </span>
        ))}
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
