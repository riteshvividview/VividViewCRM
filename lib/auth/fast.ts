import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fast identity checks for server code.
 *
 * - The sign-in token is verified locally against the project's public signing key
 *   (ES256), so no request goes to Supabase Auth. Supabase's library falls back to a
 *   network check by itself if the project ever uses a shared-secret key again.
 * - Each person's role, workspace and active/inactive state is kept in memory for a
 *   short time per server instance, instead of being read on every request.
 *   Deactivating someone clears it here at once, and other instances within 30 seconds.
 *   (Their login is also blocked at Supabase straight away.)
 */

export interface Claims {
  sub: string;
  email?: string;
  aal?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/** The signed-in person from the request's sign-in cookie, or null. Includes the two-factor step. */
export async function signedIn(supabase: SupabaseClient): Promise<Claims | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Claims | undefined;
  if (error || !claims?.sub) return null;
  // With an authenticator app set up, a password alone is not enough (checked locally).
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2") return null;
  return claims;
}

export interface CachedProfile { role: string; workspace_id: string | null; disabled: boolean; full_name: string | null }

const TTL_MS = 30_000;
const MAX = 2000;
const cache = new Map<string, { at: number; profile: CachedProfile | null }>();

/** The person's profile (role, workspace, active), from memory when fresh. */
export async function profileOf(admin: SupabaseClient, userId: string): Promise<CachedProfile | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.profile;
  const { data } = await admin.from("profiles").select("role, workspace_id, disabled, full_name").eq("user_id", userId).maybeSingle();
  const profile = data ? { role: data.role ?? "employee", workspace_id: data.workspace_id, disabled: !!data.disabled, full_name: data.full_name } : null;
  if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
  cache.set(userId, { at: Date.now(), profile });
  return profile;
}

/** Call after changing someone's role, workspace or active state. */
export function forgetProfile(userId: string) {
  cache.delete(userId);
}
