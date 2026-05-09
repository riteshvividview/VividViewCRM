"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { REP_REVENUE, ACTIVITY_BY_REP } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

export function TeamPerformanceReport() {
  const sorted = [...REP_REVENUE].sort((a, b) => b.actual - a.actual);
  const topRep  = sorted[0];
  const avgAtt  = Math.round(sorted.reduce((s, r) => s + (r.actual / r.target) * 100, 0) / sorted.length);
  const totalRev = sorted.reduce((s, r) => s + r.actual, 0);

  const radarData = [
    { metric: "Revenue", value: 85 },
    { metric: "Calls",   value: 72 },
    { metric: "Emails",  value: 78 },
    { metric: "Meetings",value: 65 },
    { metric: "Demos",   value: 70 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Team Revenue"  value={`₹${totalRev.toFixed(1)}L`} sub="combined YTD"     color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Avg Attainment" value={`${avgAtt}%`}              sub="vs individual targets" color={avgAtt >= 100 ? "text-emerald-600" : "text-amber-600"} />
        <MetricBadge label="Top Performer" value={topRep.name.split(" ")[0]} sub={`₹${topRep.actual}L`} color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Team Size"     value={sorted.length}              sub="active reps"      color="text-teal-600 dark:text-teal-400" />
      </div>

      {/* Revenue attainment bars */}
      <ChartCard title="Revenue Attainment by Rep" sub="Actual vs target (₹L)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={REP_REVENUE} margin={{ top: 4, right: 4, left: -20, bottom: 40 }} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => v.split(" ")[0]} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v as number}L`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`₹${v as number}L`]}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" name="Target" fill={CHART_COLORS.coral}  radius={[4, 4, 0, 0]} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <ChartCard title="Leaderboard" sub="Ranked by revenue attainment">
          <div className="space-y-3">
            {sorted.map((rep, i) => {
              const att = Math.round((rep.actual / rep.target) * 100);
              return (
                <div key={rep.name} className={cn("flex items-center gap-3 p-2 rounded-xl", i === 0 && "bg-amber-50 dark:bg-amber-950/20")}>
                  <span className="w-6 text-center text-sm">{MEDALS[i] ?? <span className="text-muted-foreground font-medium">{i + 1}</span>}</span>
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-medium text-foreground">{rep.name.split(" ")[0]}</p>
                    <p className="text-[10px] text-muted-foreground">₹{rep.actual}L / ₹{rep.target}L</p>
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", att >= 100 ? "bg-emerald-500" : att >= 80 ? "bg-blue-500" : "bg-amber-500")}
                      style={{ width: `${Math.min(100, att)}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-bold w-10 text-right", att >= 100 ? "text-emerald-600" : att >= 80 ? "text-blue-600" : "text-amber-600")}>
                    {att}%
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>

        {/* Activity comparison */}
        <ChartCard title="Activity by Rep" sub="Calls, emails, meetings, demos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ACTIVITY_BY_REP} layout="vertical" margin={{ top: 0, right: 8, left: 70, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => v.split(" ")[0]} width={70} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="calls"    name="Calls"    fill={CHART_COLORS.purple} radius={[0, 3, 3, 0]} />
              <Bar dataKey="emails"   name="Emails"   fill={CHART_COLORS.teal}   radius={[0, 3, 3, 0]} />
              <Bar dataKey="meetings" name="Meetings" fill={CHART_COLORS.coral}  radius={[0, 3, 3, 0]} />
              <Bar dataKey="demos"    name="Demos"    fill={CHART_COLORS.green}  radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Team avg radar */}
      <ChartCard title="Team Average Performance Profile" sub="Normalised score across key KPIs (100 = at target)">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart cx="50%" cy="50%" outerRadius={80} data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Radar name="Team Avg" dataKey="value" stroke={CHART_COLORS.purple} fill={CHART_COLORS.purple} fillOpacity={0.25} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
