"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { TERRITORY_DATA } from "../hooks/use-marketing";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">₹{p.value.toFixed(1)}L</span>
        </div>
      ))}
    </div>
  );
}

const CITY_COLORS: Record<string, string> = {
  Hyderabad: "#7C3AED",
  Mumbai:    "#2563EB",
  Bangalore: "#10B981",
  "Delhi NCR":"#F59E0B",
  Gurugram:  "#EC4899",
  Chennai:   "#06B6D4",
  Pune:      "#8B5CF6",
};

export function TerritoryChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={TERRITORY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="city" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}L`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} stackId="a">
          {TERRITORY_DATA.map((entry) => (
            <Cell key={entry.city} fill={CITY_COLORS[entry.city] ?? "#94a3b8"} />
          ))}
        </Bar>
        <Bar dataKey="pipeline" name="In Pipeline" radius={[4, 4, 0, 0]} fill="hsl(var(--muted))" opacity={0.6} stackId="b">
          {TERRITORY_DATA.map((entry) => (
            <Cell key={entry.city} fill={CITY_COLORS[entry.city] ?? "#94a3b8"} opacity={0.35} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
