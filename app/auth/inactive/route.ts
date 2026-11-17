import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends a session that can no longer be used and goes to sign-in: an account the
 * CEO switched off (explained there), or with ?expired=1 a session that ran out.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const q = new URL(request.url).searchParams;
  const to = q.get("expired") === "1" ? "/auth/login" : q.get("reason") === "no_account" ? "/auth/login?error=no_account" : "/auth/login?inactive=1";
  return NextResponse.redirect(new URL(to, request.url));
}
