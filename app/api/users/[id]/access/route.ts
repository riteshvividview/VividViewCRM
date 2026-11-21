import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, forbidden, getCeo, notFound, targetProfile } from "../../_lib/access";
import { flagsOf, sendAddedNotice, sendCode, setFlags } from "@/lib/auth/server";

/**
 * POST { action } — the CEO helps someone get in:
 *   "remind"         a short "you've been added, activate here" email (no code)
 *   "reset_code"     a password reset code to type on the "Forgot password?" screen
 *   "reset_2fa"      removes their authenticator app so they can sign in with the password alone
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ceo = await getCeo();
  if (!ceo) return forbidden();
  const { id } = await params;
  const db = adminClient();
  const target = await targetProfile(db, ceo, id);
  if (!target) return notFound();
  if (target.disabled) return NextResponse.json({ error: "Reactivate this person first" }, { status: 400 });
  const { data: u } = await db.auth.admin.getUserById(id);
  if (!u.user) return notFound();
  const body = await request.json().catch(() => ({}));
  const { data: who } = await db.from("profiles").select("full_name").eq("user_id", id).maybeSingle();
  const { data: me } = await db.from("profiles").select("full_name").eq("user_id", ceo.userId).maybeSingle();

  if (body.action === "remind" || body.action === "reset_code") {
    const pending = !!flagsOf(u.user).invite_pending;
    if (body.action === "remind" && !pending) return NextResponse.json({ error: "They have already activated their account. Send a password reset code instead." }, { status: 400 });
    if (body.action === "reset_code" && pending) return NextResponse.json({ error: "They have not activated their account yet. Send a reminder instead." }, { status: 400 });
    try {
      if (body.action === "remind") await sendAddedNotice(db, u.user, who?.full_name ?? "", request, me?.full_name ?? undefined);
      else await sendCode(db, u.user, "reset", who?.full_name ?? undefined);
    } catch {
      return NextResponse.json({ error: "The email could not be sent. Try again in a moment." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reset_2fa") {
    if (id === ceo.userId) return NextResponse.json({ error: "Turn off your own two-factor in Settings → Security" }, { status: 400 });
    const { data: factors, error } = await db.auth.admin.mfa.listFactors({ userId: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    for (const f of factors?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ userId: id, id: f.id });
    // Their old backup codes belonged to the removed authenticator.
    await setFlags(db, id, { backup_codes: null, backup_codes_at: null, backup_fails: 0, backup_failed_at: 0 });
    return NextResponse.json({ ok: true, removed: factors?.factors?.length ?? 0 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
