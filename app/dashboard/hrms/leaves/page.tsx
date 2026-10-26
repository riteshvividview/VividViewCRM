"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Clock, CalendarDays, Plus,
  AlertCircle, ChevronRight, UserCheck, ClipboardList,
  TrendingUp, Ban, RotateCcw, Users, CalendarCheck,
  ArrowRight, Umbrella, PartyPopper, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  is_paid: boolean;
  days_per_year: number;
}

interface LeaveBalance {
  id: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  carried_forward_days: number;
  hr_leave_types: LeaveType | null;
}

interface LeaveApplication {
  id: string;
  days_count: number;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: string;
  is_half_day: boolean;
  created_at: string;
  rejection_reason?: string | null;
  hr_leave_types: { name: string; code: string; is_paid: boolean } | null;
  hr_employees: {
    id: string;
    employee_code: string;
    profiles: { full_name: string; avatar_url: string | null; role: string | null } | null;
  } | null;
}

interface TeamLeave {
  from_date: string;
  to_date: string;
  hr_leave_types: { name: string; code: string } | null;
  hr_employees: {
    id: string;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending_l1: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending_l2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  approved:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled:  "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  withdrawn:  "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "Pending",
  pending_l1: "Awaiting TL",
  pending_l2: "Awaiting HR",
  approved:   "Approved",
  rejected:   "Rejected",
  cancelled:  "Cancelled",
  withdrawn:  "Withdrawn",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtRange(from: string, to: string) {
  if (from === to) return fmtDate(from);
  return `${new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${fmtDate(to)}`;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// Inclusive list of YYYY-MM-DD dates between two date-only strings, computed in UTC
// to avoid local-timezone drift when stepping day by day.
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur = new Date(cur.getTime() + 86400000);
  }
  return dates;
}

// ── Balance Card ──────────────────────────────────────────────────────────────
function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const total = Number(balance.total_days);
  const used = Number(balance.used_days);
  const pending = Number(balance.pending_days);
  const remaining = Math.max(0, total - used - pending);
  const pct = total > 0 ? Math.round(((used + pending) / total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {balance.hr_leave_types?.name ?? "Leave"}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">
          {balance.hr_leave_types?.code ?? ""}
        </span>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{remaining}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
        </div>
        <div>
          <p className="text-lg font-bold text-orange-500">{pending}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
        </div>
        <div>
          <p className="text-lg font-bold text-muted-foreground">{used}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Used</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/60 text-center">{total} days total this year</p>
    </div>
  );
}

// ── Leave Card ────────────────────────────────────────────────────────────────
function LeaveCard({
  leave, showActions, onDecide, currentRole,
}: {
  leave: LeaveApplication;
  showActions?: boolean;
  onDecide?: (id: string, action: "approve" | "reject" | "cancel") => void;
  currentRole?: UserRole;
}) {
  const isPending = ["pending", "pending_l1", "pending_l2"].includes(leave.status);
  const applicantRole = leave.hr_employees?.profiles?.role;
  const isApplicantHRLevel = applicantRole === "hr" || applicantRole === "super_admin";
  const canApprove =
    showActions && isPending && (
      currentRole === "super_admin"
        ? true
        : (currentRole === "hr" || currentRole === "team_lead") && !isApplicantHRLevel
    );

  return (
    <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow">
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        <AvatarImage src={leave.hr_employees?.profiles?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          {initials(leave.hr_employees?.profiles?.full_name ?? "?")}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-medium text-sm text-foreground">
            {leave.hr_employees?.profiles?.full_name ?? "—"}
          </p>
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium shrink-0", STATUS_STYLE[leave.status] ?? "bg-muted text-muted-foreground")}>
            {STATUS_LABEL[leave.status] ?? leave.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          <span className="text-sm text-muted-foreground">{leave.hr_leave_types?.name ?? "Leave"}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">{leave.days_count} day{Number(leave.days_count) !== 1 ? "s" : ""}</span>
          {leave.is_half_day && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Half Day</Badge>}
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground/80">{fmtRange(leave.from_date, leave.to_date)}</span>
        </div>

        {leave.reason && (
          <p className="text-xs text-muted-foreground/60 mt-1 italic line-clamp-1">"{leave.reason}"</p>
        )}
        {leave.rejection_reason && (
          <p className="text-xs text-red-500 mt-1 line-clamp-1">Reason: {leave.rejection_reason}</p>
        )}
      </div>

      {canApprove && (
        <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            onClick={() => onDecide?.(leave.id, "reject")}
          >
            <XCircle className="h-3 w-3 mr-1" /> Reject
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onDecide?.(leave.id, "approve")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
          </Button>
        </div>
      )}

      {leave.status === "approved" && (currentRole === "super_admin" || (currentRole === "hr" && !isApplicantHRLevel)) && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground shrink-0"
          onClick={() => onDecide?.(leave.id, "cancel")}
        >
          <Ban className="h-3 w-3 mr-1" /> Cancel
        </Button>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-14 text-muted-foreground/50">
      <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Reject Dialog ─────────────────────────────────────────────────────────────
function RejectDialog({
  open, onClose, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Leave Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Reason for rejection</Label>
          <Textarea
            placeholder="Provide a reason so the employee understands…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { if (reason.trim()) { onSubmit(reason.trim()); setReason(""); } else toast.error("Please provide a rejection reason"); }}
          >
            Reject Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeavesPage() {
  const [role, setRole] = useState<UserRole>("employee");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveApplication[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveApplication[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveApplication[]>([]);
  const [teamOnLeave, setTeamOnLeave] = useState<TeamLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceMissing, setWorkspaceMissing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const isHRLevel = role === "super_admin" || role === "hr";
  const isTeamLead = role === "team_lead";

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .single();

      if (!profile?.workspace_id) {
        setWorkspaceMissing(true);
        return;
      }
      setWorkspaceId(profile.workspace_id);

      // Derive role from the freshly fetched profile — never from stale state closure
      const userRole = (profile.role as UserRole) ?? "employee";
      setRole(userRole);
      const hrLevel = userRole === "super_admin" || userRole === "hr";
      const tlLevel = userRole === "team_lead";

      const wid = profile.workspace_id;
      const year = new Date().getFullYear();

      // Find the hr_employee record for this user
      const { data: empRow } = await supabase
        .from("hr_employees")
        .select("id")
        .eq("user_id", user.id)
        .eq("workspace_id", wid)
        .maybeSingle();

      const eid = empRow?.id ?? null;
      setEmployeeId(eid);

      const leaveSelect = "id, days_count, from_date, to_date, reason, status, is_half_day, created_at, rejection_reason, hr_leave_types(name, code, is_paid), hr_employees(id, employee_code, profiles(full_name, avatar_url, role))";

      if (eid) {
        // Compute this week's date range (Mon–Sun)
        const today = new Date();
        const mon = new Date(today);
        mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const ws = mon.toISOString().split("T")[0];
        const we = sun.toISOString().split("T")[0];

        const [balRes, myRes, teamRes] = await Promise.all([
          supabase
            .from("hr_leave_balances")
            .select("id, total_days, used_days, pending_days, carried_forward_days, hr_leave_types(id, name, code, is_paid, days_per_year)")
            .eq("employee_id", eid)
            .eq("year", year),
          supabase
            .from("hr_leave_applications")
            .select(leaveSelect)
            .eq("employee_id", eid)
            .order("created_at", { ascending: false }),
          // Colleagues on leave this week (approved, any overlapping day)
          supabase
            .from("hr_leave_applications")
            .select("from_date, to_date, hr_leave_types(name, code), hr_employees(id, profiles(full_name, avatar_url))")
            .eq("workspace_id", wid)
            .eq("status", "approved")
            .lte("from_date", we)
            .gte("to_date", ws)
            .neq("employee_id", eid)
            .limit(8),
        ]);
        setBalances((balRes.data ?? []) as unknown as LeaveBalance[]);
        setMyLeaves((myRes.data ?? []) as unknown as LeaveApplication[]);
        setTeamOnLeave((teamRes.data ?? []) as unknown as TeamLeave[]);
      }

      if (hrLevel || tlLevel) {
        let q = supabase
          .from("hr_leave_applications")
          .select(leaveSelect)
          .eq("workspace_id", wid);

        // Team lead: only load direct reports' leaves
        if (tlLevel && eid) {
          const { data: reports } = await supabase
            .from("hr_employees")
            .select("id")
            .eq("reporting_manager_id", eid)
            .eq("workspace_id", wid);
          const reportIds = (reports ?? []).map((r) => r.id);
          if (reportIds.length > 0) {
            q = q.in("employee_id", reportIds);
          }
        }

        const { data: all } = await q.order("created_at", { ascending: false });
        const allData = (all ?? []) as unknown as LeaveApplication[];
        setAllLeaves(allData);
        setPendingLeaves(allData.filter((l) => ["pending", "pending_l1", "pending_l2"].includes(l.status)));
      }
    } finally {
      setLoading(false);
    }
  }, []); // No deps on role state — role is read fresh from DB each call

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, action: "approve" | "reject" | "cancel", reason?: string) {
    if (action === "reject" && !reason) {
      setRejectTarget(id);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let newStatus = action === "approve" ? "approved" : action === "cancel" ? "cancelled" : "rejected";
    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (action === "approve") {
      update.approved_by = user.id;
      update.approved_at = new Date().toISOString();
    }
    if (action === "reject" && reason) {
      update.rejection_reason = reason;
    }

    const { error } = await supabase.from("hr_leave_applications").update(update).eq("id", id);
    if (error) { toast.error("Action failed"); return; }

    // Keep hr_attendance in sync so "On Leave" stats/records reflect approved leave days
    const leave = allLeaves.find((l) => l.id === id);
    const empId = leave?.hr_employees?.id;
    if (leave && empId && workspaceId) {
      const dates = dateRange(leave.from_date, leave.to_date);
      if (action === "approve") {
        await supabase.from("hr_attendance").upsert(
          dates.map((date) => ({ workspace_id: workspaceId, employee_id: empId, date, status: "on_leave" })),
          { onConflict: "employee_id,date" }
        );
      } else if (action === "cancel") {
        await supabase.from("hr_attendance")
          .delete()
          .eq("employee_id", empId)
          .eq("status", "on_leave")
          .in("date", dates);
      }
    }

    toast.success(
      action === "approve" ? "Leave approved" :
      action === "cancel" ? "Leave cancelled" : "Leave rejected"
    );
    setRejectTarget(null);
    load();
  }

  const myPending  = myLeaves.filter((l) => ["pending", "pending_l1", "pending_l2"].includes(l.status));
  const myApproved = myLeaves.filter((l) => l.status === "approved");
  const myHistory  = myLeaves.filter((l) => ["rejected", "cancelled", "withdrawn"].includes(l.status));

  const skeletons = [...Array(3)].map((_, i) => (
    <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
  ));

  // ── Stats for HR view ──────────────────────────────────────────────────────
  const hrStats = [
    { label: "Pending", value: pendingLeaves.length, icon: <Clock className="h-4 w-4" />, color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
    { label: "Approved", value: allLeaves.filter((l) => l.status === "approved").length, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
    { label: "Rejected", value: allLeaves.filter((l) => l.status === "rejected").length, icon: <XCircle className="h-4 w-4" />, color: "text-red-500 bg-red-50 dark:bg-red-900/20" },
    { label: "Total", value: allLeaves.length, icon: <ClipboardList className="h-4 w-4" />, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" },
  ];

  if (workspaceMissing) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leave Management" subtitle="Manage your leave requests" />
        <div className="flex items-start gap-4 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">Workspace not configured</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Your account has not been linked to a workspace yet. Ask your super admin to run the following SQL in the Supabase SQL Editor:
            </p>
            <pre className="mt-3 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap">
{`UPDATE public.profiles
SET workspace_id = (
  SELECT id FROM public.workspaces
  ORDER BY created_at ASC LIMIT 1
)
WHERE workspace_id IS NULL;`}
            </pre>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">After running the SQL, refresh the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle={
          isHRLevel ? `${pendingLeaves.length} pending approval` :
          isTeamLead ? `${pendingLeaves.length} team requests pending` :
          "Manage your leave requests"
        }
        actions={
          <div className="flex gap-2">
            {(isHRLevel) && (
              <>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/hrms/leaves/types">Leave Types</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/hrms/leaves/policies">Policies</Link>
                </Button>
              </>
            )}
            <Button size="sm" asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link href="/dashboard/hrms/leaves/apply">
                <Plus className="h-4 w-4 mr-1.5" />Apply Leave
              </Link>
            </Button>
          </div>
        }
      />

      {/* HR / Team Lead view */}
      {(isHRLevel || isTeamLead) && (
        <>
          {/* Stats row (HR only) */}
          {isHRLevel && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {hrStats.map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", s.color)}>{s.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Tabs defaultValue="pending">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="pending">
                Pending
                {pendingLeaves.length > 0 && (
                  <span className="ml-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">
                    {pendingLeaves.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved ({allLeaves.filter(l => l.status === "approved").length})</TabsTrigger>
              <TabsTrigger value="all">All History</TabsTrigger>
              {employeeId && <TabsTrigger value="mine">My Leaves</TabsTrigger>}
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {loading ? skeletons : pendingLeaves.length === 0
                ? <EmptyState label="No pending leave requests" />
                : pendingLeaves.map((l) => (
                    <LeaveCard key={l.id} leave={l} showActions onDecide={decide} currentRole={role} />
                  ))}
            </TabsContent>

            <TabsContent value="approved" className="mt-4 space-y-3">
              {loading ? skeletons : allLeaves.filter(l => l.status === "approved").length === 0
                ? <EmptyState label="No approved leaves" />
                : allLeaves.filter(l => l.status === "approved").map((l) => (
                    <LeaveCard key={l.id} leave={l} onDecide={decide} currentRole={role} />
                  ))}
            </TabsContent>

            <TabsContent value="all" className="mt-4 space-y-3">
              {loading ? skeletons : allLeaves.length === 0
                ? <EmptyState label="No leave records" />
                : allLeaves.map((l) => (
                    <LeaveCard key={l.id} leave={l} onDecide={decide} currentRole={role} />
                  ))}
            </TabsContent>

            {employeeId && (
              <TabsContent value="mine" className="mt-4 space-y-3">
                {loading ? skeletons : myLeaves.length === 0
                  ? <EmptyState label="You have no leave applications" />
                  : myLeaves.map((l) => <LeaveCard key={l.id} leave={l} />)}
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      {/* ── Employee self-service view ──────────────────────────────── */}
      {!isHRLevel && !isTeamLead && (
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Apply Leave CTA */}
            <Link
              href="/dashboard/hrms/leaves/apply"
              className="group flex items-center justify-between gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 group-hover:bg-indigo-600 p-2.5 rounded-lg transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Apply for Leave</p>
                  <p className="text-xs text-indigo-200 mt-0.5">Submit a new request</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Balance summary */}
            <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
              <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {loading ? "—" : balances.reduce((s, b) => s + Math.max(0, Number(b.total_days) - Number(b.used_days) - Number(b.pending_days)), 0)} days available
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  across {balances.length} leave type{balances.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Team on leave */}
            <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-lg">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {loading ? "—" : teamOnLeave.length} colleague{teamOnLeave.length !== 1 ? "s" : ""} on leave
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">this week</p>
              </div>
            </div>
          </div>

          {/* Leave Balances */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Your Leave Balances</h2>
              <span className="text-xs text-muted-foreground">{new Date().getFullYear()}</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : balances.length === 0 ? (
              <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No leave balance assigned yet. Contact HR.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {balances.map((b) => <BalanceCard key={b.id} balance={b} />)}
              </div>
            )}
          </div>

          {/* My Leave Requests + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* My Leaves (takes 2/3 width on desktop) */}
            <div className="lg:col-span-2">
              <Tabs defaultValue={myPending.length > 0 ? "pending" : "approved"}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">My Requests</h2>
                  <TabsList>
                    <TabsTrigger value="pending">
                      Pending
                      {myPending.length > 0 && (
                        <span className="ml-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 text-xs px-1.5 rounded-full">
                          {myPending.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="pending" className="space-y-3">
                  {loading ? skeletons : myPending.length === 0
                    ? <EmptyState label="No pending leave requests" />
                    : myPending.map((l) => <LeaveCard key={l.id} leave={l} />)}
                </TabsContent>

                <TabsContent value="approved" className="space-y-3">
                  {loading ? skeletons : myApproved.length === 0
                    ? <EmptyState label="No approved leaves" />
                    : myApproved.map((l) => <LeaveCard key={l.id} leave={l} />)}
                </TabsContent>

                <TabsContent value="history" className="space-y-3">
                  {loading ? skeletons : myHistory.length === 0
                    ? <EmptyState label="No leave history" />
                    : myHistory.map((l) => <LeaveCard key={l.id} leave={l} />)}
                </TabsContent>
              </Tabs>
            </div>

            {/* Right sidebar: Team availability + Holidays */}
            <div className="space-y-5">
              {/* Team Availability This Week */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <Umbrella className="h-4 w-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-foreground">Team on Leave This Week</h3>
                </div>

                {loading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
                  </div>
                ) : teamOnLeave.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Everyone's in this week!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {teamOnLeave.map((t, i) => {
                      const name = t.hr_employees?.profiles?.full_name ?? "—";
                      const avatarUrl = t.hr_employees?.profiles?.avatar_url;
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {t.hr_leave_types?.name ?? "Leave"} · {fmtRange(t.from_date, t.to_date)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming Holidays */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <PartyPopper className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-foreground">Upcoming Holidays</h3>
                </div>
                <div className="px-4 py-6 text-center">
                  <Zap className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Holiday calendar coming soon.</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">HR will publish the holiday list here.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject Dialog */}
      <RejectDialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) => rejectTarget && decide(rejectTarget, "reject", reason)}
      />
    </div>
  );
}
