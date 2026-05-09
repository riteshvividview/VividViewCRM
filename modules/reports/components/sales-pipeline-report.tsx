"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { PIPELINE_FUNNEL, STAGE_AVG_DAYS } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

function pct(a: number, b: number) { return b ? ((a / b) * 100).toFixed(1) : "0"; }

export function SalesPipelineReport() {
  const total = PIPELINE_FUNNEL[0].count;
  const won   = PIPELINE_FUNNEL[PIPELINE_FUNNEL.length - 1].count;
  const overallConv = pct(won, total);
  const avgCycle = STAGE_AVG_DAYS.reduce((s, d) => s + d.days, 0).toFixed(1);

  const funnelColors = [CHART_COLORS.purple, CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.green, CHART_COLORS.coral];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Total Leads" value={total}        sub="entering pipeline"   color="text-foreground" />
        <MetricBadge label="Closed Won"  value={won}          sub="this period"          color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Win Rate"    value={`${overallConv}%`} sub="lead → close"   color="text-purple-600 dark:text-purple-400" />
        <MetricBadge label="Avg Cycle"   value={`${avgCycle}d`} sub="end-to-end"         color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Funnel bars */}
      <ChartCard title="Pipeline Funnel" sub="Lead count by stage">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={PIPELINE_FUNNEL} layout="vertical" margin={{ top: 0, right: 60, left: 80, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
              formatter={(v, _name, props) => [`${v} deals (${(props as { payload?: { conversion?: number } }).payload?.conversion ?? 0}% of top)`, "Count"]}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {PIPELINE_FUNNEL.map((_, i) => <Cell key={i} fill={funnelColors[i] ?? CHART_COLORS.purple} />)}
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Conversion rates table + avg days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Stage Conversion Rates">
          <div className="space-y-3">
            {PIPELINE_FUNNEL.slice(1).map((stage, i) => {
              const prev = PIPELINE_FUNNEL[i].count;
              const conv = parseFloat(pct(stage.count, prev));
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{PIPELINE_FUNNEL[i].stage} → {stage.stage}</span>
                    <span className={cn("font-semibold", conv >= 60 ? "text-emerald-600" : conv >= 50 ? "text-blue-600" : "text-amber-600")}>{conv}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${conv}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard title="Avg Days per Stage">
          <div className="space-y-3">
            {STAGE_AVG_DAYS.map((s) => (
              <div key={s.stage} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{s.stage}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(s.days / 15) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right">{s.days}d</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Pipeline value table */}
      <ChartCard title="Pipeline by Stage — Value">
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Stage","Deals","Value (₹L)","Conv. from Top","Avg Value"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PIPELINE_FUNNEL.map((row) => (
                <tr key={row.stage} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.stage}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.count}</td>
                  <td className="px-4 py-2.5 text-foreground">₹{row.value}L</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-sm font-medium", row.conversion >= 80 ? "text-emerald-600" : "text-muted-foreground")}>
                      {row.conversion}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    ₹{((row.value / row.count) * 100).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
