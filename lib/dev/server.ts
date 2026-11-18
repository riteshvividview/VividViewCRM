import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Developer console: one account owns it, set and moved only from inside the console.
 * Nothing here is shown to the CEO; the tables are server-only.
 */

export interface DevFeature {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  mode: "all" | "only" | "except";
  user_ids: string[];
}

const TTL_MS = 30_000;
let ownerCache: { at: number; owner: string | null } | null = null;
let featureCache: { at: number; features: DevFeature[] } | null = null;

/** The console owner's user id (null before migration 51 or when unset). */
export async function devOwner(admin: SupabaseClient): Promise<string | null> {
  if (ownerCache && Date.now() - ownerCache.at < TTL_MS) return ownerCache.owner;
  const { data, error } = await admin.from("dev_console").select("owner_id").maybeSingle();
  const owner = error ? null : (data?.owner_id ?? null);
  ownerCache = { at: Date.now(), owner };
  return owner;
}

export async function isDeveloper(admin: SupabaseClient, userId: string): Promise<boolean> {
  return (await devOwner(admin)) === userId;
}

export async function allFeatures(admin: SupabaseClient): Promise<DevFeature[]> {
  if (featureCache && Date.now() - featureCache.at < TTL_MS) return featureCache.features;
  const { data, error } = await admin.from("dev_features").select("key, name, description, enabled, mode, user_ids").order("created_at");
  const features = error ? [] : ((data ?? []) as DevFeature[]);
  featureCache = { at: Date.now(), features };
  return features;
}

export function featureOn(f: DevFeature | undefined, userId: string): boolean {
  if (!f || !f.enabled) return false;
  if (f.mode === "only") return f.user_ids.includes(userId);
  if (f.mode === "except") return !f.user_ids.includes(userId);
  return true;
}

/** Feature keys this person may use. */
export async function featuresFor(admin: SupabaseClient, userId: string): Promise<string[]> {
  return (await allFeatures(admin)).filter((f) => featureOn(f, userId)).map((f) => f.key);
}

export async function hasFeature(admin: SupabaseClient, userId: string, key: string): Promise<boolean> {
  return featureOn((await allFeatures(admin)).find((f) => f.key === key), userId);
}

/** Call after changing the owner or a feature. */
export function forgetDev() {
  ownerCache = null;
  featureCache = null;
}

/** Blocks removing or switching off the console owner. */
export const PROTECTED_MESSAGE = "This user manages the developer console, so they can't be deactivated or removed. Ask them to move the console to someone else first.";
export async function isProtectedUser(admin: SupabaseClient, userId: string): Promise<boolean> {
  return (await devOwner(admin)) === userId;
}
