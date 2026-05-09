"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { ACTIVITY_BY_REP, ACTIVITY_HEATMAP } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 11 }, (_, i) => `${i + 8}:00`);

function heatColor(value: number, max: number) {
  const pct = value / max;
  if (pct >= 0.8) return "bg-purple-600";
  if (pct >= 0.6) return "bg-purple-400";
  if (pct >= 0.4) return "bg-purple-300";
  if (pct >= 0.2) return "bg-purple-200";
  return "bg-muted";
}

export function ActivityReport() {
  const totalCalls    = ACTIVITY_BY_REP.reduce((s, r) => s + r.calls, 0);
  const totalEmails   = ACTIVITY_BY_REP.reduce((s, r) => s + r.emails, 0);
  const totalMeetings = ACTIVITY_BY_REP.reduce((s, r) => s + r.meetings, 0);
  const totalDemos    = ACTIVITY_BY_REP.reduce((s, r) => s + r.demos, 0);

  const allValues = ACTIVITY_HEATMAP.flatMap((row) => HOURS.map((h) => ((row as unknown as Record<string, number>)[h]) ?? 0));
  const maxHeat   = Math.max(...allValues);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Calls"    value={totalCalls}    sub="this period" color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Total Emails"   value={totalEmails}   sub="this period" color="text-teal-600 dark:text-teal-400" />
        <MetricBadge label="Meetings"       value={totalMeetings} sub="this period" color="text-blue-600 dark:text-blue-400" />
        <MetricBadge label="Demos"          value={totalDemos}    sub="this period" color="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Activity by rep bar chart */}
      <ChartCard title="Activity Volume by Rep" sub="Calls, emails, meetings and demos">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ACTIVITY_BY_REP} margin={{ top: 4, right: 4, left: -20, bottom: 40 }} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => v.split(" ")[0]} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="calls"    name="Calls"    fill={CHART_COLORS.purple} radius={[3, 3, 0, 0]} />
            <Bar dataKey="emails"   name="Emails"   fill={CHART_COLORS.teal}   radius={[3, 3, 0, 0]} />
            <Bar dataKey="meetings" name="Meetings" fill={CHART_COLORS.blue}   radius={[3, 3, 0, 0]} />
            <Bar dataKey="demos"    name="Demos"    fill={CHART_COLORS.green}  radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Heatmap */}
      <ChartCard title="Activity Heatmap" sub="Outreach volume by day and hour (Mon–Fri, 8am–6pm)">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Hour header */}
            <div className="flex mb-1 pl-10">
              {HOURS.map((h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h.replace(":00", "")}</div>
              ))}
            </div>
            {ACTIVITY_HEATMAP.map((row) => (
              <div key={row.day} className="flex items-center gap-0.5 mb-0.5">
                <span className="w-10 text-xs text-muted-foreground shrink-0">{row.day}</span>
                {HOURS.map((h) => {
                  const v = ((row as unknown as Record<string, number>)[h]) ?? 0;
                  return (
                    <div
                      key={h}
                      title={`${row.day} ${h}: ${v} activities`}
                      className={cn("flex-1 h-7 rounded-sm transition-colors cursor-default", heatColor(v, maxHeat))}
                    />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {["bg-muted","bg-purple-200","bg-purple-300","bg-purple-400","bg-purple-600"].map((c) => (
                <div key={c} className={cn("w-5 h-3 rounded-sm", c)} />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </ChartCard>

      {/* Activity mix table */}
      <ChartCard title="Activity Breakdown per Rep">
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Rep","Calls","Emails","Meetings","Demos","Total","Calls %"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ACTIVITY_BY_REP.map((rep) => {
                const total = rep.calls + rep.emails + rep.meetings + rep.demos;
                const callPct = Math.round((rep.calls / total) * 100);
                return (
                  <tr key={rep.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{rep.name.split(" ")[0]}</td>
                    <td className="px-4 py-2.5 text-foreground">{rep.calls}</td>
                    <td className="px-4 py-2.5 text-foreground">{rep.emails}</td>
                    <td className="px-4 py-2.5 text-foreground">{rep.meetings}</td>
                    <td className="px-4 py-2.5 text-foreground">{rep.demos}</td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{total}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${callPct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{callPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
