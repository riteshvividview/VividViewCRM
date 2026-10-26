"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase,
  Building2, Edit2, CheckCircle2, XCircle, AlertCircle,
  Clock, IndianRupee, FileText, User, Trash2, KeyRound, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmployeeLeavePolicyTab } from "@/components/hrms/employee-leave-policy-tab";
import { EmployeeBackgroundTab } from "@/components/hrms/employee-background-tab";
import { EmployeeDocumentsTab } from "@/components/hrms/employee-documents-tab";
import { EmployeeEditDialog } from "@/components/hrms/employee-edit-dialog";
import type { UserRole } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeDetail {
  id: string;
  employee_code: string;
  designation: string;
  employment_type: string;
  status: string;
  date_of_joining: string;
  user_id: string | null;
  date_of_exit: string | null;
  probation_end_date: string | null;
  work_location: string;
  salary_ctc: number;
  salary_basic: number;
  bank_name: string | null;
  bank_ifsc: string | null;
  bank_account_number: string | null;
  uan_number: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  reporting_manager_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  personal_email: string | null;
  blood_group: string | null;
  marital_status: string | null;
  current_address: string | null;
  permanent_address: string | null;
  notice_period_days: number | null;
  manager: { id: string; employee_code: string; profiles: { full_name: string } | null } | null;
  hr_departments: { id: string; name: string } | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  work_minutes: number;
}

interface LeaveBalance {
  leave_type_id: string;
  hr_leave_types: { name: string; code: string; is_paid: boolean } | null;
  total_days: number;
  used_days: number;
  pending_days: number;
}

interface LeaveApplication {
  id: string;
  from_date: string;
  to_date: string;
  days_count: number;
  status: string;
  reason: string | null;
  hr_leave_types: { name: string; code: string } | null;
}

