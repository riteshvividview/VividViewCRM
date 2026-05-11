import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
    const { email, password, fullName, creationToken } = body as {
      email: string;
      password: string;
      fullName: string;
      creationToken: string;
    };

    if (!email || !password || !fullName || !creationToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const supabaseAdmin = adminClient();
    const now = new Date().toISOString();

    // Validate the creation token from OTP verification
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("id")
      .eq("reset_token", creationToken)
      .eq("email", email.trim().toLowerCase())
      .eq("type", "registration")
      .gt("expires_at", now)
      .limit(1);

    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 400 });
    }

    const record = rows[0];

    // Check if user already exists
    const { data: existingUserId } = await supabaseAdmin.rpc("get_user_id_by_email", {
      user_email: email.trim().toLowerCase(),
    });

    if (existingUserId) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Create the user — email already verified via OTP
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    });

    if (createError) {
      console.error("User creation error:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Invalidate the creation token
    await supabaseAdmin
      .from("otp_verifications")
      .update({ reset_token: null, used_at: now })
      .eq("id", record.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
