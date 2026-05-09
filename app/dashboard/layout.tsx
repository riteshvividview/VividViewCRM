export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import type { Profile } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // When Supabase is not yet configured, render with no profile (dev mode)
  if (!supabaseUrl || !supabaseKey) {
    const devProfile: Profile = {
      id: "dev",
      user_id: "dev",
      full_name: "Dev User",
      avatar_url: null,
      role: "admin",
      email: "dev@vividview.co",
      created_at: new Date().toISOString(),
      workspace_id: null,
    };
    return <Shell profile={devProfile}>{children}</Shell>;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const profileWithEmail: Profile | null = profile
    ? { ...profile, email: user.email ?? "" }
    : null;

  return <Shell profile={profileWithEmail}>{children}</Shell>;
}
