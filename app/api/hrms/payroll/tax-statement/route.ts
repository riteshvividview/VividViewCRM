import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../attendance/_lib/helpers";

/**
 * Annual (financial-year) salary & TDS statement — the Form 16 Part B style summary,
 * built from approved payslips. GET ?fy=2026-27[&employee_id=…] (HR may pick anyone).
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fy = request.nextUrl.searchParams.get("fy") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m) return NextResponse.json({ error: "Invalid financial year" }, { status: 400 });
  const startYear = Number(m[1]);

  const requested = request.nextUrl.searchParams.get("employee_id");
  const employeeId = isHR(ctx.role) && requested ? requested : ctx.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });

  const admin = adminClient();
  const [{ data: employee }, { data: slips }, { data: declaration }] = await Promise.all([
    admin.from("hr_employees").select("id, employee_code, designation, pan_number, profiles(full_name)")
      .eq("id", employeeId).eq("workspace_id", ctx.workspaceId).maybeSingle(),
    admin.from("hr_payslips").select("month, year, basic_salary, hra, special_allowance, other_earnings, gross_salary, pf_employee, esi_employee, professional_tax, income_tax_tds, net_salary")
      .eq("workspace_id", ctx.workspaceId).eq("employee_id", employeeId).eq("status", "final")
      .or(`and(year.eq.${startYear},month.gte.4),and(year.eq.${startYear + 1},month.lte.3)`)
      .order("year").order("month"),
    admin.from("hr_tax_declarations").select("*").eq("employee_id", employeeId).eq("financial_year", fy).maybeSingle(),
  ]);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const sum = (k: string) => (slips ?? []).reduce((t, s) => t + Number((s as Record<string, unknown>)[k] ?? 0), 0);
  return NextResponse.json({
    financial_year: fy,
    employee,
    months: slips ?? [],
    declaration: declaration ?? null,
    totals: {
      basic: sum("basic_salary"), hra: sum("hra"), special: sum("special_allowance"), reimbursements: sum("other_earnings"),
      gross: sum("gross_salary"), pf: sum("pf_employee"), esi: sum("esi_employee"), professional_tax: sum("professional_tax"),
      tds: sum("income_tax_tds"), net: sum("net_salary"),
    },
  });
}
