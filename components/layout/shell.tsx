"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAppForPath } from "@/lib/rbac/modules";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ProfileProvider } from "@/lib/supabase/profile-context";
import { OfflineScreen } from "@/components/shared/offline-screen";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import type { ModuleId } from "@/lib/rbac/modules";

interface ShellProps {
  children: React.ReactNode;
  profile: Profile | null;
  allowedModuleIds: ModuleId[];
}

export function Shell({ children, profile, allowedModuleIds }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // The launcher and account pages share the calm neutral theme with HRMS.
  const currentApp = getAppForPath(pathname) ?? (pathname === "/dashboard" || pathname.startsWith("/dashboard/profile") ? "home" : "");

  // Expose the active app on <html> so portaled UI (dialogs, menus) picks up app theming too.
  useEffect(() => {
    document.documentElement.dataset.app = currentApp;
  }, [currentApp]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored) setCollapsed(JSON.parse(stored));
  }, []);

  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(!v));
      return !v;
    });
  }

  return (
    <ProfileProvider profile={profile} allowedModuleIds={allowedModuleIds}>
      <OfflineScreen />
      <div className="flex h-screen overflow-hidden bg-background" data-app={currentApp || undefined}>
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative z-10 flex">
              <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar profile={profile} onMenuOpen={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className={cn("animate-fade-in p-3 sm:p-6 max-w-screen-2xl mx-auto")}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
