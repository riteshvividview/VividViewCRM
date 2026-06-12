import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/brevo/client";
import { buildOtpEmail } from "@/lib/brevo/templates";

type OtpType = "password_reset" | "password_change" | "registration";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    const type: OtpType = body.type;

    const validTypes: OtpType[] = ["password_reset", "password_change", "registration"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid OTP type" }, { status: 400 });
    }

    let email: string = body.email?.trim().toLowerCase() ?? "";

    // password_change requires an active session — get email from it
    if (type === "password_change") {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {}
            },
          },
        }
      );
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

    // For password_reset: silently skip unknown emails (prevents enumeration)
    if (type === "password_reset") {
      const { data: userId } = await supabaseAdmin.rpc("get_user_id_by_email", { user_email: email });
      if (!userId) {
        return NextResponse.json({ success: true });
      }
    }

    // Rate-limit: block if a valid OTP was sent < 60 s ago
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("otp_verifications")
      .select("created_at")
      .eq("email", email)
      .eq("type", type)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .gt("created_at", sixtySecondsAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json(
        { error: "Please wait before requesting another code" },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp, email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin.from("otp_verifications").insert({
      email,
      otp_hash: otpHash,
      type,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return NextResponse.json({ error: "Failed to generate OTP" }, { status: 500 });
    }

    const { subject, htmlContent } = buildOtpEmail(otp, type);
    await sendEmail({ to: email, subject, htmlContent });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("OTP send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
