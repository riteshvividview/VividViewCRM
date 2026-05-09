"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MarketingCampaign } from "../types";
import { CAMPAIGN_TYPE_CONFIG } from "../types";

const DONUT_COLORS = [
  "#7C3AED", "#2563EB", "#EC4899", "#10B981",
  "#F59E0B", "#06B6D4", "#8B5CF6", "#EF4444",
];

interface BudgetDonutProps {
  campaigns: MarketingCampaign[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: p.payload.color }} />
        <span className="font-medium text-foreground">{p.name}</span>
      </div>
      <p className="text-muted-foreground mt-0.5">₹{(p.value / 1000).toFixed(0)}K spent</p>
    </div>
  );
}

export function BudgetDonut({ campaigns }: BudgetDonutProps) {
  const data = campaigns
    .filter((c) => c.spent > 0)
    .map((c, i) => ({
      name: CAMPAIGN_TYPE_CONFIG[c.type].label,
      value: c.spent,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  const totalSpent = data.reduce((s, d) => s + d.value, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value) => <span className="text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-16px" }}>
        <p className="text-xl font-bold text-foreground">{spentPct}%</p>
        <p className="text-[10px] text-muted-foreground">Budget used</p>
      </div>
    </div>
  );
}
