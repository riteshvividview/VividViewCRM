"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Line,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { CAMPAIGN_ROI } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

export function CampaignPerformanceReport() {
  const totalBudget  = CAMPAIGN_ROI.reduce((s, c) => s + c.budget, 0);
  const totalSpent   = CAMPAIGN_ROI.reduce((s, c) => s + c.spent, 0);
  const totalLeads   = CAMPAIGN_ROI.reduce((s, c) => s + c.leads, 0);
  const totalRevenue = CAMPAIGN_ROI.reduce((s, c) => s + c.revenue, 0);
  const avgROI       = Math.round(CAMPAIGN_ROI.reduce((s, c) => s + c.roi, 0) / CAMPAIGN_ROI.length);

  const sortedROI = [...CAMPAIGN_ROI].sort((a, b) => b.roi - a.roi);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Budget"  value={`₹${totalBudget.toFixed(1)}L`} sub="allocated"     color="text-foreground" />
        <MetricBadge label="Total Spent"   value={`₹${totalSpent.toFixed(2)}L`}  sub={`${Math.round((totalSpent / totalBudget) * 100)}% utilised`} color="text-amber-600 dark:text-amber-400" />
        <MetricBadge label="Total Revenue" value={`₹${totalRevenue.toFixed(1)}L`} sub="attributed"    color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Avg ROI"       value={`${avgROI}%`}                   sub="across campaigns" color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* ROI comparison bar */}
      <ChartCard title="ROI by Campaign" sub="Return on ad spend (%)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sortedROI} margin={{ top: 4, right: 4, left: -10, bottom: 40 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v as number}%`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`${v as number}%`, "ROI"]}
            />
            <Bar dataKey="roi" name="ROI" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Budget vs revenue */}
      <ChartCard title="Spend vs Revenue by Campaign" sub="₹L comparison">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={CAMPAIGN_ROI} margin={{ top: 4, right: 4, left: -10, bottom: 40 }} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v) => [`₹${(v as number).toFixed(2)}L`]}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="spent"   name="Spent"   fill={CHART_COLORS.coral}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.teal}   radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="budget" name="Budget" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} strokeDasharray="6 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Full campaign table */}
      <ChartCard title="Campaign Performance Details">
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Campaign","Budget","Spent","Leads","Revenue","CPL (₹)","ROI"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedROI.map((row) => {
                const cpl = row.leads > 0 ? Math.round((row.spent * 100000) / row.leads) : 0;
                return (
                  <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">₹{row.budget.toFixed(2)}L</td>
                    <td className="px-4 py-2.5 text-foreground">₹{row.spent.toFixed(2)}L</td>
                    <td className="px-4 py-2.5 text-foreground">{row.leads}</td>
                    <td className="px-4 py-2.5 text-foreground">₹{row.revenue.toFixed(1)}L</td>
                    <td className="px-4 py-2.5 text-muted-foreground">₹{cpl.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                        row.roi >= 500 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        row.roi >= 200 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {row.roi}%
                      </span>
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
