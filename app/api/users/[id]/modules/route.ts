import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MODULES, getEffectiveModules, type ModuleId, type ModuleOverride } from "@/lib/rbac/modules";
import type { UserRole } from "@/types";
import { adminClient, forbidden, getCeo, notFound, targetProfile } from "../../_lib/access";

/** The CEO, and the target person only when they are in the CEO's workspace. */
async function access(id: string) {
  const ceo = await getCeo();
  if (!ceo) return { error: forbidden() };
  const admin = adminClient();
  const target = await targetProfile(admin, ceo, id);
  if (!target) return { error: notFound() };
  return { admin, role: (target.role ?? "employee") as UserRole };
}

// GET — return current effective modules for a user with override status
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await access(id);
  if ("error" in r) return r.error;

  const { data } = await r.admin.from("profile_modules").select("module_id, granted").eq("user_id", id);
  const overrides = (data ?? []) as ModuleOverride[];
  const effectiveModules = getEffectiveModules(r.role, overrides);

  const result = MODULES.map((m) => ({
    module_id: m.id,
    label: m.label,
    group: m.group,
    isDefault: m.defaultRoles.includes(r.role),
    isGranted: effectiveModules.has(m.id),
    hasOverride: overrides.some((o) => o.module_id === m.id),
  }));

  return NextResponse.json({ role: r.role, modules: result });
}

// PUT — save per-user module overrides
// Body: { moduleIds: string[] } — the desired final list of allowed module IDs
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await access(id);
  if ("error" in r) return r.error;
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.moduleIds)) return NextResponse.json({ error: "moduleIds must be a list" }, { status: 400 });
  const known = new Set<string>(MODULES.map((m) => m.id));
  const desiredSet = new Set<ModuleId>((body.moduleIds as string[]).filter((m) => known.has(m)) as ModuleId[]);

  const defaultModules = new Set<ModuleId>(MODULES.filter((m) => m.defaultRoles.includes(r.role)).map((m) => m.id));

  // Only differences from the role's defaults are stored.
  const overrides = MODULES
    .filter((mod) => defaultModules.has(mod.id) !== desiredSet.has(mod.id))
    .map((mod) => ({ user_id: id, module_id: mod.id, granted: desiredSet.has(mod.id) }));

  const { error: delError } = await r.admin.from("profile_modules").delete().eq("user_id", id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });
  if (overrides.length) {
    const { error } = await r.admin.from("profile_modules").insert(overrides);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
