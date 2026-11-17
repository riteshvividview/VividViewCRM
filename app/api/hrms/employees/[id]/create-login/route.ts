import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    if (!full_name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const { data: employee, error: empFetchError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, user_id, workspace_id")
      .eq("id", id)
      .single();

    if (empFetchError || !employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (employee.workspace_id !== callerProfile.workspace_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (employee.user_id) {
      return NextResponse.json({ error: "This employee already has a linked login account" }, { status: 400 });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
      // No password: they activate it themselves (emailed code) or use Google.
      app_metadata: { invite_pending: true },
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

    const { error: linkError } = await supabaseAdmin
      .from("hr_employees")
      .update({ user_id: newUser.user.id })
      .eq("id", id);

    if (linkError) {
      await supabaseAdmin.from("profiles").delete().eq("user_id", newUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    // Nothing is emailed: they activate the account themselves from the sign-in page.

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/hrms/employees/[id]/create-login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
