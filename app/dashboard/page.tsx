"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserRoundSearch, Handshake, CircleCheck, DollarSign,
  ArrowUpRight, ArrowDownRight, CalendarDays, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeams, MOCK_MEMBERS } from "@/modules/teams/hooks/use-teams";
import { useMarketing, TERRITORY_DATA } from "@/modules/marketing/hooks/use-marketing";
import { LeadSourceChart } from "@/modules/marketing/components/lead-source-chart";
import { BudgetDonut } from "@/modules/marketing/components/budget-donut";
import { Leaderboard } from "@/modules/teams/components/leaderboard";
import { TargetProgress } from "@/modules/teams/components/target-progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ── Summary card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, change, up, icon: Icon, color, href }: {
  label: string; value: string; change: string; up: boolean;
  icon: React.ElementType; color: string; href: string;
}) {
  return (
    <Link href={href} className="group bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {up ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
        <span className={cn("text-xs font-semibold", up ? "text-emerald-600" : "text-red-500")}>{change}</span>
        <span className="text-xs text-muted-foreground">vs last month</span>
      </div>
    </Link>
  );
}

// ── Deals funnel chart ────────────────────────────────────────────────────────
const FUNNEL_DATA = [
  { stage: "Prospecting", hyderabad: 42, mumbai: 28, bangalore: 35, delhi: 22 },
  { stage: "Qualified",   hyderabad: 31, mumbai: 21, bangalore: 26, delhi: 18 },
  { stage: "Proposal",    hyderabad: 22, mumbai: 14, bangalore: 19, delhi: 13 },
  { stage: "Negotiation", hyderabad: 14, mumbai: 9,  bangalore: 11, delhi: 8 },
  { stage: "Closed Won",  hyderabad: 8,  mumbai: 5,  bangalore: 7,  delhi: 4 },
];

const LOCATION_COLORS: Record<string, string> = {
  hyderabad: "#7C3AED",
  mumbai:    "#2563EB",
  bangalore: "#10B981",
  delhi:     "#F59E0B",
};

function DealsFunnelChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={FUNNEL_DATA} layout="vertical" margin={{ top: 0, right: 4, left: 60, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
        {Object.entries(LOCATION_COLORS).map(([key, color]) => (
          <Bar key={key} dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)} stackId="a" fill={color} radius={key === "delhi" ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Individual targets widget ─────────────────────────────────────────────────
const IND_TARGETS = MOCK_MEMBERS.slice(0, 4).map((m) => ({
  name: m.name.split(" ")[0],
  meetings: m.meetings_booked,
  deals: m.deals_closed,
  score: m.performance_score,
}));

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { teams } = useTeams();
  const { campaigns } = useMarketing();
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo]   = useState("2026-05-08");
  const [currency, setCurrency] = useState("INR");

  // aggregate targets across all teams
  const allTargets = teams.flatMap((t) => t.targets);
  const revenueTarget   = allTargets.find((t) => t.type === "revenue" && t.assigned_type === "team" && t.assigned_to === "tm1");
  const callTarget      = allTargets.find((t) => t.type === "calls"   && t.assigned_type === "team" && t.assigned_to === "tm1");
  const closureTarget   = allTargets.find((t) => t.type === "closures"&& t.assigned_type === "team" && t.assigned_to === "tm1");

  const summaryTargets = [
    revenueTarget,
    callTarget,
    closureTarget,
  ].filter(Boolean) as typeof allTargets;

  const closedWon = 24;
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance overview across teams, campaigns, and pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />From
          </div>
          <Input type="date" className="h-8 text-xs w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" className="h-8 text-xs w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="h-8 text-xs px-2 rounded-lg border border-border bg-background text-foreground">
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Filter className="h-3 w-3" />Filter
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total Leads"   value="284"  change="+12%" up href="/dashboard/leads"   icon={UserRoundSearch} color="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
        <StatCard label="Active Deals"  value="47"   change="+8%"  up href="/dashboard/deals"   icon={Handshake}       color="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400" />
        <StatCard label="Closed Won"    value={String(closedWon)} change="+18%" up href="/dashboard/deals"   icon={CircleCheck}     color="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" />
        <StatCard label="Pipeline Value" value={formatCurrency(1_240_000)} change="+22%" up href="/dashboard/deals" icon={DollarSign} color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
      </div>

      {/* Target progress + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Monthly Targets</p>
          {summaryTargets.length > 0
            ? <TargetProgress targets={summaryTargets} />
            : (
              <div className="space-y-4">
                {[
                  { label: "Revenue",  pct: 79, color: "bg-emerald-500" },
                  { label: "Calls",    pct: 92, color: "bg-blue-500" },
                  { label: "Emails",   pct: 68, color: "bg-purple-500" },
                  { label: "Closures", pct: 82, color: "bg-pink-500" },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={cn("font-medium", pct >= 80 ? "text-emerald-600" : "text-amber-600")}>{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Performers</p>
            <Link href="/dashboard/teams" className="text-xs text-purple-600 hover:text-purple-700 font-medium">View all →</Link>
          </div>
          <Leaderboard members={MOCK_MEMBERS} limit={5} />
        </div>
      </div>

      {/* Funnel + Individual targets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Deals Funnel by Stage & Territory</p>
          <DealsFunnelChart />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Individual Targets</p>
          <div className="space-y-3">
            {IND_TARGETS.map((m) => (
              <div key={m.name} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[10px] font-bold text-purple-700 dark:text-purple-400 shrink-0">
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-foreground truncate">{m.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-1">{m.deals} deals · {m.meetings}m</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", m.score >= 90 ? "bg-emerald-500" : m.score >= 75 ? "bg-blue-500" : "bg-amber-500")}
                      style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row: Lead sources + Territory + Campaign spend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Performing Lead Sources</p>
            <Link href="/dashboard/campaigns" className="text-xs text-purple-600 font-medium">View campaigns →</Link>
          </div>
          <LeadSourceChart />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campaign Spend</p>
            <Link href="/dashboard/campaigns" className="text-xs text-purple-600 font-medium">View →</Link>
          </div>
          <BudgetDonut campaigns={campaigns} />
        </div>
      </div>

      {/* Territory bar */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Performing Territories</p>
          <Link href="/dashboard/teams" className="text-xs text-purple-600 font-medium">Manage territories →</Link>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={TERRITORY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="city" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
            <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} fill="#7C3AED" />
            <Bar dataKey="pipeline" name="In Pipeline" radius={[4, 4, 0, 0]} fill="#10B981" opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
