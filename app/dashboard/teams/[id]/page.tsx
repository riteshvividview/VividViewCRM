"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Plus, UserPlus, BarChart2, Users, DollarSign, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeams } from "@/modules/teams/hooks/use-teams";
import { TargetProgress } from "@/modules/teams/components/target-progress";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["bg-purple-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-pink-500","bg-indigo-500","bg-red-500","bg-cyan-500","bg-teal-500"];
function avatarColor(name: string) { let h=0; for (const c of name) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length; return AVATAR_COLORS[h]; }

function pct(cur: number, val: number) { if (!val) return 0; return Math.min(100, Math.round((cur / val) * 100)); }

interface PageProps { params: { id: string } }

export default function TeamDetailPage({ params }: PageProps) {
  const { id } = params;
  const { teams, loading, updateTarget } = useTeams();
  const [tab, setTab] = useState<"members" | "targets" | "invite">("members");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const team = teams.find((t) => t.id === id);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!team) return <div className="p-6 text-sm text-muted-foreground">Team not found.</div>;

  const totalRevenue = team.members.reduce((s, m) => s + m.revenue_generated, 0);
  const totalCalls   = team.members.reduce((s, m) => s + m.calls_made, 0);
  const totalClosed  = team.members.reduce((s, m) => s + m.deals_closed, 0);
  const avgScore     = Math.round(team.members.reduce((s, m) => s + m.performance_score, 0) / (team.members.length || 1));

  function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setInviteEmail(""); }, 3000);
  }

  const TABS = [
    { key: "members" as const, label: "Members" },
    { key: "targets" as const, label: "Team Targets" },
    { key: "invite"  as const, label: "Invite Member" },
  ];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link href="/dashboard/teams" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />Back to Teams
      </Link>

      {/* Team header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold", team.color)}>
            {team.name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{team.name}</h1>
            <p className="text-sm text-muted-foreground">Manager: {team.manager_name} · {team.territory}</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "Members",   value: team.members.length, Icon: Users },
            { label: "Revenue",   value: `₹${(totalRevenue/1_00_000).toFixed(1)}L`, Icon: DollarSign },
            { label: "Calls",     value: totalCalls, Icon: Phone },
            { label: "Avg Score", value: `${avgScore}/100`, Icon: Star },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-3 text-center">
              <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key ? "border-purple-600 text-purple-600 dark:text-purple-400" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* Members */}
      {tab === "members" && (
        <div className="space-y-3">
          {team.members.map((m) => {
            const p2 = pct(m.revenue_generated, m.targets.find(t => t.type === "revenue")?.value ?? 1);
            return (
              <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(m.name))}>
                    {m.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Link href={`/dashboard/teams/${team.id}/member/${m.id}`}
                          className="text-sm font-semibold text-foreground hover:text-purple-600 transition-colors">
                          {m.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                          m.performance_score >= 90 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          m.performance_score >= 75 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                          {m.performance_score}% score
                        </span>
                        <Link href={`/dashboard/teams/${team.id}/member/${m.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="flex gap-4 mt-2">
                      {[
                        { label: "Calls", val: m.calls_made },
                        { label: "Emails", val: m.emails_sent },
                        { label: "Meetings", val: m.meetings_booked },
                        { label: "Closed", val: m.deals_closed },
                      ].map(({ label, val }) => (
                        <div key={label} className="text-center">
                          <p className="text-sm font-semibold text-foreground">{val}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Revenue progress */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Revenue progress</span>
                        <span className="font-medium">{p2}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${p2}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Targets */}
      {tab === "targets" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Monthly Targets</p>
          <TargetProgress
            targets={team.targets}
            onUpdate={(t) => updateTarget(team.id, t.id, t)}
            editable
          />
        </div>
      )}

      {/* Invite */}
      {tab === "invite" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-md space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Invite by Email</h3>
            <p className="text-xs text-muted-foreground">They will receive a Supabase magic-link invitation to join the workspace.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email address</label>
            <div className="flex gap-2 mt-1">
              <Input
                className="h-9 text-sm flex-1"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
              />
              <Button
                className="h-9 bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shrink-0"
                onClick={sendInvite}
                disabled={!inviteEmail.trim() || inviteSent}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {inviteSent ? "Sent!" : "Invite"}
              </Button>
            </div>
          </div>
          {inviteSent && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 rounded-xl">
              <Mail className="h-4 w-4" />Invitation sent to {inviteEmail}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Note: In production, this calls <code className="bg-muted px-1 rounded text-xs">supabase.auth.admin.inviteUserByEmail()</code>
          </p>
        </div>
      )}
    </div>
  );
}
