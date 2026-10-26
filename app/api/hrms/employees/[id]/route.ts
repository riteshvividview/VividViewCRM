import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getAuthContext, isHR, writeAuditLog } from "../../attendance/_lib/helpers";

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

// ── Full employee record (incl. salary, statutory & bank details) ─────────────
// HR/super_admin can read and edit anyone; an employee can read only their own record.

const EMPLOYEE_SELECT =
  "*, hr_departments!department_id(id, name), manager:hr_employees!reporting_manager_id(id, employee_code, profiles(full_name)), profiles(full_name, avatar_url, role)";

const EDITABLE_FIELDS = [
  "employee_code", "designation", "department_id", "reporting_manager_id", "employment_type", "status",
  "date_of_joining", "probation_end_date", "date_of_exit", "work_location", "notice_period_days",
  "date_of_birth", "gender", "phone", "personal_email", "blood_group", "marital_status",
  "current_address", "permanent_address",
  "salary_ctc", "salary_basic", "pan_number", "aadhaar_number", "uan_number",
  "bank_name", "bank_ifsc", "bank_account_number",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
];
const NUMERIC_FIELDS = new Set(["salary_ctc", "salary_basic", "notice_period_days"]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role) && ctx.employeeId !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await adminClient()
    .from("hr_employees")
    .select(EMPLOYEE_SELECT)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ employee: data, canEdit: isHR(ctx.role) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Only HR can edit employee records" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === "" || raw === undefined || raw === null) update[key] = NUMERIC_FIELDS.has(key) ? 0 : null;
    else update[key] = NUMERIC_FIELDS.has(key) ? Number(raw) : typeof raw === "string" ? raw.trim() : raw;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  if (update.reporting_manager_id === id) {
    return NextResponse.json({ error: "An employee cannot report to themselves" }, { status: 400 });
  }
  for (const key of NUMERIC_FIELDS) {
    if (key in update && (!Number.isFinite(update[key]) || Number(update[key]) < 0)) {
      return NextResponse.json({ error: `Invalid ${key.replace(/_/g, " ")}` }, { status: 400 });
    }
  }
  if (update.employee_code === null) return NextResponse.json({ error: "Employee code is required" }, { status: 400 });

  const admin = adminClient();
  // Referenced department/manager must belong to the same workspace.
  if (update.department_id) {
    const { data } = await admin.from("hr_departments").select("id").eq("id", update.department_id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Department not found" }, { status: 400 });
  }
  if (update.reporting_manager_id) {
    const { data } = await admin.from("hr_employees").select("id").eq("id", update.reporting_manager_id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Reporting manager not found" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();
  const { data, error } = await admin
    .from("hr_employees")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select(EMPLOYEE_SELECT)
    .maybeSingle();
  if (error) {
    const msg = error.message.includes("duplicate") ? "Employee code already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "employee", entity_id: id, action: "update",
    description: `Updated ${Object.keys(update).filter((k) => k !== "updated_at").join(", ")}`,
    performed_by: ctx.userId,
  }).catch(() => {});

  return NextResponse.json({ employee: data });
}
