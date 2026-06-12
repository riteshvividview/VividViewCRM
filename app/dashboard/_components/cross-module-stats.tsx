"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, TrendingUp, ClipboardList, CalendarOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  color: string;
  href: string;
}

export function CrossModuleStats() {
  const [stats, setStats] = useState<StatItem[] | null>(null);

  useEffect(() => {
    async function load() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setStats(getMockStats());
        return;
      }
      try {
        const supabase = createClient();
        const today = new Date().toISOString().split("T")[0];

        const [empRes, taskRes, leaveRes, leadRes] = await Promise.all([
          supabase.from("hr_employees")
            .select("status"),
          supabase.from("tasks")
            .select("id", { count: "exact", head: true })
            .in("status", ["todo", "in_progress", "waiting"]),
          supabase.from("hr_leave_applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase.from("leads")
            .select("id", { count: "exact", head: true })
            .not("status", "in", '("Won","Lost")'),
        ]);

        const employees = empRes.data ?? [];
        const activeEmp = employees.filter((e) => e.status === "active").length;

        setStats([
          { label: "Employees",    value: employees.length, sub: `${activeEmp} active`,     icon: Users,          color: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",      href: "/dashboard/hrms/employees" },
          { label: "Open Tasks",   value: taskRes.count ?? 0,  sub: "in progress",           icon: ClipboardList,  color: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400", href: "/dashboard/actions" },
          { label: "Pending Leave",value: leaveRes.count ?? 0, sub: "awaiting approval",     icon: CalendarOff,    color: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",    href: "/dashboard/hrms/leaves" },
          { label: "Open Leads",   value: leadRes.count ?? 0,  sub: "in pipeline",           icon: TrendingUp,     color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400", href: "/dashboard/leads" },
        ]);
      } catch {
        setStats(getMockStats());
      }
    }
    load();
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading live data…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
      {stats.map((s) => (
        <Link key={s.label} href={s.href}
          className="group bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function getMockStats(): StatItem[] {
  return [
    { label: "Employees",     value: 24,  sub: "20 active",         icon: Users,         color: "bg-blue-50 text-blue-600",    href: "/dashboard/hrms/employees" },
    { label: "Open Tasks",    value: 18,  sub: "in progress",       icon: ClipboardList, color: "bg-purple-50 text-purple-600",href: "/dashboard/actions" },
    { label: "Pending Leave", value: 3,   sub: "awaiting approval", icon: CalendarOff,   color: "bg-amber-50 text-amber-600",  href: "/dashboard/hrms/leaves" },
    { label: "Open Leads",    value: 47,  sub: "in pipeline",       icon: TrendingUp,    color: "bg-emerald-50 text-emerald-600", href: "/dashboard/leads" },
  ];
}
