"use client";

import { fmtINR } from "./resource-manager";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PayslipView({ slip }: { slip: Record<string, any> }) {
  const emp = slip.employee ?? {};
  const earnings: [string, number][] = [
    ["Basic", slip.basic_salary], ["HRA", slip.hra], ["Special allowance", slip.special_allowance], ["Reimbursements", slip.other_earnings],
  ];
  const deductions: [string, number][] = [
    ["Provident Fund", slip.pf_employee], ["ESI", slip.esi_employee], ["Professional Tax", slip.professional_tax],
    ["Income Tax (TDS)", slip.income_tax_tds], ["Loan / advance EMI", slip.other_deductions],
  ];

  return (
    <div className="payslip rounded-xl border bg-white text-slate-900 p-6 text-sm">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <p className="text-lg font-semibold">Payslip</p>
          <p className="text-slate-500">{MONTHS[slip.month - 1]} {slip.year}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{emp.profiles?.full_name ?? "—"}</p>
          <p className="text-slate-500">{emp.employee_code} · {emp.designation ?? ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b text-xs">
        <div><p className="text-slate-500">PAN</p><p className="font-medium">{emp.pan_number ?? "—"}</p></div>
        <div><p className="text-slate-500">UAN</p><p className="font-medium">{emp.uan_number ?? "—"}</p></div>
        <div><p className="text-slate-500">Bank</p><p className="font-medium">{emp.bank_name ?? "—"} {emp.bank_account_number ? `••${String(emp.bank_account_number).slice(-4)}` : ""}</p></div>
        <div><p className="text-slate-500">Paid days</p><p className="font-medium">{slip.days_worked} / {slip.days_in_month} {Number(slip.days_lop) > 0 && <span className="text-red-600">(LOP {slip.days_lop})</span>}</p></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6 py-4">
        {[["Earnings", earnings, slip.gross_salary, "Gross earnings"], ["Deductions", deductions, slip.total_deductions, "Total deductions"]].map(([title, rows, total, totalLabel]) => (
          <div key={title as string}>
            <p className="font-semibold mb-2">{title as string}</p>
            {(rows as [string, number][]).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1"><span className="text-slate-600">{k}</span><span>{fmtINR(v)}</span></div>
            ))}
            <div className="flex justify-between py-1 mt-1 border-t font-semibold"><span>{totalLabel as string}</span><span>{fmtINR(total)}</span></div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-purple-50 px-4 py-3">
        <span className="font-semibold">Net pay</span>
        <span className="text-xl font-bold text-purple-700">{fmtINR(slip.net_salary)}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">Employer PF contribution: {fmtINR(slip.pf_employer)}. This is a system-generated payslip.</p>
    </div>
  );
}

export { MONTHS };
