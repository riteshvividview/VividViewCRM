"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import type { MarketingCampaign } from "../types";
import { CAMPAIGN_TYPE_CONFIG } from "../types";
import { cn } from "@/lib/utils";

const SLIDER_COLORS = [
  "accent-purple-500", "accent-blue-500", "accent-pink-500", "accent-emerald-500",
  "accent-amber-500", "accent-cyan-500", "accent-indigo-500", "accent-red-500",
];
const BAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-pink-500", "bg-emerald-500",
  "bg-amber-500", "bg-cyan-500", "bg-indigo-500", "bg-red-500",
];

interface BudgetSlidersProps {
  campaigns: MarketingCampaign[];
}

export function BudgetSliders({ campaigns: initialCampaigns }: BudgetSlidersProps) {
  const [budgets, setBudgets] = useState<Record<string, number>>(
    Object.fromEntries(initialCampaigns.map((c) => [c.id, c.budget]))
  );

  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const maxBudget = Math.max(...Object.values(budgets), 1);

  function setVal(id: string, val: number) {
    setBudgets((p) => ({ ...p, [id]: val }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Allocation</p>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          ₹{(totalBudget / 1000).toFixed(0)}K total
        </div>
      </div>

      {initialCampaigns.map((c, i) => {
        const val = budgets[c.id] ?? c.budget;
        const pct = Math.round((val / totalBudget) * 100);
        return (
          <div key={c.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
                {CAMPAIGN_TYPE_CONFIG[c.type].label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{pct}%</span>
                <span className="text-xs font-semibold text-foreground w-16 text-right">₹{(val / 1000).toFixed(0)}K</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={5_00_000}
              step={5000}
              value={val}
              onChange={(e) => setVal(c.id, Number(e.target.value))}
              className={cn("w-full h-1.5 rounded-full cursor-pointer appearance-none bg-muted", SLIDER_COLORS[i % SLIDER_COLORS.length])}
            />
            <div className="h-1.5 bg-muted rounded-full overflow-hidden -mt-0.5">
              <div
                className={cn("h-full rounded-full transition-all", BAR_COLORS[i % BAR_COLORS.length])}
                style={{ width: `${(val / maxBudget) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
