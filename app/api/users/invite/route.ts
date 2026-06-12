import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/brevo/client";
import { buildInviteEmail } from "@/lib/brevo/invite-template";
import type { UserRole } from "@/types";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  for (let i = 4; i < 10; i++) {
    required.push(all[Math.floor(Math.random() * all.length)]);
  }

  return required.sort(() => Math.random() - 0.5).join("");
}

const VALID_ROLES: UserRole[] = ["super_admin", "hr", "team_lead", "employee"];

async function generateEmployeeCode(
  supabaseAdmin: ReturnType<typeof adminClient>,
  workspaceId: string
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("hr_employees")
    .select("employee_code")
    .eq("workspace_id", workspaceId);

  let max = 0;
  for (const row of data ?? []) {
    const match = row.employee_code?.match(/^EMP-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAdmin = adminClient();

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, workspace_id")
      .eq("user_id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!callerProfile.workspace_id) {
      return NextResponse.json({ error: "Your account is not linked to a workspace" }, { status: 400 });
    }

    const body = await request.json();
    const full_name: string = body.full_name?.trim() ?? "";
    const email: string = body.email?.trim().toLowerCase() ?? "";
    const role: UserRole = body.role;

    if (!full_name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const password = generatePassword();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser?.user) {
      const msg = createError?.message ?? "Failed to create user";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: newUser.user.id,
      full_name,
      role,
      workspace_id: callerProfile.workspace_id,
    }, { onConflict: "user_id" });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const employee_code = await generateEmployeeCode(supabaseAdmin, callerProfile.workspace_id);

    const { error: empError } = await supabaseAdmin.from("hr_employees").insert({
      workspace_id: callerProfile.workspace_id,
      user_id: newUser.user.id,
      employee_code,
      designation: "",
      employment_type: "full_time",
      date_of_joining: new Date().toISOString().split("T")[0],
      status: "active",
    });

    if (empError) {
      await supabaseAdmin.from("profiles").delete().eq("user_id", newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: empError.message }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const loginUrl = `${appUrl}/auth/login`;
    const { subject, htmlContent } = buildInviteEmail(full_name, email, password, role, loginUrl);

    await sendEmail({ to: email, subject, htmlContent });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/users/invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
