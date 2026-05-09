"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { LEAD_SOURCES } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  CHART_COLORS.purple, CHART_COLORS.teal, CHART_COLORS.coral,
  CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.pink,
  CHART_COLORS.amber, CHART_COLORS.slate,
];

export function LeadSourceReport() {
  const totalLeads     = LEAD_SOURCES.reduce((s, d) => s + d.leads, 0);
  const totalConverted = LEAD_SOURCES.reduce((s, d) => s + d.converted, 0);
  const totalRevenue   = LEAD_SOURCES.reduce((s, d) => s + d.revenue, 0);
  const overallConv    = Math.round((totalConverted / totalLeads) * 100);

  const pieData = LEAD_SOURCES.map((s) => ({ name: s.source, value: s.leads }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Leads"    value={totalLeads}                            sub="all sources"   color="text-foreground" />
        <MetricBadge label="Converted"      value={totalConverted}                        sub="this period"   color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Conv. Rate"     value={`${overallConv}%`}                     sub="avg across sources" color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Total Revenue"  value={`₹${totalRevenue.toFixed(1)}L`}        sub="from all leads" color="text-teal-600 dark:text-teal-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <ChartCard title="Lead Volume by Source" sub="Share of total leads">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
                formatter={(v) => [`${v} leads (${(((v as number) / totalLeads) * 100).toFixed(1)}%)`]}
              />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue by source bar */}
        <ChartCard title="Revenue by Source" sub="₹L closed per channel">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={LEAD_SOURCES} layout="vertical" margin={{ top: 0, right: 50, left: 80, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
                formatter={(v) => [`₹${(v as number).toFixed(1)}L`]}
              />
              <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.teal} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Source breakdown table */}
      <ChartCard title="Source Performance Breakdown">
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Source","Leads","Converted","Conv. %","CPL (₹)","Revenue","Rev/Lead"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LEAD_SOURCES.sort((a, b) => b.revenue - a.revenue).map((row, i) => {
                const conv = Math.round((row.converted / row.leads) * 100);
                return (
                  <tr key={row.source} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium text-foreground">{row.source}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{row.leads}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.converted}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${conv}%` }} />
                        </div>
                        <span className={cn("text-xs font-semibold", conv >= 40 ? "text-emerald-600" : conv >= 25 ? "text-blue-600" : "text-amber-600")}>{conv}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.cpl === 0 ? "Free" : `₹${row.cpl.toLocaleString()}`}</td>
                    <td className="px-4 py-2.5 text-foreground">₹{row.revenue.toFixed(1)}L</td>
                    <td className="px-4 py-2.5 text-muted-foreground">₹{((row.revenue / row.leads) * 100).toFixed(0)}K</td>
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
