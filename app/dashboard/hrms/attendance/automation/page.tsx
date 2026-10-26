"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlayCircle, Info, Loader2, AlertTriangle, UserX, Clock,
  Upload, Download, FileSpreadsheet, Lock, Unlock, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
} from "lucide-react";
import { HRGuard } from "@/components/hrms/hr-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface ProcessingSummary {
  from_date: string;
  to_date: string;
  dates_processed: number;
  employees_processed: number;
  records_created: number;
  records_updated: number;
  exceptions_created: number;
  skipped_future_dates: number;
}

interface AttendanceException {
  id: string;
  date: string;
  exception_type: string;
  status: string;
  description: string | null;
  resolution_note: string | null;
  hr_employees: {
    employee_code: string;
    designation: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
}

interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string | null;
  created_at: string;
  performed_by_profile: { full_name: string; avatar_url: string | null } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function istToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function istYesterday() {
  const [y, m, d] = istToday().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtMinutes(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
}

const EXCEPTION_TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  missing_checkout: { label: "Missing Check-out", icon: Clock },
  auto_marked_absent: { label: "Auto-marked Absent", icon: UserX },
};

const EXCEPTION_STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  ignored: "bg-gray-100 text-gray-600",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  attendance_correction: "Correction",
  attendance_exception: "Exception",
  attendance_processing: "Processing Run",
  attendance_import: "Excel Import",
  attendance_monthly_processing: "Monthly Processing",
  office_location: "Office Location",
  biometric_device: "Biometric Device",
};

const ACTION_STYLE: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  resolved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  ignored: "bg-gray-100 text-gray-600",
  cancelled: "bg-gray-100 text-gray-600",
  closed: "bg-green-100 text-green-700",
  reopened: "bg-amber-100 text-amber-700",
};

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  return (
    <HRGuard>
      <AutomationContent />
    </HRGuard>
  );
}

function AutomationContent() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Automation"
        subtitle="Run automated attendance processing and review flagged exceptions"
      />

      <Tabs defaultValue="process" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="process">Run Processing</TabsTrigger>
          <TabsTrigger value="import">Excel Import</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Processing</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>
        <TabsContent value="process"><ProcessTab /></TabsContent>
        <TabsContent value="import"><ImportTab /></TabsContent>
        <TabsContent value="monthly"><MonthlyProcessingTab /></TabsContent>
        <TabsContent value="exceptions"><ExceptionsTab /></TabsContent>
        <TabsContent value="audit"><AuditTrailTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Run Processing Tab ───────────────────────────────────────────────────

