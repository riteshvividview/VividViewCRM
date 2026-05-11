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
    const { email, resetToken, newPassword } = body as {
      email: string;
      resetToken: string;
      newPassword: string;
    };

    if (!email || !resetToken || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const supabaseAdmin = adminClient();
    const now = new Date().toISOString();

    // Validate the reset token
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("id, email")
      .eq("reset_token", resetToken)
      .eq("email", email.trim().toLowerCase())
      .eq("type", "password_reset")
      .gt("expires_at", now)
      .limit(1);

    if (fetchError || !rows || rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const record = rows[0];

    // Get the user UUID by email
    const { data: userId, error: rpcError } = await supabaseAdmin.rpc("get_user_id_by_email", {
      user_email: email.trim().toLowerCase(),
    });

    if (rpcError || !userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update the password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    // Invalidate the reset token by clearing it
    await supabaseAdmin
      .from("otp_verifications")
      .update({ reset_token: null, used_at: now })
      .eq("id", record.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
