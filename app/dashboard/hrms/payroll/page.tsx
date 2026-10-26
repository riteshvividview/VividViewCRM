"use client";

import { useCallback, useEffect, useState } from "react";
import { IndianRupee, Users, TrendingUp, CheckCircle, PlayCircle, Settings2, Eye, Trash2, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill, fmtINR } from "@/components/hrms/resource-manager";
import { PayslipView, MONTHS } from "@/components/hrms/payslip-view";
import { useShellProfile } from "@/lib/supabase/profile-context";
import MyPayslipsPage from "../payslips/page";

interface PayrollRun {
  id: string; month: number; year: number; status: string;
  total_gross: number; total_deductions: number; total_net: number; employee_count: number; processed_at: string | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slip = Record<string, any>;
type Settings = Record<string, number | boolean>;

const SETTING_FIELDS: { key: string; label: string; type: "number" | "boolean" }[] = [
  { key: "basic_percent", label: "Basic (% of CTC, if not set on employee)", type: "number" },
  { key: "hra_percent", label: "HRA (% of basic)", type: "number" },
  { key: "pf_enabled", label: "Provident Fund (12%)", type: "boolean" },
  { key: "pf_wage_cap", label: "PF wage ceiling (₹)", type: "number" },
  { key: "esi_enabled", label: "ESI (0.75%)", type: "boolean" },
  { key: "esi_gross_limit", label: "ESI gross limit (₹/month)", type: "number" },
  { key: "pt_enabled", label: "Professional Tax", type: "boolean" },
  { key: "pt_amount", label: "PT amount (₹/month)", type: "number" },
  { key: "pt_threshold", label: "PT applies above gross (₹)", type: "number" },
  { key: "tds_enabled", label: "Income tax TDS (new regime)", type: "boolean" },
];

function HrPayroll() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [useAttendance, setUseAttendance] = useState(true);
  const [viewRun, setViewRun] = useState<PayrollRun | null>(null);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [openSlip, setOpenSlip] = useState<Slip | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/hrms/payroll/runs");
    const json = await res.json();
    if (!res.ok) toast.error(json.error);
    setRuns(json.runs ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(url: string, init: RequestInit, key: string, ok: string) {
    setBusy(key);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(ok);
      await load();
      return json;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createRun() {
    const [y, m] = period.split("-").map(Number);
    await call("/api/hrms/payroll/runs", { method: "POST", body: JSON.stringify({ month: m, year: y }) }, "create", `Run for ${MONTHS[m - 1]} ${y} created`);
  }

  async function openRun(run: PayrollRun) {
    setViewRun(run);
    setSlips([]);
    const res = await fetch(`/api/hrms/payroll/payslips?run_id=${run.id}`);
    setSlips((await res.json()).payslips ?? []);
  }

  async function openSettings() {
    const res = await fetch("/api/hrms/payroll/settings");
    setSettings((await res.json()).settings ?? {});
  }

  async function saveSettings() {
    await call("/api/hrms/payroll/settings", { method: "PUT", body: JSON.stringify(settings) }, "settings", "Payroll settings saved");
    setSettings(null);
  }

  const latest = runs[0];
  const paidThisYear = runs.filter((r) => r.status === "approved" && r.year === now.getFullYear()).reduce((s, r) => s + Number(r.total_net), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Process salaries with attendance LOP, PF, ESI, PT, TDS, reimbursements and loan recovery"
        actions={<>
          <Button size="sm" variant="outline" onClick={openSettings}><Settings2 className="h-4 w-4 mr-1.5" />Statutory settings</Button>
        </>}
      />

      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Gross", value: fmtINR(latest.total_gross), icon: IndianRupee },
            { label: "Deductions", value: fmtINR(latest.total_deductions), icon: TrendingUp },
            { label: "Net payout", value: fmtINR(latest.total_net), icon: CheckCircle },
            { label: "Employees", value: latest.employee_count ?? 0, icon: Users },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">{s.label}<s.icon className="h-4 w-4" /></div>
              <p className="text-xl font-bold mt-2">{s.value}</p>
              <p className="text-xs text-muted-foreground">{MONTHS[latest.month - 1]} {latest.year}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-1.5">
          <Label>Pay period</Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-44" />
        </div>
        <Button size="sm" onClick={createRun} disabled={busy === "create"}>New payroll run</Button>
        <label className="flex items-center gap-2 text-sm ml-auto">
          <input type="checkbox" checked={useAttendance} onChange={(e) => setUseAttendance(e.target.checked)} />
          Deduct loss-of-pay from attendance
        </label>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Payroll runs</h3>
          <p className="text-sm text-muted-foreground">Paid this year: {fmtINR(paidThisYear)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <th className="text-left px-5 py-2.5">Period</th><th className="text-left px-5 py-2.5">Employees</th>
              <th className="text-right px-5 py-2.5 hidden md:table-cell">Gross</th><th className="text-right px-5 py-2.5 hidden md:table-cell">Deductions</th>
              <th className="text-right px-5 py-2.5">Net</th><th className="text-left px-5 py-2.5">Status</th><th />
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No payroll runs yet.</td></tr>
              ) : runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0">
                  <td className="px-5 py-2.5 font-medium">{MONTHS[run.month - 1]} {run.year}</td>
                  <td className="px-5 py-2.5">{run.employee_count || "—"}</td>
                  <td className="px-5 py-2.5 text-right hidden md:table-cell">{fmtINR(run.total_gross)}</td>
                  <td className="px-5 py-2.5 text-right hidden md:table-cell text-red-600">{fmtINR(run.total_deductions)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{fmtINR(run.total_net)}</td>
                  <td className="px-5 py-2.5"><StatusPill value={run.status} /></td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {run.status !== "approved" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === run.id}
                          onClick={() => call(`/api/hrms/payroll/runs/${run.id}`, { method: "POST", body: JSON.stringify({ action: "process", use_attendance: useAttendance }) }, run.id, "Payroll processed")}>
                          <PlayCircle className="h-3.5 w-3.5 mr-1" />{run.status === "completed" ? "Re-process" : "Process"}
                        </Button>
                      )}
                      {run.status === "completed" && (
                        <Button size="sm" className="h-7 text-xs" disabled={busy === run.id}
                          onClick={() => window.confirm("Approve and lock this run? Payslips become visible to employees, reimbursements are marked paid and loan EMIs are recovered.") &&
                            call(`/api/hrms/payroll/runs/${run.id}`, { method: "POST", body: JSON.stringify({ action: "approve" }) }, run.id, "Payroll approved")}>
                          Approve
                        </Button>
                      )}
                      {run.employee_count > 0 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="View payslips" onClick={() => openRun(run)}><Eye className="h-3.5 w-3.5" /></Button>
                      )}
                      {run.status !== "approved" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Delete"
                          onClick={() => window.confirm("Delete this run and its payslips?") && call(`/api/hrms/payroll/runs/${run.id}`, { method: "DELETE" }, run.id, "Run deleted")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run payslips */}
      <Dialog open={!!viewRun} onOpenChange={(o) => !o && setViewRun(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Payslips — {viewRun && `${MONTHS[viewRun.month - 1]} ${viewRun.year}`}</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs uppercase text-muted-foreground">
              <th className="text-left py-2">Employee</th><th className="text-right">Paid days</th><th className="text-right">Gross</th><th className="text-right">Deductions</th><th className="text-right">Net</th><th />
            </tr></thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">{s.employee?.profiles?.full_name ?? s.employee?.employee_code}</td>
                  <td className="text-right">{s.days_worked}/{s.days_in_month}</td>
                  <td className="text-right">{fmtINR(s.gross_salary)}</td>
                  <td className="text-right text-red-600">{fmtINR(s.total_deductions)}</td>
                  <td className="text-right font-semibold">{fmtINR(s.net_salary)}</td>
                  <td className="text-right"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpenSlip(s)}>View</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openSlip} onOpenChange={(o) => !o && setOpenSlip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {openSlip && <PayslipView slip={openSlip} />}
          <DialogFooter><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" />Print</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings */}
      <Dialog open={!!settings} onOpenChange={(o) => !o && setSettings(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Statutory & salary settings</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {settings && SETTING_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <Label className="font-normal">{f.label}</Label>
                {f.type === "boolean" ? (
                  <input type="checkbox" checked={!!settings[f.key]} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.checked })} />
                ) : (
                  <Input type="number" className="h-8 w-28" value={String(settings[f.key] ?? "")} onChange={(e) => setSettings({ ...settings, [f.key]: Number(e.target.value) })} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={saveSettings} disabled={busy === "settings"}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PayrollPage() {
  const profile = useShellProfile();
  const isHR = profile?.role === "super_admin" || profile?.role === "hr";
  return isHR ? <HrPayroll /> : <MyPayslipsPage />;
}
