"use client";

import { useMemo } from "react";
import { DEAL_STAGES, STAGE_CONFIG, type Deal } from "../types";
import { formatCurrency, cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface RevenueForecastProps {
  deals: Deal[];
}

export function RevenueForecast({ deals }: RevenueForecastProps) {
  const byStage = useMemo(() => {
    return DEAL_STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const total = stageDeals.reduce((sum, d) => sum + d.value, 0);
      return { stage, total, count: stageDeals.length };
    });
  }, [deals]);

  const grandTotal = byStage.reduce((sum, s) => sum + s.total, 0);
  const maxTotal = Math.max(...byStage.map((s) => s.total), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-purple-600" />
        <h2 className="text-sm font-semibold text-foreground">Revenue Pipeline Forecast</h2>
        <span className="ml-auto text-sm font-bold text-foreground">{formatCurrency(grandTotal, "INR")} total</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {byStage.map((s) => {
          const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
          const cfg = STAGE_CONFIG[s.stage];
          return (
            <div key={s.stage} className="flex flex-col gap-1.5">
              <div className="flex items-end gap-1 h-12">
                <div
                  className={cn("w-full rounded-t transition-all", cfg.bg.replace("100", "400").replace("muted", "slate-200"))}
                  style={{ height: `${(s.total / maxTotal) * 100}%`, minHeight: s.total > 0 ? "4px" : "0" }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground truncate" title={s.stage}>{s.stage}</p>
                <p className="text-xs text-muted-foreground">{s.count} deals</p>
                <p className={cn("text-xs font-bold", cfg.color)}>{formatCurrency(s.total, "INR")}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden flex">
        {byStage.filter((s) => s.total > 0).map((s, i) => {
          const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
          const colors = ["bg-slate-400","bg-blue-400","bg-amber-400","bg-purple-400","bg-emerald-400"];
          return <div key={s.stage} className={cn("h-full transition-all", colors[i])} style={{ width: `${pct}%` }} />;
        })}
      </div>
    </div>
  );
}

