import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { MODULES, getEffectiveModules, type ModuleId, type ModuleOverride } from "@/lib/rbac/modules";
import type { UserRole } from "@/types";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verifySuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const supabaseAdmin = adminClient();
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("user_id", user.id).single();
  return data?.role === "super_admin";
}

// GET — return current effective modules for a user with override status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifySuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabaseAdmin = adminClient();

  const [profileResult, overridesResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("role").eq("user_id", id).single(),
    supabaseAdmin.from("profile_modules").select("module_id, granted").eq("user_id", id),
  ]);

  const role = (profileResult.data?.role ?? "employee") as UserRole;
  const overrides = (overridesResult.data ?? []) as ModuleOverride[];
  const effectiveModules = getEffectiveModules(role, overrides);

  const result = MODULES.map((m) => ({
    module_id: m.id,
    label: m.label,
    group: m.group,
    isDefault: m.defaultRoles.includes(role),
    isGranted: effectiveModules.has(m.id),
    hasOverride: overrides.some((o) => o.module_id === m.id),
  }));

  return NextResponse.json({ role, modules: result });
}

// PUT — save per-user module overrides
// Body: { moduleIds: string[] } — the desired final list of allowed module IDs
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifySuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const desiredModuleIds: ModuleId[] = body.moduleIds ?? [];

  const supabaseAdmin = adminClient();
  const { data: profileData } = await supabaseAdmin
    .from("profiles").select("role").eq("user_id", id).single();
  const role = (profileData?.role ?? "employee") as UserRole;

  const defaultModules = new Set<ModuleId>(
    MODULES.filter((m) => m.defaultRoles.includes(role)).map((m) => m.id)
  );
  const desiredSet = new Set<ModuleId>(desiredModuleIds);

  // Compute overrides: only store differences from role defaults
  const overridesToUpsert: { user_id: string; module_id: string; granted: boolean }[] = [];

  for (const mod of MODULES) {
    const isDefault = defaultModules.has(mod.id);
    const isDesired = desiredSet.has(mod.id);

    if (isDefault !== isDesired) {
      // This differs from role default → store override
      overridesToUpsert.push({ user_id: id, module_id: mod.id, granted: isDesired });
    }
  }

  // Delete all existing overrides for this user, then insert new ones
  await supabaseAdmin.from("profile_modules").delete().eq("user_id", id);

  if (overridesToUpsert.length > 0) {
    const { error } = await supabaseAdmin.from("profile_modules").insert(overridesToUpsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
