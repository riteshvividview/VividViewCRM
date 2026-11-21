import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Two-factor backup codes: 10 one-time codes shown once when they're made.
 * Only a fingerprint of each code is kept (in the login's server-only app_metadata), so nobody,
 * not even an admin, can read them back. Using one removes the lost authenticator app so the
 * person can sign in with their password and set up a new phone.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I to avoid mix-ups
const COUNT = 10;
export const MAX_TRIES = 5;
export const LOCK_MS = 15 * 60 * 1000;

const normal = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const fingerprint = (userId: string, code: string) => createHash("sha256").update(`${userId}:${normal(code)}`).digest("hex");

export function newCodes(): string[] {
  const one = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const set = new Set<string>();
  while (set.size < COUNT) set.add(one());
  return [...set].map((c) => `${c.slice(0, 4)}-${c.slice(4)}`);
}

export interface BackupState { hashes: string[]; fails: number; failedAt: number }

export async function readBackup(db: SupabaseClient, userId: string): Promise<{ meta: Record<string, unknown>; state: BackupState }> {
  const { data } = await db.auth.admin.getUserById(userId);
  const meta = (data.user?.app_metadata ?? {}) as Record<string, unknown>;
  return {
    meta,
    state: {
      hashes: Array.isArray(meta.backup_codes) ? (meta.backup_codes as string[]) : [],
      fails: Number(meta.backup_fails ?? 0) || 0,
      failedAt: Number(meta.backup_failed_at ?? 0) || 0,
    },
  };
}

export async function writeBackup(db: SupabaseClient, userId: string, meta: Record<string, unknown>, patch: Partial<{ backup_codes: string[] | null; backup_fails: number; backup_failed_at: number; backup_codes_at: string | null }>) {
  await db.auth.admin.updateUserById(userId, { app_metadata: { ...meta, ...patch } });
}
