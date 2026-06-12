"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, Users, AlertCircle,
  CheckCircle2, Clock, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  is_paid: boolean;
  days_per_year: number;
  requires_approval: boolean;
  applicable_gender: string;
}

interface LeaveBalance {
  leave_type_id: string;
  total_days: number;
  used_days: number;
  pending_days: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  from_date: string;
  to_date: string;
  leave_type: string;
  status: string;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  department_id: string | null;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

type DurationType = "full_day" | "first_half" | "second_half";

const DURATION_OPTIONS: { value: DurationType; label: string }[] = [
  { value: "full_day",    label: "Full Day" },
  { value: "first_half",  label: "First Half (Morning)" },
  { value: "second_half", label: "Second Half (Afternoon)" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function countWorkDays(from: string, to: string, isHalfDay: boolean): number {
  if (!from || !to) return 0;
  if (isHalfDay) return 0.5;
  const start = new Date(from);
  const end   = new Date(to);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ApplyLeavePage() {
  const router = useRouter();

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [duration, setDuration]     = useState<DurationType>("full_day");
  const [reason, setReason]         = useState("");
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [leaveTypes, setLeaveTypes]         = useState<LeaveType[]>([]);
  const [balances, setBalances]             = useState<LeaveBalance[]>([]);
  const [teamOnLeave, setTeamOnLeave]       = useState<TeamMember[]>([]);
  const [userId, setUserId]                 = useState<string | null>(null);
  const [userFullName, setUserFullName]     = useState<string>("You");
  const [ownEmployeeId, setOwnEmployeeId]   = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [allEmployees, setAllEmployees]     = useState<EmployeeOption[]>([]);
  const [departments, setDepartments]       = useState<Department[]>([]);
  const [workspaceId, setWorkspaceId]       = useState<string | null>(null);
  const [departmentId, setDepartmentId]     = useState<string | null>(null);
  const [viewerRole, setViewerRole]         = useState<string>("employee");
  const [loading, setLoading]               = useState(true);
  const [teamLoading, setTeamLoading]       = useState(false);
  const [pageError, setPageError]           = useState<"workspace_missing" | "no_employee" | null>(null);

  // Self-profile creation (HR/admin without an hr_employees record)
  const [myEmpCode, setMyEmpCode]           = useState("");
  const [myDesignation, setMyDesignation]   = useState("");
  const [myDeptId, setMyDeptId]             = useState("");
  const [myDOJ, setMyDOJ]                   = useState(new Date().toISOString().split("T")[0]);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const isHalfDay = duration !== "full_day";
  const daysCount = countWorkDays(fromDate, toDate || fromDate, isHalfDay);

  // Selected leave type
  const selectedType = leaveTypes.find((lt) => lt.id === leaveTypeId);
  const selectedBalance = balances.find((b) => b.leave_type_id === leaveTypeId);

  const remaining = useMemo(() => {
    if (!selectedBalance) return null;
    return Math.max(0,
      Number(selectedBalance.total_days) -
      Number(selectedBalance.used_days) -
      Number(selectedBalance.pending_days)
    );
  }, [selectedBalance]);

  const balanceWarning = remaining !== null && daysCount > remaining;

  // Initial load
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/auth/login"); return; }
        setUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("workspace_id, role, full_name")
          .eq("user_id", user.id)
          .single();

        const role = profile?.role ?? "employee";
        setViewerRole(role);
        if (profile?.full_name) setUserFullName(profile.full_name);

        if (!profile?.workspace_id) {
          setPageError("workspace_missing");
          return;
        }
        const wid = profile.workspace_id;
        setWorkspaceId(wid);

        const isHR = role === "super_admin" || role === "hr";

        const { data: emp } = await supabase
          .from("hr_employees")
          .select("id, department_id")
          .eq("user_id", user.id)
          .eq("workspace_id", wid)
          .maybeSingle();

        if (emp) {
          setOwnEmployeeId(emp.id);
          setSelectedEmployeeId(emp.id);
          setDepartmentId(emp.department_id ?? null);
        } else if (!isHR) {
          setPageError("no_employee");
          return;
        }

        const typesQuery = supabase
          .from("hr_leave_types")
          .select("id, name, code, is_paid, days_per_year, requires_approval, applicable_gender")
          .eq("workspace_id", wid)
          .order("name");

        if (isHR) {
          const [typesRes, empsRes, deptsRes] = await Promise.all([
            typesQuery,
            supabase
              .from("hr_employees")
              .select("id, employee_code, department_id, profiles(full_name)")
              .eq("workspace_id", wid)
              .order("employee_code"),
            supabase
              .from("hr_departments")
              .select("id, name")
              .eq("workspace_id", wid)
              .order("name"),
          ]);

          setLeaveTypes((typesRes.data ?? []) as LeaveType[]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const empsData = (empsRes.data ?? []) as any[];
          setAllEmployees(empsData.map((e) => ({
            id: e.id,
            employee_code: e.employee_code,
            department_id: e.department_id ?? null,
            full_name: e.profiles?.full_name ?? e.employee_code,
          })));
          setDepartments((deptsRes.data ?? []) as Department[]);
        } else {
          const typesRes = await typesQuery;
          setLeaveTypes((typesRes.data ?? []) as LeaveType[]);
        }
      } catch (err) {
        console.error("Leave apply load error:", err);
        toast.error("Failed to load leave data. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Load balances for whichever employee is selected ("Applying For")
  useEffect(() => {
    if (!selectedEmployeeId || !workspaceId) {
      setBalances([]);
      return;
    }

    async function loadBalances() {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("hr_leave_balances")
        .select("leave_type_id, total_days, used_days, pending_days")
        .eq("employee_id", selectedEmployeeId as string)
        .eq("year", year);
      setBalances((data ?? []) as LeaveBalance[]);
    }
    loadBalances();

    const emp = allEmployees.find((e) => e.id === selectedEmployeeId);
    if (emp) setDepartmentId(emp.department_id);
  }, [selectedEmployeeId, workspaceId, allEmployees]);

  // Load team availability when dates change
  useEffect(() => {
    if (!fromDate || !workspaceId || !departmentId) return;
    const effectiveTo = toDate || fromDate;

    async function loadTeam() {
      setTeamLoading(true);
      const supabase = createClient();

      const { data: deptEmps } = await supabase
        .from("hr_employees")
        .select("id")
        .eq("department_id", departmentId)
        .eq("workspace_id", workspaceId!)
        .neq("id", selectedEmployeeId ?? "");

      const empIds = (deptEmps ?? []).map((e) => e.id);
      if (empIds.length === 0) { setTeamOnLeave([]); setTeamLoading(false); return; }

      const { data: leaves } = await supabase
        .from("hr_leave_applications")
        .select("id, from_date, to_date, status, hr_leave_types(name), hr_employees(id, profiles(full_name, avatar_url))")
        .in("employee_id", empIds)
        .in("status", ["approved", "pending", "pending_l1", "pending_l2"])
        .lte("from_date", effectiveTo)
        .gte("to_date", fromDate);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: TeamMember[] = (leaves ?? []).map((l: any) => ({
        id: l.hr_employees?.id ?? l.id,
        full_name: l.hr_employees?.profiles?.full_name ?? "—",
        avatar_url: l.hr_employees?.profiles?.avatar_url ?? null,
        from_date: l.from_date,
        to_date: l.to_date,
        leave_type: l.hr_leave_types?.name ?? "Leave",
        status: l.status,
      }));

      setTeamOnLeave(mapped);
      setTeamLoading(false);
    }

    loadTeam();
  }, [fromDate, toDate, workspaceId, departmentId, selectedEmployeeId]);

  // Sync: if half-day, to_date = from_date
  useEffect(() => {
    if (isHalfDay && fromDate) setToDate(fromDate);
  }, [isHalfDay, fromDate]);

  async function createMyProfile() {
    if (!myEmpCode.trim()) { toast.error("Employee code is required"); return; }
    if (!myDesignation.trim()) { toast.error("Designation is required"); return; }
    if (!myDOJ) { toast.error("Date of joining is required"); return; }
    if (!workspaceId || !userId) return;

    setCreatingProfile(true);
    const supabase = createClient();
    const code = myEmpCode.trim().toUpperCase();
    const { data, error } = await supabase
      .from("hr_employees")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        employee_code: code,
        designation: myDesignation.trim(),
        department_id: myDeptId || null,
        employment_type: "full_time",
        date_of_joining: myDOJ,
        status: "active",
      })
      .select("id, department_id")
      .single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Employee code already exists" : error.message);
      setCreatingProfile(false);
      return;
    }

    toast.success("Employee profile created");
    setOwnEmployeeId(data.id);
    setSelectedEmployeeId(data.id);
    setDepartmentId(data.department_id ?? null);
    setAllEmployees((prev) => [
      { id: data.id, employee_code: code, department_id: data.department_id ?? null, full_name: userFullName },
      ...prev,
    ]);
    setCreatingProfile(false);
  }

  async function submit() {
    if (!selectedEmployeeId || !workspaceId) {
      toast.error("Please select an employee to apply for");
      return;
    }
    if (!leaveTypeId) { toast.error("Please select a leave type"); return; }
    if (!fromDate)    { toast.error("Please select a start date"); return; }
    if (!toDate && !isHalfDay) { toast.error("Please select an end date"); return; }
    if (daysCount <= 0) { toast.error("Invalid date range or duration"); return; }

    if (balanceWarning) {
      toast.error(`Insufficient balance. You have ${remaining} day(s) available.`);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const effectiveTo = toDate || fromDate;

    // Core payload (always safe — these columns exist in original schema)
    const corePayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      employee_id: selectedEmployeeId,
      leave_type_id: leaveTypeId,
      from_date: fromDate,
      to_date: effectiveTo,
      days_count: daysCount,
      is_half_day: isHalfDay,
      half_day_date: isHalfDay ? fromDate : null,
      reason: reason.trim() || null,
      status: selectedType?.requires_approval ? "pending_l1" : "approved",
    };

    // Try with extended columns first (requires SQL Block B migration)
    let result = await supabase.from("hr_leave_applications").insert({
      ...corePayload,
      notify_team_members: notifyTeam,
    });

    // Graceful fallback if notify_team_members column doesn't exist yet
    if (result.error?.message?.includes("notify_team_members")) {
      result = await supabase.from("hr_leave_applications").insert(corePayload);
    }

    if (result.error) {
      toast.error("Failed to submit leave: " + result.error.message);
      setSubmitting(false);
      return;
    }

    // Update pending_days in balance (optimistic)
    if (selectedBalance) {
      await supabase
        .from("hr_leave_balances")
        .update({ pending_days: Number(selectedBalance.pending_days) + daysCount })
        .eq("leave_type_id", leaveTypeId)
        .eq("employee_id", selectedEmployeeId);
    }

    const appliedForSelf = selectedEmployeeId === ownEmployeeId;
    const targetName = allEmployees.find((e) => e.id === selectedEmployeeId)?.full_name;
    const suffix = !appliedForSelf && targetName ? ` for ${targetName}` : "";

    toast.success(
      selectedType?.requires_approval
        ? `Leave request submitted for approval${suffix}`
        : `Leave approved automatically${suffix}`
    );
    router.push("/dashboard/hrms/leaves");
  }

  const today = new Date().toISOString().split("T")[0];
  const isHROrAdmin = viewerRole === "super_admin" || viewerRole === "hr";

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (pageError === "workspace_missing") {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hrms/leaves"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Apply for Leave</h1>
        </div>
        <div className="flex items-start gap-4 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">Workspace not configured</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Your account is not linked to a workspace. Ask your super admin to run this SQL in Supabase:
            </p>
            <pre className="mt-3 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 rounded-lg px-4 py-3 overflow-x-auto">{`UPDATE public.profiles\nSET workspace_id = (SELECT id FROM public.workspaces ORDER BY created_at ASC LIMIT 1)\nWHERE workspace_id IS NULL;`}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (pageError === "no_employee") {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hrms/leaves"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Apply for Leave</h1>
        </div>
        <div className="flex items-start gap-4 p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-900 dark:text-orange-300">No employee profile found</p>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-2">
              Your account has not been set up as an employee yet. Please contact HR to create your employee profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrms/leaves"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Apply for Leave</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit your leave request for approval</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">

        {/* Apply For (HR/admin only) */}
        {isHROrAdmin && (
          <div className="p-5 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Apply For</h2>

            {!ownEmployeeId && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-300">You don't have an employee profile yet</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Create one to apply for your own leave.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Employee Code *</Label>
                    <Input placeholder="EMP-010" value={myEmpCode} onChange={(e) => setMyEmpCode(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Designation *</Label>
                    <Input placeholder="HR Manager" value={myDesignation} onChange={(e) => setMyDesignation(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Select value={myDeptId || "none"} onValueChange={(v) => setMyDeptId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No department</SelectItem>
                        {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Joining *</Label>
                    <Input type="date" value={myDOJ} onChange={(e) => setMyDOJ(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" onClick={createMyProfile} disabled={creatingProfile}>
                  {creatingProfile ? "Creating…" : "Create My Profile"}
                </Button>
              </div>
            )}

            {allEmployees.length > 0 && (
              <div className="space-y-1.5">
                <Label>Applying For</Label>
                <Select value={selectedEmployeeId ?? ""} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code}){e.id === ownEmployeeId ? " — You" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Leave Type */}
        <div className="p-5 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Details</h2>

          <div className="space-y-1.5">
            <Label>Leave Type *</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type…" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => {
                  const bal = balances.find((b) => b.leave_type_id === lt.id);
                  const avail = bal
                    ? Math.max(0, Number(bal.total_days) - Number(bal.used_days) - Number(bal.pending_days))
                    : 0;
                  return (
                    <SelectItem key={lt.id} value={lt.id}>
                      <span className="flex items-center gap-2">
                        {lt.name}
                        {bal && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({avail} days available)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Balance preview */}
            {selectedBalance && selectedType && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="text-muted-foreground">
                  Total: <strong className="text-foreground">{selectedBalance.total_days}</strong>
                </span>
                <span className="text-muted-foreground">
                  Used: <strong className="text-foreground">{selectedBalance.used_days}</strong>
                </span>
                <span className="text-muted-foreground">
                  Pending: <strong className="text-orange-500">{selectedBalance.pending_days}</strong>
                </span>
                <span className="text-muted-foreground">
                  Available: <strong className={cn("text-foreground", remaining === 0 && "text-red-500")}>
                    {remaining}
                  </strong>
                </span>
              </div>
            )}
            {leaveTypeId && !selectedBalance && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />No balance record found for this year. Contact HR to allocate.
              </p>
            )}
          </div>

          {/* Duration type */}
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                    duration === opt.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-border text-foreground hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Date *</Label>
              <Input type="date" min={today} value={fromDate} onChange={(e) => {
                setFromDate(e.target.value);
                if (!isHalfDay && toDate && e.target.value > toDate) setToDate(e.target.value);
              }} />
            </div>
            <div className="space-y-1.5">
              <Label>To Date {isHalfDay ? "(same as from)" : "*"}</Label>
              <Input
                type="date"
                min={fromDate || today}
                value={isHalfDay ? fromDate : toDate}
                disabled={isHalfDay}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Duration summary */}
          {daysCount > 0 && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              balanceWarning
                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
            )}>
              {balanceWarning
                ? <AlertCircle className="h-4 w-4 shrink-0" />
                : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {balanceWarning
                ? `Insufficient balance. Requesting ${daysCount} day(s), only ${remaining} available.`
                : `${daysCount} working day(s) — ${fromDate === (toDate || fromDate) ? fmtDate(fromDate) : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`}`}
            </div>
          )}
        </div>

        {/* Reason */}
        <div className="p-5 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Details</h2>

          <div className="space-y-1.5">
            <Label>Reason / Note to Approver</Label>
            <Textarea
              placeholder="Briefly describe the reason for your leave…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-foreground">Notify Team Members</p>
              <p className="text-xs text-muted-foreground">Send a heads-up to your department</p>
            </div>
            <Switch checked={notifyTeam} onCheckedChange={setNotifyTeam} />
          </div>

          {selectedType && (
            <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {selectedType.requires_approval
                  ? "This leave type requires approval from your reporting manager."
                  : "This leave type is auto-approved upon submission."}
                {selectedType.is_paid ? " It is a paid leave." : " It is unpaid."}
              </span>
            </div>
          )}
        </div>

        {/* Team Availability */}
        {fromDate && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team Availability</h2>
            </div>

            {teamLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : teamOnLeave.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                All team members available during these dates
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {teamOnLeave.length} team member(s) on leave during this period
                </p>
                {teamOnLeave.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30">
                        {initials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.leave_type} · {fmtDate(member.from_date)} – {fmtDate(member.to_date)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] shrink-0",
                        member.status === "approved" ? "border-green-300 text-green-600" : "border-yellow-300 text-yellow-600"
                      )}
                    >
                      {member.status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button variant="outline" asChild><Link href="/dashboard/hrms/leaves">Cancel</Link></Button>
        <Button
          onClick={submit}
          disabled={submitting || balanceWarning || !leaveTypeId || !fromDate || daysCount <= 0 || !selectedEmployeeId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
        >
          {submitting ? (
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 animate-spin" /> Submitting…</span>
          ) : (
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Submit Request</span>
          )}
        </Button>
      </div>
    </div>
  );
}
