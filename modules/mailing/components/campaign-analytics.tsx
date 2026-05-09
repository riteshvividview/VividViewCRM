"use client";

import { ArrowLeft, TrendingUp, MousePointerClick, Users, Ban, AlertCircle } from "lucide-react";
import type { Campaign } from "../types";
import { STATUS_CONFIG } from "../types";
import { cn } from "@/lib/utils";

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Mini bar chart rendered with divs
function BarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const hours = ["12a","2a","4a","6a","8a","10a","12p","2p","4p","6p","8p","10p"];
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end gap-1 h-20">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm bg-purple-500/80 transition-all"
              style={{ height: `${(v / max) * 72}px`, minHeight: v > 0 ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        {hours.map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}

// Link heatmap stub
function LinkHeatmap() {
  const links = [
    { url: "https://vividview.com/features", clicks: 48, pct: 61 },
    { url: "https://vividview.com/pricing",  clicks: 21, pct: 27 },
    { url: "https://cal.com/vividview",      clicks: 9,  pct: 11 },
  ];
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Link Clicks</p>
      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.url}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground truncate max-w-[200px]">{l.url.replace("https://","")}</span>
              <span className="text-xs font-medium text-muted-foreground ml-2">{l.clicks} clicks</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${l.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CampaignAnalyticsProps {
  campaign: Campaign;
  onBack: () => void;
}

export function CampaignAnalytics({ campaign, onBack }: CampaignAnalyticsProps) {
  const { stats } = campaign;
  const cfg = STATUS_CONFIG[campaign.status];

  // Fake hourly open distribution
  const hourlyOpens = [0,0,1,0,2,4,12,28,41,35,22,18,14,9,6,4,8,11,7,4,3,2,1,0];

  return (
    <div>
      <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />Back to campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">{campaign.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{campaign.subject}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium", cfg.bg, cfg.color)}>
          <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />{cfg.label}
        </span>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users}            label="Sent"         value={stats.sent.toLocaleString()}      color="bg-slate-500" />
        <StatCard icon={TrendingUp}       label="Open Rate"    value={`${pct(stats.opened,  stats.sent)}%`} sub={`${stats.opened} opens`}   color="bg-purple-600" />
        <StatCard icon={MousePointerClick}label="Click Rate"   value={`${pct(stats.clicked, stats.sent)}%`} sub={`${stats.clicked} clicks`} color="bg-blue-600" />
        <StatCard icon={AlertCircle}      label="Bounce Rate"  value={`${pct(stats.bounced, stats.sent)}%`} sub={`${stats.bounced} bounced`} color="bg-amber-500" />
        <StatCard icon={Ban}              label="Unsubscribes" value={stats.unsubscribed}                color="bg-red-500" />
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Engagement Funnel</p>
        <div className="space-y-2">
          {[
            { label: "Sent",       value: stats.sent,       pctVal: 100,                           color: "bg-slate-400" },
            { label: "Delivered",  value: stats.delivered,  pctVal: pct(stats.delivered, stats.sent), color: "bg-blue-500" },
            { label: "Opened",     value: stats.opened,     pctVal: pct(stats.opened,   stats.sent), color: "bg-purple-500" },
            { label: "Clicked",    value: stats.clicked,    pctVal: pct(stats.clicked,  stats.sent), color: "bg-emerald-500" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{row.label}</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pctVal}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-16 text-right">{row.value.toLocaleString()} <span className="text-muted-foreground font-normal">({row.pctVal}%)</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <BarChart data={hourlyOpens} label="Opens by Hour of Day" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <LinkHeatmap />
        </div>
      </div>
    </div>
  );
}
