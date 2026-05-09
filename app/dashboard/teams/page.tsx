"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Plus, Building2, Target, Users, Phone, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeams } from "@/modules/teams/hooks/use-teams";
import { Leaderboard } from "@/modules/teams/components/leaderboard";
import { TerritoryManager } from "@/modules/teams/components/territory-manager";
import { TargetImport } from "@/modules/teams/components/target-import";
import { cn } from "@/lib/utils";

type Tab = "teams" | "leaderboard" | "territories" | "import";

function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, pct) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s ease" }} />
    </svg>
  );
}

function pct(cur: number, val: number) { if (!val) return 0; return Math.min(100, Math.round((cur / val) * 100)); }
function fmtRev(n: number) { if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`; return `₹${(n / 1000).toFixed(0)}K`; }

export default function TeamsPage() {
  const { teams, loading, allMembers } = useTeams();
  const [tab, setTab] = useState<Tab>("teams");
  const [viewMode, setViewMode] = useState<"org" | "team">("team");

  const RING_COLORS: Record<string, string> = { tm1: "#7C3AED", tm2: "#2563EB", tm3: "#10B981" };
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "teams",       label: "Teams",          icon: Building2 },
    { key: "leaderboard", label: "Leaderboard",    icon: TrendingUp },
    { key: "territories", label: "Territories",    icon: Target },
    { key: "import",      label: "Import Targets", icon: Plus },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams & Targets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage team performance and sales targets</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            {(["org","team"] as const).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                  viewMode === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
                {v === "org" ? "Org View" : "Team View"}
              </button>
            ))}
          </div>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-9">
            <Plus className="h-4 w-4" />New Team
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key ? "border-purple-600 text-purple-600 dark:text-purple-400" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "teams" && (
        loading ? <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading…</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => {
              const revT = team.targets.find((t) => t.type === "revenue");
              const revPct = revT ? pct(revT.current, revT.value) : 0;
              return (
                <div key={team.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0", team.color)}>
                        {team.name[0]}
                      </div>
                      <div>
                        <Link href={`/dashboard/teams/${team.id}`} className="text-sm font-semibold text-foreground hover:text-purple-600 transition-colors">
                          {team.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{team.territory}</p>
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <ProgressRing pct={revPct} color={RING_COLORS[team.id] ?? "#7C3AED"} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-foreground">{revPct}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { Icon: Users,     label: "Members", val: team.members.length },
                      { Icon: Phone,     label: "Calls",   val: team.members.reduce((s, m) => s + m.calls_made, 0) },
                      { Icon: Handshake, label: "Closed",  val: team.members.reduce((s, m) => s + m.deals_closed, 0) },
                    ].map(({ Icon, label, val }) => (
                      <div key={label} className="text-center bg-muted/40 rounded-xl p-2">
                        <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-semibold text-foreground">{val}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    {team.targets.map((t) => {
                      const p2 = pct(t.current, t.value);
                      const bar = t.type === "revenue" ? "bg-emerald-500" : t.type === "calls" ? "bg-blue-500" : "bg-purple-500";
                      return (
                        <div key={t.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{t.label}</span>
                            <span className={cn("font-medium", p2 >= 80 ? "text-emerald-600" : "text-amber-600")}>{p2}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${p2}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Manager: {team.manager_name}</span>
                    <Link href={`/dashboard/teams/${team.id}`} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                      View details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "leaderboard" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Top performers across all teams this month</p>
          <Leaderboard members={allMembers} />
        </div>
      )}

      {tab === "territories" && (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted-foreground">Assign territories to teams for geographic coverage tracking.</p>
          <TerritoryManager />
        </div>
      )}

      {tab === "import" && (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted-foreground">Bulk-import targets for multiple reps from an Excel or CSV file.</p>
          <TargetImport onImport={(rows) => console.log("Imported:", rows)} />
        </div>
      )}
    </div>
  );
}
