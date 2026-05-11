export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import type { Profile, UserRole } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const devProfile: Profile = {
      id: "dev", user_id: "dev", full_name: "Dev User",
      avatar_url: null, role: "admin", email: "dev@vividview.co",
      created_at: new Date().toISOString(), workspace_id: null,
    };
    return <Shell profile={devProfile}>{children}</Shell>;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Name from auth metadata is the most reliable source (set at signup)
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Auto-create profile if missing (in case trigger didn't fire)
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, full_name: metaName || user.email?.split("@")[0] || "" }, { onConflict: "user_id" })
      .select()
      .single();
    profile = created;
  }

  // Always resolve name: auth metadata → profile table → email prefix
  const resolvedName = metaName
    || profile?.full_name?.trim()
    || user.email?.split("@")[0]
    || "User";

  // Sync profile name if it's stale/empty
  if (profile && !profile.full_name?.trim() && resolvedName) {
    supabase.from("profiles").update({ full_name: resolvedName }).eq("user_id", user.id);
    profile = { ...profile, full_name: resolvedName };
  }

  const profileWithEmail: Profile = {
    id: profile?.id ?? user.id,
    user_id: user.id,
    full_name: resolvedName,
    avatar_url: profile?.avatar_url ?? null,
    role: (profile?.role ?? "content_creator") as UserRole,
    email: user.email ?? "",
    created_at: profile?.created_at ?? new Date().toISOString(),
    workspace_id: profile?.workspace_id ?? null,
  };

  return <Shell profile={profileWithEmail}>{children}</Shell>;
}
