import { NextResponse } from "next/server";
import { admin, findMember, flagsOf, isEmail, normEmail, sendCode, tooSoon } from "@/lib/auth/server";

/**
 * POST { email, purpose?: "activate" | "reset" } — emails a 6-digit code.
 * Used by "Activate your account" (first time) and "Forgot password?".
 * The answer is the same whether or not the email belongs to anyone, so nobody can find out who works here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normEmail(body.email);
  if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const same = NextResponse.json({ ok: true });
  try {
    const db = admin();
    const member = await findMember(db, email);
    if (!member) return same;
    const flags = flagsOf(member.user);
    if (tooSoon(flags)) return NextResponse.json({ error: "We just sent you a code. Wait a minute before asking again." }, { status: 429 });
    // Someone not activated yet always gets the activation wording, whichever screen they used.
    const purpose = flags.invite_pending ? "activate" : "reset";
    await sendCode(db, member.user, purpose, member.profile.full_name ?? undefined);
  } catch (e) {
    console.error("send code:", e);
    return NextResponse.json({ error: "We could not send the email. Try again in a moment." }, { status: 502 });
  }
  return same;
}
