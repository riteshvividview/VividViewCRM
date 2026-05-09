"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { TERRITORY_REVENUE } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

const CITY_COLORS = [
  CHART_COLORS.purple, CHART_COLORS.teal, CHART_COLORS.coral,
  CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.pink,
  CHART_COLORS.amber,
];

export function TerritoryReport() {
  const totalRevenue  = TERRITORY_REVENUE.reduce((s, t) => s + t.revenue, 0);
  const totalPipeline = TERRITORY_REVENUE.reduce((s, t) => s + t.pipeline, 0);
  const totalDeals    = TERRITORY_REVENUE.reduce((s, t) => s + t.deals, 0);
  const avgWinRate    = Math.round(TERRITORY_REVENUE.reduce((s, t) => s + t.win_rate, 0) / TERRITORY_REVENUE.length);

  const sorted = [...TERRITORY_REVENUE].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Revenue"  value={`₹${totalRevenue.toFixed(1)}L`}  sub="all territories" color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Active Pipeline" value={`₹${totalPipeline.toFixed(1)}L`} sub="in progress"     color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Total Deals"    value={totalDeals}                        sub="closed"          color="text-teal-600 dark:text-teal-400" />
        <MetricBadge label="Avg Win Rate"   value={`${avgWinRate}%`}                  sub="across cities"   color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Revenue by city bar */}
      <ChartCard title="Revenue by Territory" sub="Closed revenue (₹L) per city">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sorted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="city" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`₹${(v as number).toFixed(1)}L`]}
            />
            <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
              {sorted.map((_, i) => <Cell key={i} fill={CITY_COLORS[i % CITY_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue + Pipeline grouped */}
      <ChartCard title="Revenue vs Pipeline by Territory" sub="Closed vs in-progress (₹L)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sorted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="city" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`₹${(v as number).toFixed(1)}L`]}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue"  name="Revenue"  fill={CHART_COLORS.teal}   radius={[4, 4, 0, 0]} />
            <Bar dataKey="pipeline" name="Pipeline" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Territory table */}
      <ChartCard title="Territory Performance Details">
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["City","Revenue","Pipeline","Deals","Win Rate","Rev/Deal","Share"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((row, i) => {
                const share = Math.round((row.revenue / totalRevenue) * 100);
                return (
                  <tr key={row.city} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CITY_COLORS[i % CITY_COLORS.length] }} />
                        <span className="font-medium text-foreground">{row.city}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">₹{row.revenue.toFixed(1)}L</td>
                    <td className="px-4 py-2.5 text-muted-foreground">₹{row.pipeline.toFixed(1)}L</td>
                    <td className="px-4 py-2.5 text-foreground">{row.deals}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs font-semibold", row.win_rate >= 42 ? "text-emerald-600" : row.win_rate >= 38 ? "text-blue-600" : "text-amber-600")}>
                        {row.win_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">₹{((row.revenue / row.deals) * 100).toFixed(0)}K</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: CITY_COLORS[i % CITY_COLORS.length] }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{share}%</span>
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
