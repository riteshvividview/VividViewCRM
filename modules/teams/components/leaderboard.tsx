"use client";

import type { TeamMember } from "../types";
import { cn } from "@/lib/utils";

function formatRevenue(n: number) {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}


interface LeaderboardProps {
  members: TeamMember[];
  limit?: number;
}

export function Leaderboard({ members, limit = 9 }: LeaderboardProps) {
  const sorted = [...members]
    .sort((a, b) => b.revenue_generated - a.revenue_generated)
    .slice(0, limit);

  const AVATAR_COLORS = ["bg-purple-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-pink-500","bg-indigo-500","bg-red-500","bg-cyan-500","bg-teal-500"];
  function avatarColor(name: string) {
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[h];
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-10">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Employee Name</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Onboardings</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Revenue</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Territory</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((m, i) => {
            const isGold = i === 0;
            return (
              <tr key={m.id} className={cn("transition-colors", isGold ? "bg-amber-50/60 dark:bg-amber-950/10" : "hover:bg-muted/20")}>
                <td className="px-4 py-3 text-center">
                  {i === 0
                    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-bold">1</span>
                    : i === 1
                    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold">2</span>
                    : i === 2
                    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 text-xs font-bold">3</span>
                    : <span className="text-sm text-muted-foreground font-medium">{i + 1}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(m.name))}>
                      {m.avatar_initials}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", isGold ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>{m.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-semibold text-foreground">{m.deals_closed}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("text-sm font-semibold", isGold ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {formatRevenue(m.revenue_generated)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.territories.slice(0,2).map((t) => (
                      <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="h-1.5 w-14 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", m.performance_score >= 90 ? "bg-emerald-500" : m.performance_score >= 75 ? "bg-blue-500" : "bg-amber-500")}
                        style={{ width: `${m.performance_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">{m.performance_score}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
