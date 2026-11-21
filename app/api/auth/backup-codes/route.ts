import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedIn } from "@/lib/auth/fast";
import { admin } from "@/lib/auth/server";
import { fingerprint, newCodes, readBackup, writeBackup } from "@/lib/auth/backup-codes";

/** The signed-in person with two-factor fully passed (aal2), or null. */
async function me() {
  const supabase = await createClient();
  const claims = await signedIn(supabase);
  if (!claims) return null;
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { id: claims.sub, verified: level?.currentLevel === "aal2" };
}

/** GET: how many backup codes are left. */
export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meta, state } = await readBackup(admin(), u.id);
  return NextResponse.json({ left: state.hashes.length, made_at: (meta.backup_codes_at as string) ?? null });
}

/** POST: make a new set of 10 codes (replaces the old ones). Shown once. Needs two-factor on and passed. */
export async function POST() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!u.verified) return NextResponse.json({ error: "Turn on two-factor first" }, { status: 400 });
  const db = admin();
  const { meta } = await readBackup(db, u.id);
  const codes = newCodes();
  await writeBackup(db, u.id, meta, { backup_codes: codes.map((c) => fingerprint(u.id, c)), backup_fails: 0, backup_failed_at: 0, backup_codes_at: new Date().toISOString() });
  return NextResponse.json({ codes });
}

/** DELETE: remove all codes (when two-factor is turned off). */
export async function DELETE() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = admin();
  const { meta } = await readBackup(db, u.id);
  await writeBackup(db, u.id, meta, { backup_codes: null, backup_codes_at: null, backup_fails: 0, backup_failed_at: 0 });
  return NextResponse.json({ ok: true });
}
