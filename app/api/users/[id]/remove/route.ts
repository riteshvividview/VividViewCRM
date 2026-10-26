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

// Permanently removes a user's HR employee record (if any) — cascading to
// attendance, leave applications/balances and payslips, and clearing any
// department-head / reporting-manager references — and disables their login
// so they can no longer access the system. Mirrors the removal performed
// from HRMS → Employees so both entry points leave the user in the same state.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (user.id === id) {
      return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
    }

    const supabaseAdmin = adminClient();

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.workspace_id || callerProfile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", id)
      .single();

    if (!targetProfile || targetProfile.workspace_id !== callerProfile.workspace_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: employee } = await supabaseAdmin
      .from("hr_employees")
      .select("id")
      .eq("user_id", id)
      .eq("workspace_id", callerProfile.workspace_id)
      .maybeSingle();

    if (employee) {
      const { error: deleteError } = await supabaseAdmin.from("hr_employees").delete().eq("id", employee.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    const { error: disableError } = await supabaseAdmin
      .from("profiles")
      .update({ disabled: true })
      .eq("user_id", id);

    if (disableError) return NextResponse.json({ error: disableError.message }, { status: 400 });

    return NextResponse.json({ success: true, hadEmployeeRecord: !!employee });
  } catch (err) {
    console.error("DELETE /api/users/[id]/remove error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
