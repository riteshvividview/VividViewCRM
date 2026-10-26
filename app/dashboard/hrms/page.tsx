"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Clock, CalendarOff, TrendingUp, UserPlus,
  ChevronRight, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface HrmsStat { label: string; value: number | string; sub?: string; icon: React.ReactNode; color: string; href: string; }
interface PendingLeave { id: string; employee_name: string; leave_type: string; days: number; from_date: string; to_date: string; }

const QUICK_LINKS = [
  { label: "Add Employee", href: "/dashboard/hrms/employees?new=1", icon: UserPlus },
  { label: "Mark Attendance", href: "/dashboard/hrms/attendance", icon: Clock },
  { label: "Leave Requests", href: "/dashboard/hrms/leaves?tab=pending", icon: CalendarOff },
  { label: "Run Payroll", href: "/dashboard/hrms/payroll", icon: TrendingUp },
];

export default function HrmsDashboardPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, on_leave: 0, new_this_month: 0 });
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, late: 0 });
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
        if (!profile?.workspace_id) return;

        const wid = profile.workspace_id;
        const today = new Date().toISOString().split("T")[0];
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

        const [empRes, todayAttRes, pendingRes, newRes, onLeaveRes] = await Promise.all([
          supabase.from("hr_employees").select("status").eq("workspace_id", wid),
          supabase.from("hr_attendance").select("status").eq("workspace_id", wid).eq("date", today),
          supabase.from("hr_leave_applications")
            .select("id, days_count, from_date, to_date, hr_leave_types(name), hr_employees(profiles(full_name))")
            .eq("workspace_id", wid).in("status", ["pending_l1", "pending_l2"]).order("created_at", { ascending: false }).limit(5),
          supabase.from("hr_employees").select("id").eq("workspace_id", wid).gte("date_of_joining", firstOfMonth),
          supabase.from("hr_leave_applications")
            .select("employee_id")
            .eq("workspace_id", wid).eq("status", "approved").lte("from_date", today).gte("to_date", today),
        ]);

        const employees = empRes.data ?? [];
        const onLeaveToday = new Set((onLeaveRes.data ?? []).map((l) => l.employee_id)).size;
        setStats({
          total: employees.length,
          active: employees.filter((e) => e.status === "active").length,
          on_leave: onLeaveToday,
          new_this_month: newRes.data?.length ?? 0,
        });

        const att = todayAttRes.data ?? [];
        setAttendanceSummary({
          present: att.filter((a) => a.status === "present").length,
          absent: att.filter((a) => a.status === "absent").length,
          late: att.filter((a) => a.status === "late").length,
        });

        if (pendingRes.error) console.error("Pending leaves fetch error:", pendingRes.error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPendingLeaves((pendingRes.data ?? []).map((l: any) => ({
          id: l.id,
          employee_name: l.hr_employees?.profiles?.full_name ?? "Unknown",
          leave_type: l.hr_leave_types?.name ?? "Leave",
          days: Number(l.days_count),
          from_date: l.from_date,
          to_date: l.to_date,
        })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const STATS: HrmsStat[] = [
    { label: "Total Employees", value: stats.total, sub: `${stats.active} active`, icon: <Users className="h-5 w-5" />, color: "bg-blue-50 text-blue-600", href: "/dashboard/hrms/employees" },
    { label: "Present Today", value: attendanceSummary.present, sub: `${attendanceSummary.late} late`, icon: <Clock className="h-5 w-5" />, color: "bg-green-50 text-green-600", href: "/dashboard/hrms/attendance" },
    { label: "On Leave Today", value: stats.on_leave, sub: "approved leaves", icon: <CalendarOff className="h-5 w-5" />, color: "bg-orange-50 text-orange-600", href: "/dashboard/hrms/leaves" },
    { label: "New This Month", value: stats.new_this_month, sub: "joiners", icon: <UserPlus className="h-5 w-5" />, color: "bg-purple-50 text-purple-600", href: "/dashboard/hrms/employees" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="HRMS"
        subtitle="People & HR Management"
        actions={<Button asChild size="sm"><Link href="/dashboard/hrms/employees?new=1"><UserPlus className="h-4 w-4 mr-2" />Add Employee</Link></Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <Link key={s.label} href={s.href} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{loading ? "—" : s.value}</p>
                {s.sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</p>}
              </div>
              <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {QUICK_LINKS.map((ql) => (
              <Link key={ql.label} href={ql.href} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <ql.icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-foreground/90">{ql.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/70 group-hover:text-foreground/80" />
              </Link>
            ))}
          </div>
        </div>

        {/* Attendance summary */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Today's Attendance</h3>
            <Link href="/dashboard/hrms/attendance" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-foreground/80">Present</span>
              </div>
              <span className="font-semibold text-foreground">{loading ? "—" : attendanceSummary.present}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-foreground/80">Late</span>
              </div>
              <span className="font-semibold text-foreground">{loading ? "—" : attendanceSummary.late}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-foreground/80">Absent</span>
              </div>
              <span className="font-semibold text-foreground">{loading ? "—" : attendanceSummary.absent}</span>
            </div>
          </div>
        </div>

        {/* Pending leave approvals */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Pending Approvals</h3>
            <Link href="/dashboard/hrms/leaves?tab=pending" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : pendingLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 text-center py-4">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map((l) => (
                <Link key={l.id} href={`/dashboard/hrms/leaves?tab=pending&id=${l.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{l.employee_name}</p>
                    <p className="text-xs text-muted-foreground/70">{l.leave_type} · {l.days}d</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