function ProcessTab() {
  const [employees, setEmployees] = useState<{ id: string; label: string }[]>([]);
  const [fromDate, setFromDate] = useState(istYesterday());
  const [toDate, setToDate] = useState(istYesterday());
  const [employeeId, setEmployeeId] = useState("all");
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("hr_employees")
        .select("id, employee_code, profiles(full_name)")
        .eq("status", "active")
        .order("employee_code");
      setEmployees(
        (data ?? []).map((e) => {
          const profile = e.profiles as unknown as { full_name: string } | null;
          return { id: e.id, label: `${profile?.full_name ?? e.employee_code} (${e.employee_code})` };
        })
      );
    })();
  }, []);

  async function run() {
    if (!fromDate || !toDate) { toast.error("Select a date range"); return; }
    if (fromDate > toDate) { toast.error("From date must be on or before to date"); return; }
    setRunning(true);
    setSummary(null);
    try {
      const res = await fetch("/api/hrms/attendance/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
          employee_id: employeeId === "all" ? undefined : employeeId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Processing failed");
      setSummary(json.summary);
      toast.success("Attendance processing completed");
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-indigo-900">What this does</p>
          <p className="text-indigo-700">
            Recalculates late arrival, grace period, early exit, overtime and half-day status for every
            punch in the selected range using the current shift rules, and auto-detects shift &amp; status
            (absent / holiday / weekend / on leave) for days without a punch. Issues such as missing
            check-outs and auto-marked absences are flagged as exceptions for HR review.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={fromDate} max={istYesterday()} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={toDate} max={istYesterday()} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Only past dates are processed (today and future are skipped automatically), up to 31 days per run.
        </p>
        <Button onClick={run} disabled={running} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {running ? "Processing…" : "Run Processing"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Dates Processed" value={String(summary.dates_processed)} />
          <SummaryCard label="Employees" value={String(summary.employees_processed)} />
          <SummaryCard label="Records Created" value={String(summary.records_created)} />
          <SummaryCard label="Records Updated" value={String(summary.records_updated)} />
          <SummaryCard
            label="Exceptions Flagged"
            value={String(summary.exceptions_created)}
            accent={summary.exceptions_created > 0 ? "text-amber-600" : undefined}
          />
          {summary.skipped_future_dates > 0 && (
            <SummaryCard label="Skipped (future)" value={String(summary.skipped_future_dates)} />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className={cn("text-xl font-semibold text-gray-900", accent)}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ── Excel Import Tab ──────────────────────────────────────────────────────

interface ImportRowResult {
  row: number;
  employee_code: string;
  date: string;
  status: "imported" | "skipped" | "error";
  message?: string;
}

interface ImportSummary {
  total_rows: number;
  imported: number;
  skipped: number;
  errors: number;
}

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ summary: ImportSummary; results: ImportRowResult[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) { toast.error("Choose a file to import"); return; }
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/hrms/attendance/import", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(json);
      if (json.summary.errors === 0 && json.summary.skipped === 0) toast.success("Attendance imported successfully");
      else toast.warning(`Imported with ${json.summary.skipped} skipped and ${json.summary.errors} error row(s)`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const problemRows = result?.results.filter((r) => r.status !== "imported") ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-indigo-900">What this does</p>
          <p className="text-indigo-700">
            Bulk-import attendance from an Excel (.xlsx/.xls) or CSV file — useful for backfilling
            records from a legacy system or a manual register. Each row needs an Employee Code and
            Date; Check In / Check Out (HH:MM) and/or a Status are optional. Imported punches are
            automatically reprocessed against the current shift rules to recalculate late, overtime
            and status. Rows for months already closed for payroll, or records locked by an approved
            correction, are skipped.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/hrms/attendance/import">
            <Button variant="outline" type="button" className="gap-2"><Download className="h-4 w-4" />Download Template</Button>
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" type="button" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" />{file ? file.name : "Choose File"}
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Importing…" : "Upload & Import"}
          </Button>
        </div>
        <p className="text-xs text-gray-400">Maximum 2000 rows per file. Dates must not be in the future.</p>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Total Rows" value={String(result.summary.total_rows)} />
            <SummaryCard label="Imported" value={String(result.summary.imported)} accent="text-green-600" />
            <SummaryCard label="Skipped" value={String(result.summary.skipped)} accent={result.summary.skipped > 0 ? "text-amber-600" : undefined} />
            <SummaryCard label="Errors" value={String(result.summary.errors)} accent={result.summary.errors > 0 ? "text-red-600" : undefined} />
          </div>

          {problemRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Row</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee Code</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-4 py-3 text-gray-500">{r.row}</td>
                        <td className="px-4 py-3 text-gray-700">{r.employee_code || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.date || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn("text-[10px]", r.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{r.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Monthly Processing Tab ──────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthlyClosure {
  id: string;
  status: "open" | "closed";
  processed_at: string | null;
  reopened_at: string | null;
}

interface MonthlyPreview {
  employee_count: number;
  total_present: number;
  total_late: number;
  total_half_day: number;
  total_absent: number;
  total_on_leave: number;
  total_unpaid_leave: number;
  total_work_from_home: number;
  total_overtime_minutes: number;
  total_late_minutes: number;
  avg_attendance_percentage: number;
}

interface MonthlyStatus {
  year: number;
  month: number;
  is_elapsed: boolean;
  closure: MonthlyClosure | null;
  preview: MonthlyPreview;
}

function MonthlyProcessingTab() {
  const todayParts = istToday().split("-").map(Number);
  const [year, setYear] = useState(todayParts[0]);
  const [month, setMonth] = useState(todayParts[1]);
  const [data, setData] = useState<MonthlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"close" | "reopen" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrms/attendance/monthly-process?year=${year}&month=${month}`);
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error ?? "Failed to load monthly status");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  async function submitAction() {
    if (!confirmAction) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/hrms/attendance/monthly-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, action: confirmAction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      toast.success(confirmAction === "close" ? "Month closed for payroll" : "Month reopened");
      setConfirmAction(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const isClosed = data?.closure?.status === "closed";
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-indigo-900">What this does</p>
          <p className="text-indigo-700">
            Closing a month runs final attendance processing for every day in it, snapshots a
            summary for payroll, and locks the period — new correction requests and approvals are
            blocked until it&apos;s reopened. Only fully-elapsed months can be closed.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm font-medium text-gray-900 w-36 text-center">{monthLabel}</p>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {!loading && data && (
            isClosed ? (
              <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle2 className="h-3 w-3" />Closed for Payroll</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-600 gap-1"><XCircle className="h-3 w-3" />Open</Badge>
            )
          )}
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard label="Employees" value={String(data.preview.employee_count)} />
              <SummaryCard label="Present" value={String(data.preview.total_present)} />
              <SummaryCard label="Late" value={String(data.preview.total_late)} />
              <SummaryCard label="Half Day" value={String(data.preview.total_half_day)} />
              <SummaryCard label="Absent" value={String(data.preview.total_absent)} />
              <SummaryCard label="On Leave" value={String(data.preview.total_on_leave)} />
              <SummaryCard label="Unpaid Leave Days" value={String(data.preview.total_unpaid_leave)} />
              <SummaryCard label="Work From Home" value={String(data.preview.total_work_from_home)} />
              <SummaryCard label="Avg Attendance %" value={`${data.preview.avg_attendance_percentage}%`} />
              <SummaryCard label="Total Overtime" value={fmtMinutes(data.preview.total_overtime_minutes)} />
              <SummaryCard label="Total Late Time" value={fmtMinutes(data.preview.total_late_minutes)} />
            </div>

            {!data.is_elapsed && !isClosed && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />This month hasn&apos;t fully elapsed yet — it can be closed once it ends.</p>
            )}
            {isClosed && data.closure?.processed_at && (
              <p className="text-xs text-gray-400">Closed on {fmtDateTime(data.closure.processed_at)}</p>
            )}

            <div className="flex gap-2">
              {isClosed ? (
                <Button variant="outline" className="gap-2" onClick={() => setConfirmAction("reopen")}>
                  <Unlock className="h-4 w-4" />Reopen Month
                </Button>
              ) : (
                <Button className="gap-2" disabled={!data.is_elapsed} onClick={() => setConfirmAction("close")}>
                  <Lock className="h-4 w-4" />Close Month for Payroll
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction === "close" ? "Close Month for Payroll" : "Reopen Month"}</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-600">
            {confirmAction === "close" ? (
              <p>
                This will run final attendance processing for <span className="font-medium text-gray-900">{monthLabel}</span>,
                snapshot a summary for payroll, and lock the month — new correction requests and approvals
                will be blocked until it&apos;s reopened. Continue?
              </p>
            ) : (
              <p>
                This will reopen <span className="font-medium text-gray-900">{monthLabel}</span> for corrections.
                You&apos;ll need to close it again once any corrections are made. Continue?
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={submitting}>{submitting ? "Working…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Exceptions Tab ──────────────────────────────────────────────────────────

function ExceptionsTab() {
  const [exceptions, setExceptions] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resolveTarget, setResolveTarget] = useState<{ exception: AttendanceException; action: "resolved" | "ignored" } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("exception_type", typeFilter);
      const res = await fetch(`/api/hrms/attendance/exceptions?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setExceptions(json.exceptions ?? []);
      else toast.error(json.error ?? "Failed to load exceptions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  async function submitResolution() {
    if (!resolveTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hrms/attendance/exceptions/${resolveTarget.exception.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolveTarget.action, resolution_note: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update exception");
      toast.success(resolveTarget.action === "resolved" ? "Exception resolved" : "Exception ignored");
      setResolveTarget(null);
      setNote("");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="missing_checkout">Missing Check-out</SelectItem>
            <SelectItem value="auto_marked_absent">Auto-marked Absent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : exceptions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No exceptions found</td></tr>
              ) : (
                exceptions.map((exc) => {
                  const typeCfg = EXCEPTION_TYPE_CONFIG[exc.exception_type] ?? { label: exc.exception_type.replace(/_/g, " "), icon: AlertTriangle };
                  const Icon = typeCfg.icon;
                  const profile = exc.hr_employees?.profiles;
                  return (
                    <tr key={exc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{exc.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{initials(profile?.full_name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{profile?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{exc.hr_employees?.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] gap-1"><Icon className="h-3 w-3" />{typeCfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500 max-w-[280px]">{exc.description ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={cn("text-[10px]", EXCEPTION_STATUS_STYLE[exc.status] ?? "bg-gray-100 text-gray-600")}>{exc.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {exc.status === "open" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-7" onClick={() => setResolveTarget({ exception: exc, action: "resolved" })}>Resolve</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-gray-500" onClick={() => setResolveTarget({ exception: exc, action: "ignored" })}>Ignore</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{exc.resolution_note ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!resolveTarget} onOpenChange={(o) => { if (!o) { setResolveTarget(null); setNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resolveTarget?.action === "resolved" ? "Resolve Exception" : "Ignore Exception"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {resolveTarget && (
              <p className="text-sm text-gray-500">
                {(EXCEPTION_TYPE_CONFIG[resolveTarget.exception.exception_type]?.label ?? resolveTarget.exception.exception_type)}
                {" "}for{" "}
                <span className="font-medium text-gray-900">{resolveTarget.exception.hr_employees?.profiles?.full_name ?? "—"}</span>
                {" "}on {resolveTarget.exception.date}
              </p>
            )}
            <div>
              <Label>Note (optional)</Label>
              <Textarea placeholder="Add a note about this resolution" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button onClick={submitResolution} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Audit Trail Tab ──────────────────────────────────────────────────────────

function AuditTrailTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (entityFilter !== "all") params.set("entity_type", entityFilter);
      const res = await fetch(`/api/hrms/attendance/biometric/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setLogs(json.audit_logs ?? []);
      else toast.error(json.error ?? "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            {Object.entries(ENTITY_TYPE_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">When</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No activity recorded yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-gray-700">{ENTITY_TYPE_LABELS[log.entity_type] ?? log.entity_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-[10px]", ACTION_STYLE[log.action] ?? "bg-indigo-100 text-indigo-700")}>{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[360px]">{log.description ?? "—"}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={log.performed_by_profile?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px]">{initials(log.performed_by_profile?.full_name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="text-gray-700 text-xs">{log.performed_by_profile?.full_name ?? "System"}</span>
                      </div>
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
