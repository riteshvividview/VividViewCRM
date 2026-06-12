"use client";

import { useEffect, useState } from "react";
import { ClipboardList, AlertTriangle, CalendarOff, Users, TrendingUp } from "lucide-react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

interface StatChip {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}

function Chip({ icon: Icon, label, value, color }: StatChip) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium",
      color
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-foreground font-bold">{value}</span>
      <span className="text-muted-foreground text-xs hidden sm:block">{label}</span>
    </div>
  );
}

// ── Employee strip ────────────────────────────────────────────────────────────

function EmployeeStrip({ name, userId }: { name: string; userId: string }) {
  const [stats, setStats] = useState({ dueToday: 0, overdue: 0, leaveBalance: 0 });

  useEffect(() => {
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      try {
        const supabase = createClient();
        const today = new Date().toISOString().split("T")[0];

        const [dueRes, overdueRes, leaveRes] = await Promise.all([
          supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", userId)
            .eq("due_date", today)
            .neq("status", "done"),
          supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", userId)
            .lt("due_date", today)
            .neq("status", "done"),
          supabase.from("hr_leave_balances")
            .select("balance_days")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle(),
        ]);

        setStats({
          dueToday: dueRes.count ?? 0,
          overdue: overdueRes.count ?? 0,
          leaveBalance: leaveRes.data?.balance_days ?? 0,
        });
      } catch {}
    }
    load();
  }, [userId]);

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {getGreeting()}, {name.split(" ")[0]} 👋
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip icon={ClipboardList} label="Due Today"      value={stats.dueToday}     color="bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900" />
          <Chip icon={AlertTriangle} label="Overdue"        value={stats.overdue}       color={stats.overdue > 0 ? "bg-red-50 border-red-100 dark:bg-red-950/30 dark:border-red-900" : "bg-muted border-border"} />
          <Chip icon={CalendarOff}   label="Leave Days Left" value={stats.leaveBalance}  color="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900" />
        </div>
      </div>
    </div>
  );
}

// ── Team Lead strip ───────────────────────────────────────────────────────────

function TeamLeadStrip({ name, userId }: { name: string; userId: string }) {
  const [stats, setStats] = useState({ openTasks: 0, onLeave: 0, myLeads: 0 });

  useEffect(() => {
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      try {
        const supabase = createClient();
        const today = new Date().toISOString().split("T")[0];

        const [tasksRes, leaveRes, leadsRes] = await Promise.all([
          supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .in("status", ["todo", "in_progress", "waiting"]),
          supabase.from("hr_leave_applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved")
            .lte("from_date", today)
            .gte("to_date", today),
          supabase.from("leads")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", userId)
            .not("status", "in", '("Won","Lost")'),
        ]);

        setStats({
          openTasks: tasksRes.count ?? 0,
          onLeave: leaveRes.count ?? 0,
          myLeads: leadsRes.count ?? 0,
        });
      } catch {}
    }
    load();
  }, [userId]);

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {getGreeting()}, {name.split(" ")[0]} 👋
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip icon={ClipboardList} label="Team Open Tasks"    value={stats.openTasks} color="bg-purple-50 border-purple-100 dark:bg-purple-950/30 dark:border-purple-900" />
          <Chip icon={CalendarOff}   label="Team On Leave"      value={stats.onLeave}   color="bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900" />
          <Chip icon={TrendingUp}    label="My Leads Pipeline"  value={stats.myLeads}   color="bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900" />
        </div>
      </div>
    </div>
  );
}

// ── HR strip ──────────────────────────────────────────────────────────────────

function HrStrip({ name }: { name: string }) {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      try {
        const supabase = createClient();
        const { count } = await supabase
          .from("hr_leave_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        setPending(count ?? 0);
      } catch {}
    }
    load();
  }, []);

  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">
            {getGreeting()}, {name.split(" ")[0]} 👋
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip icon={Users}       label="My Tasks page" value="Tasks" color="bg-muted border-border" />
          <Chip icon={CalendarOff} label="Pending Leaves" value={pending} color={pending > 0 ? "bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900" : "bg-muted border-border"} />
        </div>
      </div>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function RoleDashboardStrip() {
  const profile = useShellProfile();
  if (!profile) return null;

  const { role, full_name, user_id } = profile;
  const name = full_name || "there";

  if (role === "employee")  return <EmployeeStrip  name={name} userId={user_id} />;
  if (role === "team_lead") return <TeamLeadStrip  name={name} userId={user_id} />;
  if (role === "hr")        return <HrStrip        name={name} />;

  return null; // super_admin has their own dashboard page
}
