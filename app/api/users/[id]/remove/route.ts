import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, forbidden, getCeo, notFound, setAccountActive, targetProfile } from "../../_lib/access";

// Permanently removes a user's HR employee record (if any) — cascading to
// attendance, leave applications/balances and payslips, and clearing any
// department-head / reporting-manager references — and disables their login
// so they can no longer access the system. Mirrors the removal performed
// from HRMS → Employees so both entry points leave the user in the same state.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const { id } = await params;
    if (id === ceo.userId) return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
    const supabaseAdmin = adminClient();
    if (!(await targetProfile(supabaseAdmin, ceo, id))) return notFound();

    const { data: employee } = await supabaseAdmin.from("hr_employees").select("id")
      .eq("user_id", id).eq("workspace_id", ceo.workspaceId).maybeSingle();
    if (employee) {
      const { error: deleteError } = await supabaseAdmin.from("hr_employees").delete().eq("id", employee.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    const err = await setAccountActive(supabaseAdmin, id, false);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    return NextResponse.json({ success: true, hadEmployeeRecord: !!employee });
  } catch (err) {
    console.error("DELETE /api/users/[id]/remove error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
