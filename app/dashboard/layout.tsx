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
  // The sign-in token is checked locally (no request to Supabase Auth).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | undefined;

  // A saved session that no longer works has to be cleared first, or sign-in would
  // send the browser straight back here. (Switched-off accounts are caught below.)
  if (!claims?.sub) redirect("/auth/inactive?expired=1");
  const user = { id: claims.sub, email: claims.email, user_metadata: claims.user_metadata ?? {}, app_metadata: claims.app_metadata ?? {} };

  // Accounts with an authenticator app must pass the second step before anything opens.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/auth/mfa");
  // Signed in with a password the CEO set: choose your own first.
  if (user.app_metadata?.must_change_password) redirect("/auth/set-password");

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
  // Switched off by the CEO: sign out and say why.
  if (profile?.disabled) redirect("/auth/inactive");

  // Only people the CEO added have a profile; anyone else is signed out again.
  // A login with no workspace (nobody added it) is signed out again.
  if (!profile?.workspace_id) redirect("/auth/inactive?reason=no_account");

  const resolvedName = profile?.full_name?.trim() || metaName || user.email?.split("@")[0] || "User";

  if (profile && !profile.full_name?.trim() && resolvedName) {
    supabase.from("profiles").update({ full_name: resolvedName }).eq("user_id", user.id);
    profile = { ...profile, full_name: resolvedName };
  }

  const role = (profile?.role ?? "employee") as UserRole;
  const overrides = (overridesResult.data ?? []) as ModuleOverride[];
  const effectiveModules = getEffectiveModules(role, overrides);
  // The CEO decides in Task settings whether HR sees the Tasks app (default: hidden).
  if (role === "hr" && profile?.workspace_id) {
    const { data: ts } = await supabaseAdmin.from("task_settings").select("hr_access").eq("workspace_id", profile.workspace_id).maybeSingle();
    if ((ts?.hr_access ?? "hidden") === "hidden") effectiveModules.delete("tasks");
  }
  const allowedModuleIds = Array.from(effectiveModules) as ModuleId[];

  const { isDeveloper, featuresFor } = await import("@/lib/dev/server");
  const [isDev, features] = await Promise.all([isDeveloper(supabaseAdmin, user.id), featuresFor(supabaseAdmin, user.id)]);
  // The console is for its owner only; anyone else gets a plain "not found".

  // Route-level access check using x-pathname injected by middleware
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if ((pathname === "/dashboard/actions/dev" || pathname.startsWith("/dashboard/actions/dev/")) && !isDev) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
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
    is_developer: isDev,
    features,
  };

  return (
    <Shell profile={profileWithEmail} allowedModuleIds={allowedModuleIds}>
      {children}
    </Shell>
  );
}
