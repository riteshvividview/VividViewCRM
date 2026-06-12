export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminDashboard } from "./_components/super-admin-dashboard";

const ROLE_HOME: Record<string, string> = {
  hr:        "/dashboard/hrms",
  team_lead: "/dashboard/actions",
  employee:  "/dashboard/actions",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = profile?.role ?? "employee";
  const home = ROLE_HOME[role];

  if (home) redirect(home);

  return <SuperAdminDashboard />;
}
