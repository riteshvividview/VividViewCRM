import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/brevo/client";
import { buildInviteEmail } from "@/lib/brevo/invite-template";

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

    if (!callerProfile?.workspace_id || !["super_admin", "hr"].includes(callerProfile.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const full_name: string = body.full_name?.trim() ?? "";
    const email: string = body.email?.trim().toLowerCase() ?? "";
    const employee_code: string = body.employee_code?.trim().toUpperCase() ?? "";
    const designation: string = body.designation?.trim() ?? "";
    const date_of_joining: string = body.date_of_joining ?? "";

    if (!full_name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!employee_code) return NextResponse.json({ error: "Employee code is required" }, { status: 400 });
    if (!designation) return NextResponse.json({ error: "Designation is required" }, { status: 400 });
    if (!date_of_joining) return NextResponse.json({ error: "Date of joining is required" }, { status: 400 });

    const password = generatePassword();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser?.user) {
      const msg = createError?.message ?? "Failed to create user account";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: newUser.user.id,
      full_name,
      role: "employee",
      workspace_id: callerProfile.workspace_id,
    }, { onConflict: "user_id" });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { data: newEmployee, error: empError } = await supabaseAdmin.from("hr_employees").insert({
      workspace_id: callerProfile.workspace_id,
      user_id: newUser.user.id,
      employee_code,
      designation,
      department_id: body.department_id || null,
      employment_type: body.employment_type || "full_time",
      date_of_joining,
      salary_ctc: body.salary_ctc ? Number(body.salary_ctc) : 0,
      salary_basic: body.salary_basic ? Number(body.salary_basic) : 0,
      status: body.status || "active",
      reporting_manager_id: body.reporting_manager_id || null,
      work_location: ["office", "remote", "hybrid"].includes(body.work_location) ? body.work_location : "office",
      phone: body.phone?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      emergency_contact_name: body.emergency_contact_name?.trim() || null,
      emergency_contact_phone: body.emergency_contact_phone?.trim() || null,
      emergency_contact_relation: body.emergency_contact_relation?.trim() || null,
    }).select("id").single();

    if (empError) {
      await supabaseAdmin.from("profiles").delete().eq("user_id", newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      const msg = empError.message.includes("duplicate") ? "Employee code already exists" : empError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const loginUrl = `${appUrl}/auth/login`;
    const { subject, htmlContent } = buildInviteEmail(full_name, email, password, "employee", loginUrl);

    try {
      await sendEmail({ to: email, subject, htmlContent });
    } catch (emailErr) {
      console.error("Failed to send employee credentials email:", emailErr);
    }

    return NextResponse.json({ success: true, id: newEmployee.id });
  } catch (err) {
    console.error("POST /api/hrms/employees error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
