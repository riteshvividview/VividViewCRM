import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../attendance/_lib/helpers";

/** GET ?run_id=… (HR: all slips in a run) or no params (own finalised payslips). */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runId = request.nextUrl.searchParams.get("run_id");
  let query = adminClient()
    .from("hr_payslips")
    .select("*, employee:hr_employees!employee_id(id, employee_code, designation, pan_number, uan_number, bank_name, bank_account_number, profiles(full_name))")
    .eq("workspace_id", ctx.workspaceId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (runId) {
    if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    query = query.eq("payroll_run_id", runId);
  } else {
    if (!ctx.employeeId) return NextResponse.json({ payslips: [] });
    // Employees only see payslips once the run is approved.
    query = query.eq("employee_id", ctx.employeeId).eq("status", "final");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payslips: data ?? [] });
}
