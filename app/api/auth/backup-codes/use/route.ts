import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/auth/server";
import { LOCK_MS, MAX_TRIES, fingerprint, readBackup, writeBackup } from "@/lib/auth/backup-codes";

/**
 * POST { code }: at the two-factor step (password already accepted), use a backup code instead of the app.
 * A right code is used up and the lost authenticator is removed, so the person carries on with their
 * password and can set up a new phone. 5 wrong tries lock it for 15 minutes.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // the password step is enough here
  const userId = (data?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) return NextResponse.json({ error: "Sign in with your password first" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 8) return NextResponse.json({ error: "A backup code has 8 letters and numbers" }, { status: 400 });

  const db = admin();
  const { meta, state } = await readBackup(db, userId);
  const now = Date.now();
  const locked = state.fails >= MAX_TRIES && now - state.failedAt < LOCK_MS;
  if (locked) return NextResponse.json({ error: "Too many wrong codes. Try again in 15 minutes." }, { status: 429 });
  const fails = now - state.failedAt >= LOCK_MS ? 0 : state.fails;

  const hash = fingerprint(userId, code);
  if (!state.hashes.includes(hash)) {
    await writeBackup(db, userId, meta, { backup_fails: fails + 1, backup_failed_at: now });
    const left = MAX_TRIES - fails - 1;
    return NextResponse.json({ error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Try again in 15 minutes." }, { status: 400 });
  }

  // Right code: remove the lost authenticator and every remaining code (they belonged to it).
  const { data: factors } = await db.auth.admin.mfa.listFactors({ userId });
  for (const f of factors?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  await writeBackup(db, userId, meta, { backup_codes: null, backup_codes_at: null, backup_fails: 0, backup_failed_at: 0 });
  return NextResponse.json({ ok: true });
}