interface Payslip {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  total_deductions: number;
  status: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:     "bg-green-100 text-green-700",
  on_notice:  "bg-yellow-100 text-yellow-700",
  inactive:   "bg-gray-100 text-gray-600",
  terminated: "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time",
  contract: "Contract", intern: "Intern",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ATT_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  present:  { label: "Present",  cls: "text-green-600 bg-green-50",  icon: <CheckCircle2 className="h-3 w-3" /> },
  absent:   { label: "Absent",   cls: "text-red-600 bg-red-50",    icon: <XCircle className="h-3 w-3" /> },
  late:     { label: "Late",     cls: "text-yellow-600 bg-yellow-50", icon: <AlertCircle className="h-3 w-3" /> },
  on_leave: { label: "On Leave", cls: "text-blue-600 bg-blue-50",   icon: <Clock className="h-3 w-3" /> },
  half_day: { label: "Half Day", cls: "text-orange-600 bg-orange-50", icon: <AlertCircle className="h-3 w-3" /> },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function mins(m: number) {
  if (!m) return "—";
  return `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ""}`.trim();
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function mask(v: string | null) {
  if (!v) return "—";
  if (v.length <= 4) return v;
  return "•".repeat(v.length - 4) + v.slice(-4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerRole, setViewerRole] = useState<UserRole>("employee");
  const [viewerWorkspaceId, setViewerWorkspaceId] = useState<string>("");
  const [attMonth, setAttMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ full_name: "", email: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    // Identify the viewer's role and workspace for policy tab
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: vp } = await supabase
        .from("profiles")
        .select("role, workspace_id")
        .eq("user_id", user.id)
        .single();
      if (vp) {
        setViewerRole((vp.role as UserRole) ?? "employee");
        setViewerWorkspaceId(vp.workspace_id ?? "");
      }
    }
    const [empRes, leaveBalRes, leaveAppRes, payslipRes] = await Promise.all([
      fetch(`/api/hrms/employees/${id}`).then((r) => r.json()).catch(() => ({})),
      supabase.from("hr_leave_balances")
        .select("*, hr_leave_types(name, code, is_paid)")
        .eq("employee_id", id)
        .eq("year", new Date().getFullYear()),
      supabase.from("hr_leave_applications")
        .select("id, from_date, to_date, days_count, status, reason, hr_leave_types(name, code)")
        .eq("employee_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("hr_payslips")
        .select("id, month, year, gross_salary, net_salary, total_deductions, status")
        .eq("employee_id", id)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(12),
    ]);

    setEmployee((empRes.employee ?? null) as EmployeeDetail | null);
    setCanEdit(!!empRes.canEdit);
    setLeaveBalances((leaveBalRes.data ?? []) as LeaveBalance[]);
    setLeaveApplications((leaveAppRes.data ?? []) as unknown as LeaveApplication[]);
    setPayslips((payslipRes.data ?? []) as Payslip[]);
    setLoading(false);
  }

  // Load employee profile
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load attendance for selected month
  useEffect(() => {
    async function loadAttendance() {
      const supabase = createClient();
      const from = `${attMonth.year}-${String(attMonth.month).padStart(2, "0")}-01`;
      const lastDay = new Date(attMonth.year, attMonth.month, 0).getDate();
      const to = `${attMonth.year}-${String(attMonth.month).padStart(2, "0")}-${lastDay}`;

      const { data } = await supabase
        .from("hr_attendance")
        .select("id, date, status, check_in, check_out, work_minutes")
        .eq("employee_id", id)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true });

      setAttendance((data ?? []) as AttendanceRecord[]);
    }
    if (id) loadAttendance();
  }, [id, attMonth]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/hrms/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove employee");
      toast.success("Employee removed");
      router.push("/dashboard/hrms/employees");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to remove employee");
      setDeleting(false);
    }
  }

  async function handleCreateLogin() {
    if (!loginForm.full_name.trim()) { toast.error("Full name is required"); return; }
    if (!loginForm.email.trim()) { toast.error("Email is required"); return; }

    setCreatingLogin(true);
    try {
      const res = await fetch(`/api/hrms/employees/${id}/create-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create login");

      toast.success("Login created — credentials have been emailed");
      setLoginOpen(false);
      setLoginForm({ full_name: "", email: "" });
      await load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to create login");
    } finally {
      setCreatingLogin(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Employee not found</p>
        <Button variant="outline" asChild><Link href="/dashboard/hrms/employees"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
      </div>
    );
  }

  const fullName = employee.profiles?.full_name ?? "Unknown";
  const attByDate = Object.fromEntries(attendance.map((a) => [a.date.split("T")[0], a]));
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href={canEdit ? "/dashboard/hrms/employees" : "/dashboard/hrms"}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold">{canEdit ? "Employee Profile" : "My HR Profile"}</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <Avatar className="h-20 w-20 text-lg shrink-0">
            <AvatarImage src={employee.profiles?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl font-bold">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
                <p className="text-gray-500 mt-0.5">{employee.designation}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[employee.status] ?? "bg-gray-100 text-gray-600")}>
                    {employee.status.replace("_", " ")}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {TYPE_LABELS[employee.employment_type] ?? employee.employment_type}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{employee.employee_code}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !employee.profiles && (
                  <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white" onClick={() => setLoginOpen(true)}>
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />Create Login
                  </Button>
                )}
                {canEdit && <>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove
                </Button>
                </>}
              </div>
            </div>

            {!employee.profiles && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  No login account is linked to this employee, so their name and photo can&apos;t be shown.
                  Click <span className="font-medium">Create Login</span> to set up their account and email them credentials.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{employee.hr_departments?.name ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="capitalize">{employee.work_location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>Joined {fmtDate(employee.date_of_joining)}</span>
              </div>
              {employee.date_of_exit && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Exit {fmtDate(employee.date_of_exit)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-white border border-gray-100 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="policy">Leave Policy</TabsTrigger>
          <TabsTrigger value="background">Background</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Employment info */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-500" />Employment Details
              </h3>
              <dl className="space-y-3">
                {[
                  ["Employee Code", employee.employee_code],
                  ["Designation", employee.designation],
                  ["Department", employee.hr_departments?.name ?? "—"],
                  ["Reporting Manager", employee.manager?.profiles?.full_name ?? employee.manager?.employee_code ?? "—"],
                  ["Employment Type", TYPE_LABELS[employee.employment_type] ?? employee.employment_type],
                  ["Work Location", employee.work_location],
                  ["Date of Joining", fmtDate(employee.date_of_joining)],
                  ["Probation End", fmtDate(employee.probation_end_date)],
                  ["Notice Period", employee.notice_period_days ? `${employee.notice_period_days} days` : "—"],
                  ["Status", employee.status.replace("_", " ")],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900 capitalize">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Compensation & compliance */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-indigo-500" />Compensation & Compliance
              </h3>
              <dl className="space-y-3">
                {[
                  ["CTC (Annual)", employee.salary_ctc ? fmtINR(Number(employee.salary_ctc)) : "—"],
                  ["Basic (Annual)", employee.salary_basic ? fmtINR(Number(employee.salary_basic)) : "—"],
                  ["Monthly Gross", employee.salary_ctc ? fmtINR(Number(employee.salary_ctc) / 12) : "—"],
                  ["UAN Number", employee.uan_number ?? "—"],
                  ["PAN Number", employee.pan_number ?? "—"],
                  ["Aadhaar Number", mask(employee.aadhaar_number)],
                  ["Bank Name", employee.bank_name ?? "—"],
                  ["IFSC Code", employee.bank_ifsc ?? "—"],
                  ["Bank Account No.", mask(employee.bank_account_number)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{value as string}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Personal */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />Personal Details
              </h3>
              <dl className="space-y-3">
                {[
                  ["Date of Birth", fmtDate(employee.date_of_birth)],
                  ["Gender", employee.gender ?? "—"],
                  ["Phone", employee.phone ?? "—"],
                  ["Personal Email", employee.personal_email ?? "—"],
                  ["Blood Group", employee.blood_group ?? "—"],
                  ["Marital Status", employee.marital_status ?? "—"],
                  ["Current Address", employee.current_address ?? "—"],
                  ["Permanent Address", employee.permanent_address ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <dt className="text-gray-500 shrink-0">{label}</dt>
                    <dd className="font-medium text-gray-900 capitalize text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Emergency contact */}
            {(employee.emergency_contact_name || employee.emergency_contact_phone || employee.emergency_contact_relation) && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-500" />Emergency Contact
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium text-gray-900">{employee.emergency_contact_name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="font-medium text-gray-900">{employee.emergency_contact_phone ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Relation</dt>
                    <dd className="font-medium text-gray-900">{employee.emergency_contact_relation ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── ATTENDANCE ────────────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          {/* Month navigator */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAttMonth((m) => {
                const d = new Date(m.year, m.month - 2, 1);
                return { month: d.getMonth() + 1, year: d.getFullYear() };
              })}>←</Button>
              <span className="font-semibold text-gray-900 w-28 text-center">
                {MONTHS[attMonth.month - 1]} {attMonth.year}
              </span>
              <Button variant="outline" size="sm" disabled={attMonth.month === new Date().getMonth() + 1 && attMonth.year === new Date().getFullYear()} onClick={() => setAttMonth((m) => {
                const d = new Date(m.year, m.month, 1);
                return { month: d.getMonth() + 1, year: d.getFullYear() };
              })}>→</Button>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{presentCount} Present</span>
              <span className="text-yellow-600 font-medium">{lateCount} Late</span>
              <span className="text-red-600 font-medium">{absentCount} Absent</span>
            </div>
          </div>

          {/* Attendance table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check In</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check Out</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Hours</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const daysInMonth = new Date(attMonth.year, attMonth.month, 0).getDate();
                    const rows = [];
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = `${attMonth.year}-${String(attMonth.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const rec = attByDate[dateStr];
                      const dayOfWeek = new Date(dateStr).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const sc = rec ? ATT_STATUS[rec.status] : null;

                      rows.push(
                        <tr key={dateStr} className={cn("border-b border-gray-50", isWeekend && "bg-gray-50/50")}>
                          <td className="px-4 py-2.5 text-gray-700 text-sm">
                            <span className="font-medium">{String(d).padStart(2, "0")}</span>
                            <span className="text-gray-400 ml-1 text-xs">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek]}</span>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600">{rec ? fmt(rec.check_in) : "—"}</td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600">{rec ? fmt(rec.check_out) : "—"}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-gray-500">{rec ? mins(rec.work_minutes) : "—"}</td>
                          <td className="px-4 py-2.5">
                            {isWeekend && !rec ? (
                              <span className="text-xs text-gray-400">Weekend</span>
                            ) : sc ? (
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sc.cls)}>
                                {sc.icon}{sc.label}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── LEAVES ────────────────────────────────────────────────────────── */}
        <TabsContent value="leaves" className="mt-4 space-y-5">
          {/* Balance cards */}
          {leaveBalances.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {leaveBalances.map((b) => {
                const total = Number(b.total_days);
                const used = Number(b.used_days);
                const pending = Number(b.pending_days);
                const available = total - used - pending;
                return (
                  <div key={b.leave_type_id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {b.hr_leave_types?.code ?? "—"}
                      </span>
                      {b.hr_leave_types?.is_paid && (
                        <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">Paid</span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{available}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.hr_leave_types?.name}</p>
                    <div className="mt-2 h-1 bg-gray-100 rounded-full">
                      <div
                        className="h-1 bg-indigo-400 rounded-full"
                        style={{ width: `${total > 0 ? Math.min(100, (used / total) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{used} used · {pending} pending · {total} total</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Leave history */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Leave History</h3>
            </div>
            {leaveApplications.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">No leave applications yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {leaveApplications.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.hr_leave_types?.name ?? "Leave"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(l.from_date)} → {fmtDate(l.to_date)} · {Number(l.days_count)}d
                      </p>
                      {l.reason && <p className="text-xs text-gray-400 mt-0.5 italic">"{l.reason}"</p>}
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0", {
                      "bg-yellow-100 text-yellow-700": l.status === "pending",
                      "bg-green-100 text-green-700": l.status === "approved",
                      "bg-red-100 text-red-700": l.status === "rejected",
                      "bg-gray-100 text-gray-600": l.status === "cancelled",
                    })}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── PAYROLL ───────────────────────────────────────────────────────── */}
        <TabsContent value="payroll" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Payslip History</h3>
            </div>
            {payslips.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">No payslips generated yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Gross</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Deductions</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net Pay</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{MONTHS[p.month - 1]} {p.year}</td>
                      <td className="px-5 py-3 text-right hidden sm:table-cell text-gray-600">{fmtINR(Number(p.gross_salary))}</td>
                      <td className="px-5 py-3 text-right hidden sm:table-cell text-red-500">{fmtINR(Number(p.total_deductions))}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtINR(Number(p.net_salary))}</td>
                      <td className="px-5 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", {
                          "bg-gray-100 text-gray-600": p.status === "draft",
                          "bg-green-100 text-green-700": p.status === "generated",
                          "bg-blue-100 text-blue-700": p.status === "sent",
                        })}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── LEAVE POLICY ──────────────────────────────────────────────────── */}
        <TabsContent value="policy" className="mt-4">
          {viewerWorkspaceId ? (
            <EmployeeLeavePolicyTab
              employeeId={id}
              workspaceId={viewerWorkspaceId}
              viewerRole={viewerRole}
            />
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">Loading policy data…</div>
          )}
        </TabsContent>

        {/* ── BACKGROUND ────────────────────────────────────────────────────── */}
        <TabsContent value="background" className="mt-4">
          {viewerWorkspaceId ? (
            <EmployeeBackgroundTab
              employeeId={id}
              workspaceId={viewerWorkspaceId}
              viewerRole={viewerRole}
            />
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          )}
        </TabsContent>

        {/* ── DOCUMENTS ─────────────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          {viewerWorkspaceId ? (
            <EmployeeDocumentsTab
              employeeId={id}
              workspaceId={viewerWorkspaceId}
              viewerRole={viewerRole}
            />
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          )}
        </TabsContent>
      </Tabs>

      <EmployeeEditDialog
        employee={employee}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => load()}
      />

      {/* Create login dialog */}
      <Dialog open={loginOpen} onOpenChange={(o) => { if (!creatingLogin) { setLoginOpen(o); if (!o) setLoginForm({ full_name: "", email: "" }); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Login Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This creates a login account for <span className="font-medium text-gray-900">{employee.employee_code}</span> and
            emails them their credentials. Their name will then appear across HRMS.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                placeholder="Rahul Sharma"
                value={loginForm.full_name}
                onChange={(e) => setLoginForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="rahul@company.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginOpen(false)} disabled={creatingLogin}>Cancel</Button>
            <Button onClick={handleCreateLogin} disabled={creatingLogin}>
              {creatingLogin ? "Creating…" : "Create & Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Employee?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This will permanently remove <span className="font-medium text-gray-900">{fullName}</span> from HRMS —
            their department assignment, attendance, leave and payroll records will be deleted.
            {employee.user_id && " Their login will also be disabled so they can no longer access the system."}
            {" "}This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
