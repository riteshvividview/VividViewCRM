"use client";



import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar, Handshake, TrendingUp } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrophy, faLocationDot } from "@fortawesome/free-solid-svg-icons";
import { useTeams } from "@/modules/teams/hooks/use-teams";
import { TargetProgress } from "@/modules/teams/components/target-progress";
import { Leaderboard } from "@/modules/teams/components/leaderboard";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["bg-purple-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-pink-500","bg-indigo-500","bg-red-500"];
function avatarColor(name: string) { let h=0; for (const c of name) h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length; return AVATAR_COLORS[h]; }

interface PageProps { params: { id: string; memberId: string } }

export default function MemberPage({ params }: PageProps) {
  const { id, memberId } = params;
  const { teams, loading, allMembers, updateMemberTarget } = useTeams();
  const team = teams.find((t) => t.id === id);
  const member = team?.members.find((m) => m.id === memberId);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!member || !team) return <div className="p-6 text-sm text-muted-foreground">Member not found.</div>;

  const sortedAll = [...allMembers].sort((a, b) => b.revenue_generated - a.revenue_generated);
  const rank = sortedAll.findIndex((m) => m.id === memberId) + 1;

  const activityItems = [
    { icon: Phone,     label: "Calls Made",       value: member.calls_made,      color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { icon: Mail,      label: "Emails Sent",      value: member.emails_sent,     color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
    { icon: Calendar,  label: "Meetings Booked",  value: member.meetings_booked, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
    { icon: Handshake, label: "Deals Closed",     value: member.deals_closed,    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link href={`/dashboard/teams/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to {team.name}
      </Link>

      {/* Profile header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0", avatarColor(member.name))}>
            {member.avatar_initials}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{member.name}</h1>
            <p className="text-sm text-muted-foreground">{member.email} · {team.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize text-muted-foreground">
                {member.role.replace("_", " ")}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                member.performance_score >= 90 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                member.performance_score >= 75 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                Score: {member.performance_score}/100
              </span>
              <span className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                <FontAwesomeIcon icon={faTrophy} className="mr-1 h-3 w-3" />Rank #{rank}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{(member.revenue_generated / 1_00_000).toFixed(1)}L
            </p>
            <p className="text-xs text-muted-foreground">Revenue generated</p>
            <div className="flex items-center gap-1 mt-1 justify-end text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">+{member.performance_score > 80 ? 12 : 6}% vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {activityItems.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal targets */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Individual Targets</p>
          <TargetProgress
            targets={member.targets}
            onUpdate={(t) => updateMemberTarget(member.id, t.id, t)}
            editable
          />
        </div>

        {/* Territories */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Assigned Territories</p>
          <div className="space-y-2">
            {member.territories.map((ter) => (
              <div key={ter} className="flex items-center gap-2.5 p-3 bg-muted/40 rounded-xl">
                <FontAwesomeIcon icon={faLocationDot} className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{ter}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard context */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Team Leaderboard</p>
        <Leaderboard members={team.members} limit={5} />
      </div>
    </div>
  );
}
