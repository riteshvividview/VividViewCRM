import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMonthlyReports } from "../../attendance/_lib/reports";

export interface PayrollSettings {
  basic_percent: number;
  hra_percent: number;
  pf_enabled: boolean;
  pf_wage_cap: number;
  esi_enabled: boolean;
  esi_gross_limit: number;
  pt_enabled: boolean;
  pt_amount: number;
  pt_threshold: number;
  tds_enabled: boolean;
}

export const DEFAULT_SETTINGS: PayrollSettings = {
  basic_percent: 50, hra_percent: 40,
  pf_enabled: true, pf_wage_cap: 15000,
  esi_enabled: true, esi_gross_limit: 21000,
  pt_enabled: true, pt_amount: 200, pt_threshold: 15000,
  tds_enabled: true,
};

export async function loadSettings(admin: SupabaseClient, workspaceId: string): Promise<PayrollSettings> {
  const { data } = await admin.from("hr_payroll_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof PayrollSettings)[]) {
    if (data[k] !== null && data[k] !== undefined) (out as Record<string, unknown>)[k] = typeof DEFAULT_SETTINGS[k] === "number" ? Number(data[k]) : data[k];
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Annual income tax under India's new regime (FY 2025-26): ₹75k standard deduction,
 * 87A rebate up to ₹12L taxable income, 4% health & education cess.
 */
export function annualTaxNewRegime(annualGross: number): number {
  const taxable = Math.max(0, annualGross - 75000);
  if (taxable <= 1200000) return 0;
  const slabs: [number, number][] = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax * 1.04;
}

export interface TaxDeclaration {
  regime: "new" | "old";
  sec_80c: number; sec_80d: number; sec_80ccd_1b: number; home_loan_interest: number;
  annual_rent_paid: number; metro_city: boolean; other_deductions: number;
}

/**
 * Annual income tax under the old regime: ₹50k standard deduction, HRA exemption,
 * capped Chapter VI-A deductions, 87A rebate up to ₹5L taxable income, 4% cess.
 */
export function annualTaxOldRegime(annualGross: number, annualBasic: number, annualHra: number, d: TaxDeclaration): number {
  const hraExempt = d.annual_rent_paid > 0
    ? Math.max(0, Math.min(annualHra, d.annual_rent_paid - 0.1 * annualBasic, annualBasic * (d.metro_city ? 0.5 : 0.4)))
    : 0;
  const deductions = 50000 + hraExempt
    + Math.min(Number(d.sec_80c) || 0, 150000)
    + Math.min(Number(d.sec_80d) || 0, 100000)
    + Math.min(Number(d.sec_80ccd_1b) || 0, 50000)
    + Math.min(Number(d.home_loan_interest) || 0, 200000)
    + Math.max(0, Number(d.other_deductions) || 0);
  const taxable = Math.max(0, annualGross - deductions);
  if (taxable <= 500000) return 0;
  const slabs: [number, number][] = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax * 1.04;
}

/** Indian financial year label for a pay month, e.g. Oct 2026 → "2026-27". */
export function financialYear(month: number, year: number): string {
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

interface Employee { id: string; salary_ctc: number | null; salary_basic: number | null }

export interface PayslipDraft {
  employee_id: string;
  days_in_month: number;
  days_worked: number;
  days_lop: number;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  other_earnings: number;
  gross_salary: number;
  pf_employee: number;
  pf_employer: number;
  esi_employee: number;
  professional_tax: number;
  income_tax_tds: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
}

/** Pure salary computation for one employee/month. */
export function computePayslip(
  emp: Employee,
  s: PayrollSettings,
  daysInMonth: number,
  lopDays: number,
  reimbursements: number,
  loanEmi: number,
  declaration: TaxDeclaration | null = null,
): PayslipDraft {
  const monthlyCtc = Number(emp.salary_ctc ?? 0) / 12;
  const basicFull = emp.salary_basic ? Number(emp.salary_basic) / 12 : monthlyCtc * (s.basic_percent / 100);
  const hraFull = basicFull * (s.hra_percent / 100);
  // Employer PF is part of CTC, so it is carved out before the special allowance.
  const employerPfFull = s.pf_enabled ? Math.min(basicFull, s.pf_wage_cap) * 0.12 : 0;
  const specialFull = Math.max(0, monthlyCtc - basicFull - hraFull - employerPfFull);
  const fullGross = basicFull + hraFull + specialFull;

  const lop = Math.min(Math.max(lopDays, 0), daysInMonth);
  const factor = daysInMonth > 0 ? (daysInMonth - lop) / daysInMonth : 1;
  const basic = basicFull * factor;
  const hra = hraFull * factor;
  const special = specialFull * factor;
  const salaryGross = basic + hra + special;
  const gross = salaryGross + reimbursements;

  const pfEmployee = s.pf_enabled ? Math.min(basic, s.pf_wage_cap) * 0.12 : 0;
  const pfEmployer = pfEmployee;
  const esi = s.esi_enabled && fullGross <= s.esi_gross_limit ? salaryGross * 0.0075 : 0;
  const pt = s.pt_enabled && salaryGross > s.pt_threshold ? s.pt_amount : 0;
  const annualTax = declaration?.regime === "old"
    ? annualTaxOldRegime(fullGross * 12, basicFull * 12, hraFull * 12, declaration)
    : annualTaxNewRegime(fullGross * 12);
  const tds = s.tds_enabled ? annualTax / 12 : 0;
  const totalDeductions = pfEmployee + esi + pt + tds + loanEmi;

  return {
    employee_id: emp.id,
    days_in_month: daysInMonth,
    days_worked: r2(daysInMonth - lop),
    days_lop: r2(lop),
    basic_salary: r2(basic),
    hra: r2(hra),
    special_allowance: r2(special),
    other_earnings: r2(reimbursements),
    gross_salary: r2(gross),
    pf_employee: r2(pfEmployee),
    pf_employer: r2(pfEmployer),
    esi_employee: r2(esi),
    professional_tax: r2(pt),
    income_tax_tds: r2(tds),
    other_deductions: r2(loanEmi),
    total_deductions: r2(totalDeductions),
    net_salary: r2(gross - totalDeductions),
  };
}

/** Computes (or recomputes) every payslip for a run. Side effects on loans/expenses happen on approval. */
export async function processRun(
  admin: SupabaseClient,
  workspaceId: string,
  run: { id: string; month: number; year: number },
  useAttendance: boolean,
) {
  const settings = await loadSettings(admin, workspaceId);
  const daysInMonth = new Date(run.year, run.month, 0).getDate();

  const { data: employees, error } = await admin
    .from("hr_employees")
    .select("id, salary_ctc, salary_basic")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .gt("salary_ctc", 0);
  if (error) throw new Error(error.message);
  const emps = (employees ?? []) as Employee[];
  const ids = emps.map((e) => e.id);
  if (ids.length === 0) throw new Error("No active employees with a CTC set. Add salary details on employee profiles first.");

  const lopByEmp = new Map<string, number>();
  if (useAttendance) {
    const reports = await computeMonthlyReports(admin, workspaceId, run.year, run.month, { employeeIds: ids });
    for (const r of reports) {
      lopByEmp.set(r.employee.id, (r.counts.absent ?? 0) + r.unpaid_leave_days + (r.counts.half_day ?? 0) * 0.5);
    }
  }

  const [expensesRes, loansRes, declRes] = await Promise.all([
    admin.from("hr_expense_claims").select("employee_id, amount").eq("workspace_id", workspaceId).eq("status", "approved").is("payroll_run_id", null).in("employee_id", ids),
    admin.from("hr_loans").select("employee_id, emi_amount, outstanding").eq("workspace_id", workspaceId).eq("status", "active").in("employee_id", ids),
    // Rejected declarations are ignored; submitted ones count provisionally until HR verifies.
    admin.from("hr_tax_declarations").select("*").eq("workspace_id", workspaceId)
      .eq("financial_year", financialYear(run.month, run.year)).neq("status", "rejected").in("employee_id", ids),
  ]);
  const declByEmp = new Map<string, TaxDeclaration>();
  for (const d of declRes.data ?? []) declByEmp.set(d.employee_id, d as TaxDeclaration);
  const reimb = new Map<string, number>();
  for (const e of expensesRes.data ?? []) reimb.set(e.employee_id, (reimb.get(e.employee_id) ?? 0) + Number(e.amount));
  const emi = new Map<string, number>();
  for (const l of loansRes.data ?? []) {
    emi.set(l.employee_id, (emi.get(l.employee_id) ?? 0) + Math.min(Number(l.emi_amount), Number(l.outstanding)));
  }

  const slips = emps.map((e) => ({
    ...computePayslip(e, settings, daysInMonth, lopByEmp.get(e.id) ?? 0, reimb.get(e.id) ?? 0, emi.get(e.id) ?? 0, declByEmp.get(e.id) ?? null),
    workspace_id: workspaceId,
    payroll_run_id: run.id,
    month: run.month,
    year: run.year,
    status: "draft",
  }));

  await admin.from("hr_payslips").delete().eq("payroll_run_id", run.id);
  const { error: insErr } = await admin.from("hr_payslips").insert(slips);
  if (insErr) throw new Error(insErr.message);

  const totals = slips.reduce(
    (t, s) => ({ g: t.g + s.gross_salary, d: t.d + s.total_deductions, n: t.n + s.net_salary }),
    { g: 0, d: 0, n: 0 },
  );
  await admin.from("hr_payroll_runs").update({
    status: "completed",
    total_gross: r2(totals.g),
    total_deductions: r2(totals.d),
    total_net: r2(totals.n),
    employee_count: slips.length,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);

  return { count: slips.length, ...totals };
}

/** Finalises a processed run: locks payslips, pays out reimbursements and recovers loan EMIs. */
export async function approveRun(admin: SupabaseClient, workspaceId: string, runId: string, userId: string, processedAt: string) {
  const { data: slips } = await admin.from("hr_payslips").select("employee_id, other_deductions").eq("payroll_run_id", runId);
  const ids = (slips ?? []).map((s) => s.employee_id);

  if (ids.length) {
    await admin.from("hr_expense_claims")
      .update({ status: "paid", payroll_run_id: runId, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId).eq("status", "approved").is("payroll_run_id", null).in("employee_id", ids)
      .lte("decided_at", processedAt); // only claims that were included when the run was processed

    const { data: loans } = await admin.from("hr_loans").select("id, emi_amount, outstanding")
      .eq("workspace_id", workspaceId).eq("status", "active").in("employee_id", ids);
    for (const l of loans ?? []) {
      const outstanding = r2(Math.max(0, Number(l.outstanding) - Math.min(Number(l.emi_amount), Number(l.outstanding))));
      await admin.from("hr_loans").update({
        outstanding, status: outstanding === 0 ? "closed" : "active", updated_at: new Date().toISOString(),
      }).eq("id", l.id);
    }
  }

  await admin.from("hr_payslips").update({ status: "final", updated_at: new Date().toISOString() }).eq("payroll_run_id", runId);
  await admin.from("hr_payroll_runs").update({ status: "approved", approved_by: userId, updated_at: new Date().toISOString() }).eq("id", runId);
}
