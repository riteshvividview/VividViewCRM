import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends a session that can no longer be used and goes to sign-in: an account the
 * CEO switched off (explained there), or with ?expired=1 a session that ran out.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const expired = new URL(request.url).searchParams.get("expired") === "1";
  return NextResponse.redirect(new URL(expired ? "/auth/login" : "/auth/login?inactive=1", request.url));
}
