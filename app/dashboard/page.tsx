export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppLauncher } from "./_components/app-launcher";
import { SuperAdminDashboard } from "./_components/super-admin-dashboard";

// /dashboard is the app launcher: every user picks HRMS, Tasks, CRM… from here.
// Super admins additionally get the cross-module overview underneath.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-10">
      <AppLauncher />
      {profile?.role === "super_admin" && <SuperAdminDashboard />}
    </div>
  );
}
