import { NextResponse } from "next/server";
import { admin, applyPassword, checkCode, findMember, flagsOf, isEmail, normEmail, passwordProblem } from "@/lib/auth/server";

/**
 * POST { email, code, password } — finishes "Activate your account" and "Forgot password?".
 * A reset signs the account out everywhere; an activation simply sets the first password.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normEmail(body.email);
  if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const weak = passwordProblem(body.password);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  const db = admin();
  // Switched-off and unknown accounts get the same answer as a wrong code.
  const wrong = NextResponse.json({ error: "That code is wrong or has expired. Ask for a new one." }, { status: 400 });
  const member = await findMember(db, email);
  if (!member) return wrong;
  const ok = await checkCode(email, body.code);
  if (!ok) return wrong;
  const activating = !!flagsOf(member.user).invite_pending;
  try {
    await applyPassword(db, ok.user, body.password, activating ? { notify: false } : { signOutEverywhere: ok.accessToken });
    // The code check opened a short session of its own; end it.
    if (activating) await db.auth.admin.signOut(ok.accessToken, "local").catch(() => {});
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not set the password" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, activated: activating });
}
