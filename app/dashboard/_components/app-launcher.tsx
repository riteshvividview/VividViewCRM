"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Users, CircleCheck, Handshake, Receipt, ShieldCheck } from "lucide-react";
import { useShellProfile, useAllowedModuleIds } from "@/lib/supabase/profile-context";
import { getAllowedApps, getAppHome, type ModuleId } from "@/lib/rbac/modules";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = { Users, CircleCheck, Handshake, Receipt, ShieldCheck };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function AppLauncher() {
  const profile = useShellProfile();
  const allowedModuleIds = useAllowedModuleIds();
  const allowed = useMemo(() => new Set<ModuleId>(allowedModuleIds), [allowedModuleIds]);
  const apps = useMemo(() => getAllowedApps(allowed), [allowed]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Choose an app to get started.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((app) => {
          const Icon = ICONS[app.icon] ?? Users;
          const href = getAppHome(app.id, allowed) ?? "/dashboard";
          return (
            <Link
              key={app.id}
              href={href}
              className="group rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white", app.accent)}>
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-semibold">{app.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-700 dark:text-purple-300">
                Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
