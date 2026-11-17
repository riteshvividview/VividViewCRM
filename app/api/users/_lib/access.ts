import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface Ceo { userId: string; workspaceId: string }

/**
 * The signed-in CEO (super admin) of a workspace, or null. Requires the second
 * sign-in step when the account has one, and an active account.
 */
export async function getCeo(): Promise<Ceo | null> {
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
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return null;
  const { data: p } = await adminClient().from("profiles").select("role, workspace_id, disabled").eq("user_id", user.id).maybeSingle();
  if (!p || p.role !== "super_admin" || p.disabled || !p.workspace_id) return null;
  return { userId: user.id, workspaceId: p.workspace_id };
}

export const forbidden = () => NextResponse.json({ error: "Only the CEO can manage users" }, { status: 403 });
export const notFound = () => NextResponse.json({ error: "User not found" }, { status: 404 });

/** The target user's profile, only when they belong to the CEO's workspace. */
export async function targetProfile(admin: SupabaseClient, ceo: Ceo, userId: string) {
  const { data } = await admin.from("profiles").select("user_id, role, disabled, workspace_id").eq("user_id", userId).maybeSingle();
  return data && data.workspace_id === ceo.workspaceId ? data : null;
}

/** ~100 years: Supabase's way of switching a login off until it is switched back on. */
const BANNED = "876000h";

/**
 * Switches a person's access on or off. Off blocks signing in and renewing a
 * session at the auth level, and the app refuses requests from inactive
 * profiles straight away (an already issued token would otherwise last up to an hour).
 */
export async function setAccountActive(admin: SupabaseClient, userId: string, active: boolean): Promise<string | null> {
  const { error } = await admin.from("profiles").update({ disabled: !active }).eq("user_id", userId);
  if (error) return error.message;
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BANNED });
  if (authError) {
    // Keep both in step: undo the profile change if the login could not be changed.
    await admin.from("profiles").update({ disabled: active }).eq("user_id", userId);
    return authError.message;
  }
  return null;
}
