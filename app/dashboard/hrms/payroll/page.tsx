"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, IndianRupee, PlayCircle, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  processed_at: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  approved: "bg-blue-100 text-blue-700",
};

function formatINR(val: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
    if (!profile?.workspace_id) return;
    setWorkspaceId(profile.workspace_id);

    const { data } = await supabase.from("hr_payroll_runs").select("*").eq("workspace_id", profile.workspace_id).order("year", { ascending: false }).order("month", { ascending: false });
    setRuns((data ?? []) as PayrollRun[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createRun() {
    if (!workspaceId) return;
    setCreating(true);
    try {
      const now = new Date();
      const supabase = createClient();
      const { error } = await supabase.from("hr_payroll_runs").insert({
        workspace_id: workspaceId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: "draft",
      });
      if (error) throw error;
      toast.success(`Payroll run for ${MONTHS[now.getMonth()]} ${now.getFullYear()} created`);
      load();
    } catch {
      toast.error("Failed to create payroll run");
    } finally {
      setCreating(false);
    }
  }

  const latest = runs[0];
  const totalPaidThisYear = runs.filter((r) => r.status === "completed" && r.year === new Date().getFullYear()).reduce((s, r) => s + Number(r.total_net), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Monthly salary processing"
        actions={<Button size="sm" onClick={createRun} disabled={creating}><TrendingUp className="h-4 w-4 mr-2" />{creating ? "Creating…" : "New Run"}</Button>}
      />

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Gross Salary", value: formatINR(Number(latest.total_gross)), icon: <IndianRupee className="h-4 w-4" />, color: "bg-blue-50 text-blue-600" },
            { label: "Deductions", value: formatINR(Number(latest.total_deductions)), icon: <TrendingUp className="h-4 w-4" />, color: "bg-red-50 text-red-600" },
            { label: "Net Payout", value: formatINR(Number(latest.total_net)), icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-50 text-green-600" },
            { label: "Employees", value: latest.employee_count, icon: <Users className="h-4 w-4" />, color: "bg-purple-50 text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{s.label}</p>
                <div className={cn("p-1.5 rounded-lg", s.color)}>{s.icon}</div>
              </div>
              <p className="text-xl font-bold text-gray-900 mt-2">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{MONTHS[(latest.month ?? 1) - 1]} {latest.year}</p>
            </div>
          ))}
        </div>
      )}

      {/* Runs list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Payroll Runs</h3>
          <p className="text-sm text-gray-400">Paid this year: {formatINR(totalPaidThisYear)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Employees</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Gross</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Deductions</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net Pay</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i} className="border-b border-gray-50">{[...Array(7)].map((_, j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>)
              ) : runs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No payroll runs yet. Create one to get started.</td></tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{MONTHS[run.month - 1]} {run.year}</td>
                    <td className="px-5 py-3 hidden sm:table-cell text-gray-600">{run.employee_count || "—"}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-right text-gray-700">{run.total_gross ? formatINR(Number(run.total_gross)) : "—"}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-right text-red-600">{run.total_deductions ? formatINR(Number(run.total_deductions)) : "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{run.total_net ? formatINR(Number(run.total_net)) : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[run.status] ?? "bg-gray-100 text-gray-600")}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {run.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <PlayCircle className="h-3.5 w-3.5 mr-1" />Process
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
