"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Users, CircleCheck, Handshake, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { useShellProfile, useAllowedModuleIds } from "@/lib/supabase/profile-context";
import { getAllowedApps, getAppHome, type AppId, type ModuleId } from "@/lib/rbac/modules";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = { Users, CircleCheck, Handshake, Receipt, ShieldCheck };

// Per-app visual identity: glow colour and a few headline features shown on the card.
const STYLE: Record<AppId, { glow: string; ring: string; chips: string[] }> = {
  hrms:    { glow: "bg-purple-500/25",  ring: "group-hover:ring-purple-500/40",  chips: ["Attendance", "Leave", "Payroll", "Performance"] },
  tasks:   { glow: "bg-blue-500/25",    ring: "group-hover:ring-blue-500/40",    chips: ["Boards", "Calendar", "Projects", "Teams"] },
  crm:     { glow: "bg-emerald-500/25", ring: "group-hover:ring-emerald-500/40", chips: ["Leads", "Deals", "Contacts", "Campaigns"] },
  finance: { glow: "bg-amber-500/25",   ring: "group-hover:ring-amber-500/40",   chips: ["Invoices", "Payments", "Settings"] },
  admin:   { glow: "bg-slate-500/25",   ring: "group-hover:ring-slate-500/40",   chips: ["Users", "Roles", "Reports"] },
};

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
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-800 px-6 py-8 sm:px-10 sm:py-10 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur" suppressHydrationWarning>
            <Sparkles className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight" suppressHydrationWarning>
            {greeting()}, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-sm sm:text-base text-white/75">
            Your workspace in one place. Pick an app to jump in. You can switch apps anytime from the sidebar.
          </p>
        </div>
      </section>

      {/* Apps */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your apps</h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app, i) => {
            const Icon = ICONS[app.icon] ?? Users;
            const style = STYLE[app.id];
            const href = getAppHome(app.id, allowed) ?? "/dashboard";
            return (
              <Link
                key={app.id}
                href={href}
                style={{ animationDelay: `${i * 70}ms` }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-card p-6 ring-1 ring-transparent",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in [animation-fill-mode:both]",
                  style.ring,
                )}
              >
                {/* Colour glow that brightens on hover */}
                <div className={cn("pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-60 transition-opacity duration-300 group-hover:opacity-100", style.glow)} />

                <div className="relative flex items-start justify-between">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110", app.accent)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background/60 text-muted-foreground transition-all duration-300 group-hover:bg-foreground group-hover:text-background">
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                  </span>
                </div>

                <h3 className="relative mt-5 text-lg font-semibold">{app.label}</h3>
                <p className="relative mt-1 text-sm text-muted-foreground">{app.description}</p>

                <div className="relative mt-5 flex flex-wrap gap-1.5">
                  {style.chips.map((c) => (
                    <span key={c} className="rounded-full border bg-background/70 px-2.5 py-0.5 text-xs text-muted-foreground">{c}</span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
