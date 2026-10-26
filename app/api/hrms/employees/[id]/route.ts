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

// Permanently removes an employee from HRMS: deletes their hr_employees row
// (cascading to attendance, leave applications/balances and payslips, and
// clearing any department-head / reporting-manager references per the DB
// schema), and disables their login so they can no longer access the system.
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

    const supabaseAdmin = adminClient();

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.workspace_id || !["super_admin", "hr"].includes(callerProfile.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    if (employee.user_id === user.id) {
      return NextResponse.json({ error: "You cannot remove your own employee record" }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin.from("hr_employees").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    if (employee.user_id) {
      const { error: disableError } = await supabaseAdmin
        .from("profiles")
        .update({ disabled: true })
        .eq("user_id", employee.user_id);

      if (disableError) {
        console.error("Failed to disable login after removing employee:", disableError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/hrms/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
