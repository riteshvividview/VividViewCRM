"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { MONTHLY_REVENUE, QUARTERLY_REVENUE, REP_REVENUE } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

interface FilterProps { period: string }

export function RevenueReport({ period = "monthly" }: FilterProps) {
  const chartData = (period === "quarterly" ? QUARTERLY_REVENUE.map((d) => ({ ...d, month: d.quarter, deals: 0 })) : MONTHLY_REVENUE) as { month: string; actual: number; target: number; deals: number }[];
  const totalActual = MONTHLY_REVENUE.reduce((s, d) => s + d.actual, 0);
  const totalTarget = MONTHLY_REVENUE.reduce((s, d) => s + d.target, 0);
  const attainment  = Math.round((totalActual / totalTarget) * 100);
  const totalDeals  = MONTHLY_REVENUE.reduce((s, d) => s + d.deals, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Revenue"   value={`₹${totalActual.toFixed(1)}L`} sub="YTD"         color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="vs Target"       value={`${attainment}%`}               sub="attainment"  color={attainment >= 100 ? "text-emerald-600" : "text-amber-600"} />
        <MetricBadge label="Deals Closed"    value={totalDeals}                      sub="this period" color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Avg Deal Size"   value={`₹${(totalActual / totalDeals * 100).toFixed(0)}K`} sub="per deal" color="text-teal-600 dark:text-teal-400" />
      </div>

      {/* Monthly Revenue vs Target */}
      <ChartCard title="Revenue vs Target" sub="Actual bars + target line">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`₹${(v as number).toFixed(1)}L`]}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="target" name="Target" stroke={CHART_COLORS.coral} strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Quarterly bar */}
      <ChartCard title="Quarterly Comparison" sub="Actual vs target by quarter">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={QUARTERLY_REVENUE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} formatter={(v) => [`₹${v as number}L`]} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.teal}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" name="Target" fill={CHART_COLORS.coral} radius={[4, 4, 0, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue by rep table */}
      <ChartCard title="Revenue by Sales Rep">
        <div className="space-y-3">
          {REP_REVENUE.map((rep) => {
            const att = Math.round((rep.actual / rep.target) * 100);
            return (
              <div key={rep.name} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium text-foreground truncate">{rep.name.split(" ")[0]}</p>
                  <p className="text-[10px] text-muted-foreground">₹{rep.actual}L / ₹{rep.target}L</p>
                </div>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", att >= 100 ? "bg-emerald-500" : att >= 80 ? "bg-blue-500" : "bg-amber-500")}
                    style={{ width: `${Math.min(100, att)}%` }}
                  />
                </div>
                <span className={cn("text-xs font-semibold w-12 text-right shrink-0",
                  att >= 100 ? "text-emerald-600" : att >= 80 ? "text-blue-600" : "text-amber-600")}>
                  {att}%
                </span>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
