export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Shell } from "@/components/layout/shell";
import type { Profile, UserRole } from "@/types";
import {
  getEffectiveModules, canAccessRoute, MODULES,
  type ModuleId, type ModuleOverride,
} from "@/lib/rbac/modules";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Dev fallback: Supabase not configured
  if (!supabaseUrl || !supabaseKey) {
    const devProfile: Profile = {
      id: "dev", user_id: "dev", full_name: "Dev User",
      avatar_url: null, role: "super_admin", email: "dev@vividview.co",
      created_at: new Date().toISOString(), workspace_id: null,
    };
    const devModules = MODULES.filter((m) => m.defaultRoles.includes("super_admin")).map((m) => m.id);
    return <Shell profile={devProfile} allowedModuleIds={devModules}>{children}</Shell>;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";

  // Fetch profile and module overrides in parallel
  const { createClient: createAdminClient } = await import("@supabase/supabase-js").then(
    (m) => ({ createClient: m.createClient })
  );
  const supabaseAdmin = createAdminClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [profileResult, overridesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabaseAdmin
      .from("profile_modules")
      .select("module_id, granted")
      .eq("user_id", user.id),
  ]);

  let profile = profileResult.data;

  // Auto-create profile if missing
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, full_name: metaName || user.email?.split("@")[0] || "" }, { onConflict: "user_id" })
      .select()
      .single();
    profile = created;
  }

  const resolvedName = metaName || profile?.full_name?.trim() || user.email?.split("@")[0] || "User";

  if (profile && !profile.full_name?.trim() && resolvedName) {
    supabase.from("profiles").update({ full_name: resolvedName }).eq("user_id", user.id);
    profile = { ...profile, full_name: resolvedName };
  }

  const role = (profile?.role ?? "employee") as UserRole;
  const overrides = (overridesResult.data ?? []) as ModuleOverride[];
  const effectiveModules = getEffectiveModules(role, overrides);
  const allowedModuleIds = Array.from(effectiveModules) as ModuleId[];

  // Route-level access check using x-pathname injected by middleware
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (pathname && !canAccessRoute(effectiveModules, pathname)) {
    redirect("/dashboard/access-denied");
  }

  const profileWithEmail: Profile = {
    id: profile?.id ?? user.id,
    user_id: user.id,
    full_name: resolvedName,
    avatar_url: profile?.avatar_url ?? null,
    role,
    email: user.email ?? "",
    created_at: profile?.created_at ?? new Date().toISOString(),
    workspace_id: profile?.workspace_id ?? null,
  };

  return (
    <Shell profile={profileWithEmail} allowedModuleIds={allowedModuleIds}>
      {children}
    </Shell>
  );
}
