import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function hashOtp(otp: string, email: string): string {
  return createHash("sha256").update(`${otp}:${email}`).digest("hex");
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { email, otp, type } = body as { email: string; otp: string; type: string };

    otp = otp?.trim();
    email = email?.trim().toLowerCase();

    if (!otp || !type) {
      return NextResponse.json({ error: "OTP and type are required" }, { status: 400 });
    }

    // password_change requires an active session — get email from it
    if (type === "password_change") {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      email = session.user.email;
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabaseAdmin = adminClient();
    const now = new Date().toISOString();

    const { data: rows, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("id, otp_hash, expires_at")
      .eq("email", email)
      .eq("type", type)
      .is("used_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    const record = rows[0];
    const expectedHash = hashOtp(otp, email);

    if (record.otp_hash !== expectedHash) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // ── registration ─────────────────────────────────────────────────
    if (type === "registration") {
      const creationToken = randomUUID();
      await supabaseAdmin
        .from("otp_verifications")
        .update({ used_at: now, reset_token: creationToken })
        .eq("id", record.id);
      return NextResponse.json({ creationToken, email });
    }

    // ── password_reset ───────────────────────────────────────────────
    if (type === "password_reset") {
      const resetToken = randomUUID();
      await supabaseAdmin
        .from("otp_verifications")
        .update({ used_at: now, reset_token: resetToken })
        .eq("id", record.id);
      return NextResponse.json({ resetToken, email });
    }

    // ── password_change ──────────────────────────────────────────────
    await supabaseAdmin.from("otp_verifications").update({ used_at: now }).eq("id", record.id);
    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
