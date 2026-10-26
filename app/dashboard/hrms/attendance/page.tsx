"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  LogIn, LogOut, Coffee, Home, PartyPopper, Settings, Fingerprint, Wand2, Map as MapIcon, ClipboardEdit,
  TrendingUp, Download, ListChecks,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

// ── Shared types ────────────────────────────────────────────────────────────

interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  captured_at: string;
  distance_meters: number | null;
  zone: "office" | "remote" | null;
}

interface PunchAttendance {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_location?: PunchLocation | null;
  check_out_location?: PunchLocation | null;
  work_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  early_leave_minutes: number;
  total_break_minutes: number;
  status: string;
  work_mode: string;
}

interface ShiftInfo {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  is_night_shift: boolean;
  is_flexible: boolean;
  working_days: number[];
}

interface BreakRecord {
  id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
}

interface CalendarDay {
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  work_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  total_break_minutes: number;
  is_holiday: boolean;
  holiday_name: string | null;
  is_weekend: boolean;
  shift: { id: string; name: string; code: string } | null;
}

interface TeamRecord {
  id: string;
  employee_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  work_minutes: number;
  late_minutes: number | null;
  work_mode: string | null;
  hr_shifts: { code: string } | null;
  hr_employees: {
    employee_code: string;
    designation: string;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
}

interface AttendanceCorrection {
  id: string;
  employee_id: string;
  date: string;
  field: string;
  old_value: string | null;
  new_value: string;
  reason: string;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  hr_employees: {
    employee_code: string;
    designation: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
}

interface ReportRow {
  employee: {
    id: string;
    employee_code: string;
    designation: string | null;
    department: { id: string | null; name: string } | null;
    profile: { full_name: string; avatar_url: string | null } | null;
  };
  counts: Record<string, number>;
  working_days: number;
  present_days: number;
  attendance_percentage: number;
  total_work_minutes: number;
  total_overtime_minutes: number;
  total_late_minutes: number;
}

// ── Analytics shared types ───────────────────────────────────────────────────

interface DailyTrendPoint {
  date: string;
  present: number;
  late: number;
  half_day: number;
  absent: number;
  on_leave: number;
  work_from_home: number;
  holiday: number;
  weekend: number;
}

interface DepartmentBreakdown {
  department_id: string | null;
  department_name: string;
  employee_count: number;
  attendance_percentage: number;
}

interface LatecomerRow {
  employee: ReportRow["employee"];
  late_count: number;
  total_late_minutes: number;
}

interface ComplianceRecord {
  employee: ReportRow["employee"];
  date: string;
  status: string;
  late_minutes: number;
  is_regularized: boolean;
}

interface PayrollRow {
  employee: ReportRow["employee"];
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  half_day_count: number;
  late_count: number;
  lop_days: number;
  payable_days: number;
  overtime_hours: number;
  attendance_percentage: number;
}

interface AnalyticsSummary {
  employee_count: number;
  avg_attendance_percentage: number;
  total_present: number;
  total_late: number;
  total_half_day: number;
  total_absent: number;
  total_on_leave: number;
  total_work_from_home: number;
  total_late_minutes: number;
  total_overtime_minutes: number;
}

interface AnalyticsResponse {
  year: number;
  month: number;
  scope: "workspace" | "team";
  summary: AnalyticsSummary;
  daily_trend: DailyTrendPoint[];
  department_breakdown: DepartmentBreakdown[];
  top_latecomers: LatecomerRow[];
  reports: ReportRow[];
  compliance_records: ComplianceRecord[];
}

// ── Shared constants / helpers ─────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  present: { label: "Present", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-50" },
  late: { label: "Late", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-yellow-600 bg-yellow-50" },
  half_day: { label: "Half Day", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-orange-600 bg-orange-50" },
  work_from_home: { label: "WFH", icon: <Home className="h-3.5 w-3.5" />, color: "text-purple-600 bg-purple-50" },
  on_leave: { label: "On Leave", icon: <Clock className="h-3.5 w-3.5" />, color: "text-blue-600 bg-blue-50" },
  holiday: { label: "Holiday", icon: <PartyPopper className="h-3.5 w-3.5" />, color: "text-pink-600 bg-pink-50" },
  weekend: { label: "Weekend", icon: <Coffee className="h-3.5 w-3.5" />, color: "text-gray-500 bg-gray-100" },
  absent: { label: "Absent", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-600 bg-red-50" },
};

function istToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function currentISTMonth() {
  const [y, m] = istToday().split("-").map(Number);
  return { year: y, month: m };
}

function fmtTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

function fmtMinutes(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
}

function fmtTimeOfDay(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const pad = (n: number) => String(n).padStart(2, "0");

const STATUS_CHART_COLORS: Record<string, string> = {
  present: "#22c55e",
  late: "#eab308",
  half_day: "#f97316",
  work_from_home: "#a855f7",
  on_leave: "#3b82f6",
  absent: "#ef4444",
};

/** Triggers a client-side CSV download from tabular data. */
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Corrections shared constants / helpers ─────────────────────────────────

const CORRECTION_FIELD_LABELS: Record<string, string> = {
  check_in: "Check-in Time",
  check_out: "Check-out Time",
  status: "Status",
  work_mode: "Work Mode",
};

const CORRECTION_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function fmtCorrectionValue(field: string, value: string | null) {
  if (value === null || value === "") return "—";
  if (field === "status") return STATUS_CONFIG[value]?.label ?? value;
  if (field === "work_mode") return value === "work_from_home" ? "Work From Home" : "Office";
  return value;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [role, setRole] = useState<UserRole>("employee");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const isHRLevel = role === "super_admin" || role === "hr";
  const isTeamLead = role === "team_lead";

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingProfile(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
      if (profile?.role) setRole(profile.role as UserRole);

      const { data: emp } = await supabase.from("hr_employees").select("id").eq("user_id", user.id).maybeSingle();
      setEmployeeId(emp?.id ?? null);

      setLoadingProfile(false);
    })();
  }, []);

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" subtitle="Loading…" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Punches, shifts, calendar and team attendance"
        actions={isHRLevel && (
          <div className="flex gap-2">
            <Link href="/dashboard/hrms/attendance/shifts">
              <Button variant="outline" size="sm" className="gap-2"><Settings className="h-4 w-4" />Manage Shifts</Button>
            </Link>
            <Link href="/dashboard/hrms/attendance/biometric">
              <Button variant="outline" size="sm" className="gap-2"><Fingerprint className="h-4 w-4" />Biometric Devices</Button>
            </Link>
            <Link href="/dashboard/hrms/attendance/automation">
              <Button variant="outline" size="sm" className="gap-2"><Wand2 className="h-4 w-4" />Automation</Button>
            </Link>
            <Link href="/dashboard/hrms/attendance/map">
              <Button variant="outline" size="sm" className="gap-2"><MapIcon className="h-4 w-4" />Attendance Map</Button>
            </Link>
          </div>
        )}
      />

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="my">My Attendance</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          {isHRLevel && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
          {(isHRLevel || isTeamLead) && <TabsTrigger value="team">{isTeamLead ? "Team Attendance" : "Team"}</TabsTrigger>}
          {(isHRLevel || isTeamLead) && <TabsTrigger value="corrections">Corrections</TabsTrigger>}
          {isHRLevel && <TabsTrigger value="reports">Reports</TabsTrigger>}
        </TabsList>

        <TabsContent value="my">
          <MyAttendanceTab employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarTab employeeId={employeeId} isHRLevel={isHRLevel} />
        </TabsContent>

        {isHRLevel && (
          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>
        )}

        {(isHRLevel || isTeamLead) && (
          <TabsContent value="team">
            <TeamTab isTeamLead={isTeamLead} />
          </TabsContent>
        )}

        {(isHRLevel || isTeamLead) && (
          <TabsContent value="corrections">
            <CorrectionsTab isHRLevel={isHRLevel} />
          </TabsContent>
        )}

        {isHRLevel && (
          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── My Attendance Tab ───────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  check_in: "Checked in successfully",
  check_out: "Checked out successfully",
  break_start: "Break started",
  break_end: "Break ended",
};

interface PunchCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/** Best-effort GPS capture. Resolves to null on denial/timeout/unsupported — punch always proceeds. */
function getCurrentCoordinates(): Promise<PunchCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function MyAttendanceTab({ employeeId }: { employeeId: string | null }) {
  const [data, setData] = useState<{ attendance: PunchAttendance | null; shift: ShiftInfo | null; active_break: BreakRecord | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/attendance/punch");
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error ?? "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (employeeId) load(); else setLoading(false); }, [employeeId, load]);

  async function act(action: string) {
    setActing(true);
    try {
      const location = action === "check_in" || action === "check_out" ? await getCurrentCoordinates() : null;
      const res = await fetch("/api/hrms/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, location }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Action failed"); return; }
      toast.success(ACTION_LABEL[action] ?? "Done");

      const locationField = action === "check_in" ? "check_in_location" : action === "check_out" ? "check_out_location" : null;
      if (locationField && json.attendance?.[locationField]?.zone === "remote") {
        toast.info("Marked as Remote Attendance — you're outside the office area");
      }

      await load();
    } finally {
      setActing(false);
    }
  }

  if (!employeeId) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
        No employee record is linked to your account yet. Contact HR.
      </div>
    );
  }

  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const attendance = data?.attendance;
  const shift = data?.shift;
  const activeBreak = data?.active_break;
  const sc = STATUS_CONFIG[attendance?.status ?? "absent"];

  const hasCheckedIn = !!attendance?.check_in;
  const hasCheckedOut = !!attendance?.check_out;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })}
            </p>
            {shift && (
              <p className="text-xs text-gray-400 mt-1">
                Shift: {shift.name}{" "}
                {shift.is_flexible ? "(Flexible)" : `(${fmtTimeOfDay(shift.start_time)} – ${fmtTimeOfDay(shift.end_time)})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            {(attendance?.check_in_location?.zone === "remote" || attendance?.check_out_location?.zone === "remote") && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-600">
                <Home className="h-3.5 w-3.5" />Remote
              </div>
            )}
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium", sc.color)}>
              {sc.icon}{sc.label}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <InfoBlock label="Check In" value={fmtTime(attendance?.check_in ?? null)} />
          <InfoBlock label="Check Out" value={fmtTime(attendance?.check_out ?? null)} />
          <InfoBlock label="Worked" value={attendance?.work_minutes ? fmtMinutes(attendance.work_minutes) : "—"} />
          <InfoBlock
            label="Break"
            value={activeBreak ? "In progress" : attendance?.total_break_minutes ? fmtMinutes(attendance.total_break_minutes) : "—"}
          />
        </div>

        {(attendance?.late_minutes ?? 0) > 0 && (
          <p className="text-xs text-yellow-600 mt-3">Late by {attendance!.late_minutes} minute{attendance!.late_minutes === 1 ? "" : "s"}</p>
        )}
        {(attendance?.overtime_minutes ?? 0) > 0 && (
          <p className="text-xs text-indigo-600 mt-1">Overtime: {fmtMinutes(attendance!.overtime_minutes)}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {!hasCheckedIn && (
            <Button onClick={() => act("check_in")} disabled={acting} className="gap-2">
              <LogIn className="h-4 w-4" />Check In
            </Button>
          )}
          {hasCheckedIn && !hasCheckedOut && !activeBreak && (
            <Button variant="outline" onClick={() => act("break_start")} disabled={acting} className="gap-2">
              <Coffee className="h-4 w-4" />Start Break
            </Button>
          )}
          {hasCheckedIn && !hasCheckedOut && activeBreak && (
            <Button variant="outline" onClick={() => act("break_end")} disabled={acting} className="gap-2">
              <Coffee className="h-4 w-4" />End Break
            </Button>
          )}
          {hasCheckedIn && !hasCheckedOut && (
            <Button variant="destructive" onClick={() => act("check_out")} disabled={acting} className="gap-2">
              <LogOut className="h-4 w-4" />Check Out
            </Button>
          )}
          {hasCheckedOut && (
            <p className="text-sm text-gray-500 self-center">You&apos;ve completed your attendance for today.</p>
          )}
        </div>
      </div>

      <MyCorrectionsSection employeeId={employeeId} />
    </div>
  );
}

// ── My Correction Requests ───────────────────────────────────────────────────

function MyCorrectionsSection({ employeeId }: { employeeId: string }) {
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(istToday());
  const [field, setField] = useState("status");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/attendance/corrections?status=all");
      const json = await res.json();
      if (res.ok) setCorrections(json.corrections ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDialog() {
    setDate(istToday());
    setField("status");
    setValue("");
    setReason("");
    setOpen(true);
  }

  async function submit() {
    if (!value) { toast.error("Select a value to request"); return; }
    if (!reason.trim()) { toast.error("Please provide a reason"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/hrms/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, field, requested_value: value, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit request");
      toast.success("Correction request submitted");
      setOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(id: string) {
    const res = await fetch(`/api/hrms/attendance/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed to cancel request"); return; }
    toast.success("Request cancelled");
    load();
  }

  if (!employeeId) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">My Correction Requests</h3>
        <Button size="sm" variant="outline" className="gap-2" onClick={openDialog}>
          <ClipboardEdit className="h-4 w-4" />Request Correction
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Field</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Change</th>
              <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(2)].map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {[...Array(5)].map((_, j) => <td key={j} className="px-2 py-2"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : corrections.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No correction requests yet</td></tr>
            ) : (
              corrections.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{c.date}</td>
                  <td className="px-2 py-2 text-gray-700">{CORRECTION_FIELD_LABELS[c.field] ?? c.field}</td>
                  <td className="px-2 py-2 hidden sm:table-cell text-gray-500">
                    {fmtCorrectionValue(c.field, c.old_value)} → {fmtCorrectionValue(c.field, c.new_value)}
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={cn("text-[10px]", CORRECTION_STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600")}>{c.status}</Badge>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {c.status === "pending" ? (
                      <Button variant="ghost" size="sm" className="h-7 text-gray-500" onClick={() => cancelRequest(c.id)}>Cancel</Button>
                    ) : (
                      <span className="text-xs text-gray-400">{c.review_note ?? "—"}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Attendance Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Field</Label>
              <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CORRECTION_FIELD_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Requested Value</Label>
              {(field === "check_in" || field === "check_out") && (
                <Input type="time" value={value} onChange={(e) => setValue(e.target.value)} />
              )}
              {field === "status" && (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field === "work_mode" && (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger><SelectValue placeholder="Select work mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="work_from_home">Work From Home</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea placeholder="Explain why this correction is needed" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit Request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Calendar Tab ────────────────────────────────────────────────────────────

function CalendarTab({ employeeId, isHRLevel }: { employeeId: string | null; isHRLevel: boolean }) {
  const [employees, setEmployees] = useState<{ id: string; label: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [month, setMonth] = useState(currentISTMonth());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) setSelectedEmployee(employeeId);
  }, [employeeId]);

  useEffect(() => {
    if (!isHRLevel) return;
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
  }, [isHRLevel]);

  const load = useCallback(async () => {
    if (!selectedEmployee) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/hrms/attendance/calendar?employee_id=${selectedEmployee}&year=${month.year}&month=${month.month}`);
      const json = await res.json();
      if (res.ok) setDays(json.days ?? []);
      else toast.error(json.error ?? "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, month]);

  useEffect(() => { load(); }, [load]);

  if (!selectedEmployee && !isHRLevel) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
        No employee record is linked to your account yet. Contact HR.
      </div>
    );
  }

  const cur = currentISTMonth();
  const isCurrentMonth = month.year === cur.year && month.month === cur.month;
  const firstDayOffset = new Date(`${month.year}-${pad(month.month)}-01T00:00:00Z`).getUTCDay();

  const counts: Record<string, number> = {};
  for (const d of days) counts[d.status] = (counts[d.status] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month - 2, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-900 w-28 text-center">{MONTHS[month.month - 1]} {month.year}</span>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isHRLevel && employees.length > 0 && (
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {!loading && days.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(counts).map(([status, count]) => {
            const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.absent;
            return (
              <span key={status} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium", sc.color)}>
                {sc.icon}{sc.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] sm:text-xs font-semibold text-gray-400 py-1 uppercase">{w}</div>
            ))}
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map((day) => {
              const sc = STATUS_CONFIG[day.status] ?? STATUS_CONFIG.absent;
              const [textCls, bgCls] = sc.color.split(" ");
              const dayNum = Number(day.date.split("-")[2]);
              const isToday = day.date === istToday();
              return (
                <div
                  key={day.date}
                  className={cn("rounded-lg border p-1 sm:p-1.5 min-h-[58px] sm:min-h-[80px] flex flex-col gap-1", bgCls, isToday ? "ring-2 ring-indigo-400 border-indigo-200" : "border-gray-100")}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs sm:text-sm font-semibold", textCls)}>{dayNum}</span>
                    {day.shift && <span className="text-[9px] text-gray-400 hidden sm:inline">{day.shift.code}</span>}
                  </div>
                  <div className="mt-auto">
                    <span className={cn("inline-flex items-center gap-0.5 text-[9px] sm:text-[11px] font-medium", textCls)}>
                      {sc.icon}<span className="hidden sm:inline">{sc.label}</span>
                    </span>
                    {day.check_in && (
                      <p className="text-[9px] text-gray-400 mt-0.5 hidden sm:block">
                        {fmtTime(day.check_in)}{day.check_out ? ` – ${fmtTime(day.check_out)}` : ""}
                      </p>
                    )}
                    {day.is_holiday && day.holiday_name && (
                      <p className="text-[9px] text-pink-500 mt-0.5 truncate hidden sm:block" title={day.holiday_name}>{day.holiday_name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared analytics widgets (KPI cards, charts) ─────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={cn("rounded-xl p-4", color)}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function AttendanceTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const chartData = data.map((d) => ({ ...d, day: String(Number(d.date.split("-")[2])) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="present" stackId="a" fill={STATUS_CHART_COLORS.present} name="Present" />
        <Bar dataKey="late" stackId="a" fill={STATUS_CHART_COLORS.late} name="Late" />
        <Bar dataKey="half_day" stackId="a" fill={STATUS_CHART_COLORS.half_day} name="Half Day" />
        <Bar dataKey="work_from_home" stackId="a" fill={STATUS_CHART_COLORS.work_from_home} name="WFH" />
        <Bar dataKey="on_leave" stackId="a" fill={STATUS_CHART_COLORS.on_leave} name="On Leave" />
        <Bar dataKey="absent" stackId="a" fill={STATUS_CHART_COLORS.absent} name="Absent" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DepartmentBreakdownChart({ data }: { data: DepartmentBreakdown[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="department_name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={96} />
        <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
        <Bar dataKey="attendance_percentage" fill="#6366f1" radius={[0, 4, 4, 0]} name="Attendance %" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Dashboard Tab (HR Attendance Dashboard + Analytics) ──────────────────────

function DashboardTab() {
  const [month, setMonth] = useState(currentISTMonth());
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("hr_departments").select("id, name").order("name");
      setDepartments(data ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(month.year), month: String(month.month) });
      if (departmentId !== "all") params.set("department_id", departmentId);
      const res = await fetch(`/api/hrms/attendance/analytics?${params}`);
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [month, departmentId]);

  useEffect(() => { load(); }, [load]);

  const cur = currentISTMonth();
  const isCurrentMonth = month.year === cur.year && month.month === cur.month;

  function exportTrendCSV() {
    if (!data) return;
    downloadCSV(
      `attendance-trend-${data.year}-${pad(data.month)}.csv`,
      ["Date", "Present", "Late", "Half Day", "Absent", "On Leave", "WFH", "Holiday", "Weekend"],
      data.daily_trend.map((d) => [d.date, d.present, d.late, d.half_day, d.absent, d.on_leave, d.work_from_home, d.holiday, d.weekend])
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month - 2, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-900 w-28 text-center">{MONTHS[month.month - 1]} {month.year}</span>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportTrendCSV} disabled={!data || loading}>
            <Download className="h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Avg Attendance" value={`${data.summary.avg_attendance_percentage}%`} color="text-indigo-700 bg-indigo-50" />
            <KpiCard label="Present" value={data.summary.total_present} color="text-green-700 bg-green-50" />
            <KpiCard label="Late" value={data.summary.total_late} color="text-yellow-700 bg-yellow-50" />
            <KpiCard label="Half Day" value={data.summary.total_half_day} color="text-orange-700 bg-orange-50" />
            <KpiCard label="Absent" value={data.summary.total_absent} color="text-red-700 bg-red-50" />
            <KpiCard label="On Leave" value={data.summary.total_on_leave} color="text-blue-700 bg-blue-50" />
            <KpiCard label="Work From Home" value={data.summary.total_work_from_home} color="text-purple-700 bg-purple-50" />
            <KpiCard label="Overtime" value={fmtMinutes(data.summary.total_overtime_minutes)} color="text-gray-700 bg-gray-100" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />Daily Attendance Trend
            </p>
            {data.daily_trend.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">No attendance data for this month yet</p>
            ) : (
              <AttendanceTrendChart data={data.daily_trend} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Department-wise Attendance</p>
              {data.department_breakdown.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm">No department data available</p>
              ) : (
                <DepartmentBreakdownChart data={data.department_breakdown} />
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />Top Latecomers
              </p>
              {data.top_latecomers.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No late check-ins this month</p>
              ) : (
                <div className="space-y-3">
                  {data.top_latecomers.map((l, i) => (
                    <div key={l.employee.id} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-400 w-4">{i + 1}</span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={l.employee.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs bg-yellow-100 text-yellow-700">{initials(l.employee.profile?.full_name ?? "?")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{l.employee.profile?.full_name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{l.late_count} late {l.late_count === 1 ? "day" : "days"}</p>
                      </div>
                      <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full whitespace-nowrap">{fmtMinutes(l.total_late_minutes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Team Tab ────────────────────────────────────────────────────────────────

function TeamTab({ isTeamLead }: { isTeamLead: boolean }) {
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(istToday());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) { setLoading(false); return; }

      const { data } = await supabase
        .from("hr_attendance")
        .select("id, employee_id, status, check_in, check_out, work_minutes, late_minutes, work_mode, hr_shifts(code), hr_employees(employee_code, designation, profiles(full_name, avatar_url))")
        .eq("workspace_id", profile.workspace_id)
        .eq("date", selectedDate)
        .order("check_in", { ascending: true });

      setRecords((data ?? []) as unknown as TeamRecord[]);
      setLoading(false);
    })();
  }, [selectedDate]);

  function shiftDate(d: number) {
    const date = new Date(`${selectedDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    setSelectedDate(date.toISOString().split("T")[0]);
  }

  const summary: Record<string, number> = {};
  for (const r of records) summary[r.status] = (summary[r.status] ?? 0) + 1;

  const cards = [
    { key: "present", label: "Present", color: "text-green-700 bg-green-50" },
    { key: "absent", label: "Absent", color: "text-red-700 bg-red-50" },
    { key: "late", label: "Late", color: "text-yellow-700 bg-yellow-50" },
    { key: "on_leave", label: "On Leave", color: "text-blue-700 bg-blue-50" },
    { key: "half_day", label: "Half Day", color: "text-orange-700 bg-orange-50" },
    { key: "work_from_home", label: "WFH", color: "text-purple-700 bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)} disabled={selectedDate >= istToday()}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {selectedDate === istToday() && <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Today</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((s) => (
          <div key={s.key} className={cn("rounded-xl p-4", s.color)}>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{loading ? "—" : (summary[s.key] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check In</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check Out</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Hours</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No attendance records for this date</td></tr>
              ) : (
                records.map((r) => {
                  const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.absent;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.hr_employees?.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                              {initials(r.hr_employees?.profiles?.full_name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{r.hr_employees?.profiles?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{r.hr_employees?.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{r.hr_shifts?.code ?? "—"}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{fmtTime(r.check_in)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{fmtTime(r.check_out)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{fmtMinutes(r.work_minutes)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sc.color)}>
                          {sc.icon}{sc.label}
                        </span>
                        {r.status === "late" && r.late_minutes ? (
                          <span className="text-[10px] text-gray-400 ml-1">+{r.late_minutes}m</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isTeamLead && <TeamMonthlySummary />}
    </div>
  );
}

// ── Team Monthly Summary (Team Attendance Dashboard for team_lead) ──────────

function TeamMonthlySummary() {
  const [month, setMonth] = useState(currentISTMonth());
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrms/attendance/analytics?year=${month.year}&month=${month.month}`);
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error ?? "Failed to load monthly summary");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const cur = currentISTMonth();
  const isCurrentMonth = month.year === cur.year && month.month === cur.month;

  function exportCSV() {
    if (!data) return;
    downloadCSV(
      `team-attendance-${data.year}-${pad(data.month)}.csv`,
      ["Employee", "Employee Code", "Present", "Late", "Half Day", "Absent", "On Leave", "WFH", "Attendance %"],
      data.reports.map((r) => [
        r.employee.profile?.full_name ?? "—",
        r.employee.employee_code,
        r.counts.present ?? 0,
        r.counts.late ?? 0,
        r.counts.half_day ?? 0,
        r.counts.absent ?? 0,
        r.counts.on_leave ?? 0,
        r.counts.work_from_home ?? 0,
        r.attendance_percentage,
      ])
    );
  }

  return (
    <div className="space-y-4 pt-2 border-t border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Team Monthly Summary</h3>
          <p className="text-xs text-gray-400">Attendance trends and per-member breakdown for your team</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month - 2, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-900 w-28 text-center">{MONTHS[month.month - 1]} {month.year}</span>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={!data || loading}>
            <Download className="h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Avg Attendance" value={`${data.summary.avg_attendance_percentage}%`} color="text-indigo-700 bg-indigo-50" />
            <KpiCard label="Late Instances" value={data.summary.total_late} color="text-yellow-700 bg-yellow-50" />
            <KpiCard label="Absences" value={data.summary.total_absent} color="text-red-700 bg-red-50" />
            <KpiCard label="WFH Days" value={data.summary.total_work_from_home} color="text-purple-700 bg-purple-50" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Daily Attendance Trend</p>
            <AttendanceTrendChart data={data.daily_trend} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Present</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Late</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Absent</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reports.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No team members found</td></tr>
                  ) : (
                    data.reports.map((r) => (
                      <tr key={r.employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={r.employee.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">{initials(r.employee.profile?.full_name ?? "?")}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{r.employee.profile?.full_name ?? "—"}</p>
                              <p className="text-xs text-gray-400">{r.employee.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-green-700 font-medium">{r.counts.present ?? 0}</td>
                        <td className="px-3 py-3 text-center text-yellow-700 font-medium">{r.counts.late ?? 0}</td>
                        <td className="px-3 py-3 text-center text-red-700 font-medium hidden sm:table-cell">{r.counts.absent ?? 0}</td>
                        <td className="px-4 py-3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <Progress value={r.attendance_percentage} className="h-2 flex-1" />
                            <span className="text-xs font-medium text-gray-600 w-12 text-right">{r.attendance_percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Corrections Tab (HR: approve/reject; Team Lead: read-only) ──────────────

function CorrectionsTab({ isHRLevel }: { isHRLevel: boolean }) {
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewTarget, setReviewTarget] = useState<{ correction: AttendanceCorrection; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrms/attendance/corrections?status=${statusFilter}`);
      const json = await res.json();
      if (res.ok) setCorrections(json.corrections ?? []);
      else toast.error(json.error ?? "Failed to load corrections");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function submitReview() {
    if (!reviewTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hrms/attendance/corrections/${reviewTarget.correction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: reviewTarget.action, review_note: note || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update request");
      toast.success(reviewTarget.action === "approve" ? "Correction approved" : "Correction rejected");
      setReviewTarget(null);
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="all">All</SelectItem>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Field</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Change</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : corrections.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No correction requests found</td></tr>
              ) : (
                corrections.map((c) => {
                  const profile = c.hr_employees?.profiles;
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{initials(profile?.full_name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{profile?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{c.hr_employees?.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{CORRECTION_FIELD_LABELS[c.field] ?? c.field}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                        {fmtCorrectionValue(c.field, c.old_value)} → {fmtCorrectionValue(c.field, c.new_value)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 max-w-[240px] truncate" title={c.reason}>{c.reason}</td>
                      <td className="px-4 py-3">
                        <Badge className={cn("text-[10px]", CORRECTION_STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600")}>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === "pending" && isHRLevel ? (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-7" onClick={() => setReviewTarget({ correction: c, action: "approve" })}>Approve</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={() => setReviewTarget({ correction: c, action: "reject" })}>Reject</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{c.review_note ?? "—"}</span>
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

      <Dialog open={!!reviewTarget} onOpenChange={(o) => { if (!o) { setReviewTarget(null); setNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewTarget?.action === "approve" ? "Approve Correction" : "Reject Correction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {reviewTarget && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">{reviewTarget.correction.hr_employees?.profiles?.full_name ?? "—"}</span>
                  {" "}— {CORRECTION_FIELD_LABELS[reviewTarget.correction.field]} on {reviewTarget.correction.date}
                </p>
                <p className="text-gray-500">
                  {fmtCorrectionValue(reviewTarget.correction.field, reviewTarget.correction.old_value)} → {fmtCorrectionValue(reviewTarget.correction.field, reviewTarget.correction.new_value)}
                </p>
                <p className="text-gray-400 italic">&ldquo;{reviewTarget.correction.reason}&rdquo;</p>
              </div>
            )}
            <div>
              <Label>Note (optional)</Label>
              <Textarea placeholder="Add a note about this decision" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reports Tab ─────────────────────────────────────────────────────────────

function ReportsTab() {
  const [month, setMonth] = useState(currentISTMonth());
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [view, setView] = useState<"summary" | "compliance" | "payroll">("summary");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [payrollClosure, setPayrollClosure] = useState<{ status: string; processed_at: string | null }>({ status: "not_processed", processed_at: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("hr_departments").select("id, name").order("name");
      setDepartments(data ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(month.year), month: String(month.month) });
      if (departmentId !== "all") params.set("department_id", departmentId);
      if (view === "summary") {
        const res = await fetch(`/api/hrms/attendance/reports?${params}`);
        const json = await res.json();
        if (res.ok) setReports(json.reports ?? []);
        else toast.error(json.error ?? "Failed to load report");
      } else if (view === "compliance") {
        const res = await fetch(`/api/hrms/attendance/analytics?${params}`);
        const json = await res.json();
        if (res.ok) setComplianceRecords(json.compliance_records ?? []);
        else toast.error(json.error ?? "Failed to load compliance report");
      } else {
        const res = await fetch(`/api/hrms/attendance/payroll-export?${params}`);
        const json = await res.json();
        if (res.ok) {
          setPayrollRows(json.rows ?? []);
          setPayrollClosure({ status: json.closure_status, processed_at: json.processed_at });
        } else toast.error(json.error ?? "Failed to load payroll data");
      }
    } finally {
      setLoading(false);
    }
  }, [month, departmentId, view]);

  useEffect(() => { load(); }, [load]);

  const cur = currentISTMonth();
  const isCurrentMonth = month.year === cur.year && month.month === cur.month;

  function exportCSV() {
    if (view === "summary") {
      downloadCSV(
        `attendance-summary-${month.year}-${pad(month.month)}.csv`,
        ["Employee", "Employee Code", "Department", "Present", "Late", "Half Day", "Absent", "On Leave", "WFH", "OT (mins)", "Attendance %", "Present Days", "Working Days"],
        reports.map((r) => [
          r.employee.profile?.full_name ?? "—",
          r.employee.employee_code,
          r.employee.department?.name ?? "",
          r.counts.present ?? 0,
          r.counts.late ?? 0,
          r.counts.half_day ?? 0,
          r.counts.absent ?? 0,
          r.counts.on_leave ?? 0,
          r.counts.work_from_home ?? 0,
          r.total_overtime_minutes,
          r.attendance_percentage,
          r.present_days,
          r.working_days,
        ])
      );
    } else if (view === "compliance") {
      downloadCSV(
        `attendance-compliance-${month.year}-${pad(month.month)}.csv`,
        ["Date", "Employee", "Employee Code", "Status", "Late Minutes", "Regularized"],
        complianceRecords.map((c) => [
          c.date,
          c.employee.profile?.full_name ?? "—",
          c.employee.employee_code,
          STATUS_CONFIG[c.status]?.label ?? c.status,
          c.late_minutes,
          c.is_regularized ? "Yes" : "No",
        ])
      );
    } else {
      downloadCSV(
        `attendance-payroll-${month.year}-${pad(month.month)}.csv`,
        ["Employee", "Employee Code", "Department", "Working Days", "Present Days", "Paid Leave", "Unpaid Leave", "Half Days", "Late Count", "LOP Days", "Payable Days", "OT Hours", "Attendance %"],
        payrollRows.map((r) => [
          r.employee.profile?.full_name ?? "—",
          r.employee.employee_code,
          r.employee.department?.name ?? "",
          r.working_days,
          r.present_days,
          r.paid_leave_days,
          r.unpaid_leave_days,
          r.half_day_count,
          r.late_count,
          r.lop_days,
          r.payable_days,
          r.overtime_hours,
          r.attendance_percentage,
        ])
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month - 2, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-900 w-28 text-center">{MONTHS[month.month - 1]} {month.year}</span>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setView("summary")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", view === "summary" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setView("compliance")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", view === "compliance" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              Late &amp; Absence Detail
            </button>
            <button
              type="button"
              onClick={() => setView("payroll")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", view === "payroll" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              Payroll
            </button>
          </div>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={exportCSV}
            disabled={loading || (view === "summary" ? reports.length === 0 : view === "compliance" ? complianceRecords.length === 0 : payrollRows.length === 0)}
          >
            <Download className="h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      {view === "summary" ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Present</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Late</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Half Day</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Absent</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">On Leave</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">OT Hrs</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : reports.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No employees found</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.employee.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                              {initials(r.employee.profile?.full_name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{r.employee.profile?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{r.employee.department?.name ?? r.employee.designation ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-green-700 font-medium">{r.counts.present ?? 0}</td>
                      <td className="px-3 py-3 text-center text-yellow-700 font-medium">{r.counts.late ?? 0}</td>
                      <td className="px-3 py-3 text-center text-orange-700 font-medium hidden sm:table-cell">{r.counts.half_day ?? 0}</td>
                      <td className="px-3 py-3 text-center text-red-700 font-medium">{r.counts.absent ?? 0}</td>
                      <td className="px-3 py-3 text-center text-blue-700 font-medium hidden sm:table-cell">{r.counts.on_leave ?? 0}</td>
                      <td className="px-3 py-3 text-center text-indigo-700 font-medium hidden md:table-cell">{fmtMinutes(r.total_overtime_minutes)}</td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={r.attendance_percentage} className="h-2 flex-1" />
                          <span className="text-xs font-medium text-gray-600 w-12 text-right">{r.attendance_percentage}%</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.present_days}/{r.working_days} days</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === "compliance" ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Late By</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Regularized</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : complianceRecords.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">No late, half-day or absence records this month</td></tr>
                ) : (
                  complianceRecords.map((c, i) => {
                    const cfg = STATUS_CONFIG[c.status];
                    return (
                      <tr key={`${c.employee.id}-${c.date}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{new Date(c.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={c.employee.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">{initials(c.employee.profile?.full_name ?? "?")}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{c.employee.profile?.full_name ?? "—"}</p>
                              <p className="text-xs text-gray-400">{c.employee.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {cfg && (
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", cfg.color)}>
                              {cfg.icon}{cfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">{c.late_minutes > 0 ? fmtMinutes(c.late_minutes) : "—"}</td>
                        <td className="px-3 py-3 text-center">
                          {c.is_regularized ? (
                            <span className="text-green-600"><CheckCircle2 className="h-4 w-4 inline" /></span>
                          ) : (
                            <span className="text-gray-300"><XCircle className="h-4 w-4 inline" /></span>
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
      ) : (
        <div className="space-y-3">
          <div className={cn(
            "rounded-xl border p-4 text-sm flex items-center justify-between gap-3 flex-wrap",
            payrollClosure.status === "closed" ? "bg-green-50 border-green-100 text-green-800" : "bg-amber-50 border-amber-100 text-amber-800"
          )}>
            <span>
              {payrollClosure.status === "closed"
                ? `This month is closed for payroll${payrollClosure.processed_at ? ` (processed ${new Date(payrollClosure.processed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })})` : ""}.`
                : "This month hasn't been closed for payroll yet — figures below are a live preview and may change."}
            </span>
            <Link href="/dashboard/hrms/attendance/automation" className="underline font-medium whitespace-nowrap">
              Open Monthly Processing
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Working Days</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Present</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Paid Leave</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Unpaid Leave</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Half Days</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">LOP Days</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Payable Days</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">OT Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                      </tr>
                    ))
                  ) : payrollRows.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400">No employees found</td></tr>
                  ) : (
                    payrollRows.map((r) => (
                      <tr key={r.employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={r.employee.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                                {initials(r.employee.profile?.full_name ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{r.employee.profile?.full_name ?? "—"}</p>
                              <p className="text-xs text-gray-400">{r.employee.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-700">{r.working_days}</td>
                        <td className="px-3 py-3 text-center text-green-700 font-medium">{r.present_days}</td>
                        <td className="px-3 py-3 text-center text-blue-700 font-medium hidden sm:table-cell">{r.paid_leave_days}</td>
                        <td className="px-3 py-3 text-center text-red-600 font-medium hidden sm:table-cell">{r.unpaid_leave_days}</td>
                        <td className="px-3 py-3 text-center text-orange-700 font-medium hidden md:table-cell">{r.half_day_count}</td>
                        <td className="px-3 py-3 text-center text-red-700 font-medium">{r.lop_days}</td>
                        <td className="px-3 py-3 text-center text-gray-900 font-semibold">{r.payable_days}</td>
                        <td className="px-3 py-3 text-center text-indigo-700 font-medium hidden md:table-cell">{r.overtime_hours || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
