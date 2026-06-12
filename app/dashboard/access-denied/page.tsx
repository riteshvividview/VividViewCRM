"use client";

import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShellProfile } from "@/lib/supabase/profile-context";

const ROLE_HOME: Record<string, string> = {
  super_admin: "/dashboard",
  hr:          "/dashboard/hrms",
  team_lead:   "/dashboard/actions",
  employee:    "/dashboard/actions",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  hr:          "HR",
  team_lead:   "Team Lead",
  employee:    "Employee",
};

export default function AccessDeniedPage() {
  const profile = useShellProfile();
  const role = profile?.role ?? "employee";
  const home = ROLE_HOME[role] ?? "/dashboard/actions";
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
        <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-4">
        You don&apos;t have permission to view this page. Contact your administrator if you think this is a mistake.
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground mb-8">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Your role: <strong className="text-foreground">{roleLabel}</strong>
      </div>

      <Button asChild className="gap-2 bg-purple-700 hover:bg-purple-800 text-white">
        <Link href={home}>
          <ArrowLeft className="h-4 w-4" />
          Back to my dashboard
        </Link>
      </Button>
    </div>
  );
}
