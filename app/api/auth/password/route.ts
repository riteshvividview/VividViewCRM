import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin, applyPassword, checkCode, flagsOf, passwordProblem, sendCode, tooSoon } from "@/lib/auth/server";

/**
 * Password changes for the signed-in person, always checked here on the server:
 * POST { action: "code" }                       email a 6-digit code
 * POST { action: "change", code, password }     change it with that code (Settings → Security)
 * POST { action: "first", password }            the required change after the CEO set the password
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return NextResponse.json({ error: "Finish two-factor sign-in first" }, { status: 401 });
  const db = admin();
  const { data: profile } = await db.from("profiles").select("disabled").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.disabled) return NextResponse.json({ error: "This account is not active" }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "code") {
    if (tooSoon(flagsOf(user))) return NextResponse.json({ error: "We just sent a code. Wait a minute before asking again." }, { status: 429 });
    try { await sendCode(db, user, "change"); } catch { return NextResponse.json({ error: "We could not send the code. Try again in a moment." }, { status: 502 }); }
    return NextResponse.json({ ok: true });
  }

  const weak = passwordProblem(body.password);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });

  if (body.action === "change") {
    const ok = await checkCode(user.email, body.code);
    if (!ok || ok.user.id !== user.id) return NextResponse.json({ error: "That code is wrong or has expired. Ask for a new one." }, { status: 400 });
    // The code check opened its own short session; end just that one.
    await db.auth.admin.signOut(ok.accessToken, "local").catch(() => {});
  } else if (body.action === "first") {
    if (!flagsOf(user).must_change_password) return NextResponse.json({ error: "Use Settings → Security to change your password" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try { await applyPassword(db, user, body.password); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not change the password" }, { status: 400 });
  }
  // A password change ends every session of the account, this one too.
  // Sign this device straight back in with the new password (its cookies are replaced).
  const { error: again } = await supabase.auth.signInWithPassword({ email: user.email, password: body.password });
  return NextResponse.json({ ok: true, signed_in: !again });
}
