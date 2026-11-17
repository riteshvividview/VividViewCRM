import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { admin, setFlags } from "@/lib/auth/server";

/**
 * Where Google (and any other sign-in link) comes back to. Only people the CEO
 * added get in: a Google account that is not in User Management is removed again
 * and sent back to the sign-in page with an explanation.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (error: string) => NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error)}`, url.origin));
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    // With sign-up switched off Supabase refuses unknown Google accounts itself.
    return back(/signup|sign up|not allowed/i.test(providerError) ? "not_invited" : "google_failed");
  }
  const code = url.searchParams.get("code");
  if (!code) return back("google_failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("google_failed");
  const user = data.user;

  const db = admin();
  const { data: profile } = await db.from("profiles").select("disabled, workspace_id").eq("user_id", user.id).maybeSingle();
  if (!profile?.workspace_id) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    // Created just now by this Google sign-in (sign-up still allowed in Supabase): remove it again.
    if (Date.now() - new Date(user.created_at).getTime() < 10 * 60_000) await db.auth.admin.deleteUser(user.id).catch(() => {});
    return back("not_invited");
  }
  if (profile.disabled) return NextResponse.redirect(new URL("/auth/inactive", url.origin));

  // Chose Google: no password to set up or change.
  if ((user.app_metadata?.provider === "google" || user.identities?.some((i) => i.provider === "google"))
    && (user.app_metadata?.invite_pending || user.app_metadata?.must_change_password)) {
    await setFlags(db, user.id, { invite_pending: false, must_change_password: false });
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
