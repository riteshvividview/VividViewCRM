"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard, MetricBadge } from "./report-shell";
import { WON_VS_LOST, LOSS_REASONS, COMPETITORS } from "../data/mock-data";
import { CHART_COLORS } from "../types";
import { cn } from "@/lib/utils";

const REASON_COLORS = [
  CHART_COLORS.coral, CHART_COLORS.purple, CHART_COLORS.amber,
  CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.slate,
];

export function WonLostReport() {
  const totalWon  = WON_VS_LOST.reduce((s, m) => s + m.won, 0);
  const totalLost = WON_VS_LOST.reduce((s, m) => s + m.lost, 0);
  const winRate   = Math.round((totalWon / (totalWon + totalLost)) * 100);
  const totalLossCount = LOSS_REASONS.reduce((s, r) => s + r.count, 0);

  const pieData = LOSS_REASONS.map((r) => ({ name: r.reason, value: r.count }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBadge label="Deals Won"   value={totalWon}        sub="this period"    color="text-emerald-600 dark:text-emerald-400" />
        <MetricBadge label="Deals Lost"  value={totalLost}       sub="this period"    color="text-rose-600 dark:text-rose-400" />
        <MetricBadge label="Win Rate"    value={`${winRate}%`}   sub="won vs total"   color={winRate >= 60 ? "text-emerald-600" : "text-amber-600"} />
        <MetricBadge label="Loss Count"  value={totalLossCount}  sub="analysed"       color="text-muted-foreground" />
      </div>

      {/* Won vs Lost monthly */}
      <ChartCard title="Won vs Lost — Monthly" sub="Deal outcomes over time">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={WON_VS_LOST} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="won"  name="Won"  fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="lost" name="Lost" fill={CHART_COLORS.coral} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loss reasons pie */}
        <ChartCard title="Loss Reasons" sub="Why deals were lost">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ percent }: { percent?: number }) => percent != null ? `${(percent * 100).toFixed(0)}%` : ""}
                labelLine={false}
              >
                {pieData.map((_, i) => <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
                formatter={(v) => [`${v} deals (${Math.round(((v as number) / totalLossCount) * 100)}%)`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {LOSS_REASONS.map((r, i) => (
              <div key={r.reason} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: REASON_COLORS[i % REASON_COLORS.length] }} />
                <span className="text-xs text-muted-foreground flex-1">{r.reason}</span>
                <span className="text-xs font-semibold text-foreground">{r.pct}%</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Competitor table */}
        <ChartCard title="Competitor Win/Loss" sub="How we perform against each competitor">
          <div className="space-y-3">
            {COMPETITORS.map((c) => {
              const winPct = Math.round((c.win_vs / c.mentions) * 100);
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.mentions} mentions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${winPct}%` }} />
                      <div className="h-full bg-rose-400 rounded-r-full" style={{ width: `${100 - winPct}%` }} />
                    </div>
                    <span className={cn("text-xs font-semibold w-10 text-right", winPct >= 60 ? "text-emerald-600" : winPct >= 40 ? "text-blue-600" : "text-rose-600")}>
                      {winPct}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>{c.win_vs}W / {c.loss_vs}L</span>
                    <span className="text-emerald-600">{winPct}% win</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
