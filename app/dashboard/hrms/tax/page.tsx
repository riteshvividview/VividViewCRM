"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { ResourceManager, StatusPill, fmtINR, empName } from "@/components/hrms/resource-manager";
import { Button } from "@/components/ui/button";
import { MONTHS } from "@/components/hrms/payslip-view";

function currentFY() {
  const d = new Date();
  const start = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
const FY_OPTIONS = [0, -1, -2].map((o) => {
  const [y] = currentFY().split("-").map(Number);
  const s = y + o;
  const v = `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
  return { value: v, label: `FY ${v}` };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Statement = Record<string, any>;

function TaxStatement() {
  const [fy, setFy] = useState(currentFY());
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/hrms/payroll/tax-statement?fy=${fy}`).then(async (r) => {
      const json = await r.json();
      if (!r.ok) setError(json.error ?? "Failed to load");
      else setData(json);
    });
  }, [fy]);

  const t = data?.totals ?? {};
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 h-12 border-b">
        <h2 className="text-sm font-medium">Annual salary &amp; TDS statement</h2>
        <div className="flex items-center gap-2">
          <select className="h-8 rounded-md border bg-background px-2 text-sm" value={fy} onChange={(e) => setFy(e.target.value)}>
            {FY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" />Print</Button>
        </div>
      </header>
      {error ? <p className="p-6 text-sm text-muted-foreground">{error}</p> : !data ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="p-4 space-y-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-medium">{data.employee.profiles?.full_name ?? data.employee.employee_code}</p>
              <p className="text-muted-foreground">{data.employee.employee_code} · PAN {data.employee.pan_number ?? "—"}</p>
            </div>
            <p className="text-muted-foreground">Tax regime: <span className="text-foreground capitalize">{data.declaration?.regime ?? "new"}</span></p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-md overflow-hidden">
            {[["Gross salary", t.gross], ["PF (employee)", t.pf], ["Professional tax", t.professional_tax], ["TDS deducted", t.tds]].map(([k, v]) => (
              <div key={k} className="bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold tabular-nums mt-0.5">{fmtINR(v)}</p></div>
            ))}
          </div>
          {data.months.length === 0 ? (
            <p className="text-muted-foreground">No approved payslips in this financial year yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2">Month</th><th className="text-right">Gross</th><th className="text-right">PF</th><th className="text-right">PT</th><th className="text-right">TDS</th><th className="text-right">Net</th>
                </tr></thead>
                <tbody>
                  {data.months.map((s: Statement) => (
                    <tr key={`${s.year}-${s.month}`} className="border-b last:border-0">
                      <td className="py-1.5">{MONTHS[s.month - 1]} {s.year}</td>
                      <td className="text-right tabular-nums">{fmtINR(s.gross_salary)}</td>
                      <td className="text-right tabular-nums">{fmtINR(s.pf_employee)}</td>
                      <td className="text-right tabular-nums">{fmtINR(s.professional_tax)}</td>
                      <td className="text-right tabular-nums">{fmtINR(s.income_tax_tds)}</td>
                      <td className="text-right tabular-nums">{fmtINR(s.net_salary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Summary of salary paid and tax deducted (Form 16 Part B equivalent). The certified Form 16 Part A is issued from the TRACES portal.
          </p>
        </div>
      )}
    </section>
  );
}

export default function TaxPage() {
  return (
    <div className="space-y-8">
      <ResourceManager
        resource="tax-declarations"
        title="Tax & Investments"
        subtitle="Choose your tax regime and declare investments; payroll uses this to compute monthly TDS"
        singular="Declaration"
        tabs={{ field: "status", options: [{ value: "submitted", label: "Submitted" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }] }}
        canEdit={(r, me) => me.isHR || (r.employee_id === me.employeeId && r.status !== "verified")}
        canDelete={(r, me) => me.isHR}
        fields={[
          { name: "employee_id", label: "Employee", type: "employee", hrOnly: true },
          { name: "financial_year", label: "Financial year", type: "select", options: FY_OPTIONS, required: true, defaultValue: currentFY() },
          { name: "regime", label: "Tax regime", type: "select", options: [{ value: "new", label: "New regime (default)" }, { value: "old", label: "Old regime (with deductions)" }], defaultValue: "new" },
          { name: "sec_80c", label: "80C — PF/PPF/ELSS/LIC/tuition (₹, max 1.5L)", type: "number", defaultValue: 0 },
          { name: "sec_80d", label: "80D — health insurance (₹)", type: "number", defaultValue: 0 },
          { name: "sec_80ccd_1b", label: "80CCD(1B) — NPS (₹, max 50k)", type: "number", defaultValue: 0 },
          { name: "home_loan_interest", label: "Home loan interest 24(b) (₹, max 2L)", type: "number", defaultValue: 0 },
          { name: "annual_rent_paid", label: "Annual rent paid — for HRA (₹)", type: "number", defaultValue: 0 },
          { name: "metro_city", label: "Living in a metro city (Delhi, Mumbai, Kolkata, Chennai)", type: "checkbox" },
          { name: "other_deductions", label: "Other deductions (₹)", type: "number", defaultValue: 0 },
          { name: "status", label: "Status", type: "select", options: [{ value: "submitted", label: "Submitted" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }], hrOnly: true },
          { name: "remarks", label: "HR remarks", type: "textarea", hrOnly: true },
        ]}
        columns={[
          { key: "employee", label: "Employee", render: (r) => empName(r) },
          { key: "financial_year", label: "FY" },
          { key: "regime", label: "Regime", render: (r) => <span className="capitalize">{r.regime}</span> },
          { key: "sec_80c", label: "Declared", render: (r) => fmtINR(Number(r.sec_80c) + Number(r.sec_80d) + Number(r.sec_80ccd_1b) + Number(r.home_loan_interest) + Number(r.other_deductions)), className: "hidden md:table-cell" },
          { key: "annual_rent_paid", label: "Rent", render: (r) => fmtINR(r.annual_rent_paid), className: "hidden md:table-cell" },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
        ]}
        actions={[
          { label: "Verify", variant: "default", patch: { status: "verified" }, show: (r, me) => me.isHR && r.status === "submitted" },
          {
            label: "Reject", show: (r, me) => me.isHR && r.status === "submitted",
            patch: () => { const reason = window.prompt("What needs correcting?"); return reason === null ? null : { status: "rejected", remarks: reason }; },
          },
        ]}
      />
      <TaxStatement />
    </div>
  );
}
