"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, TrendingUp, DollarSign, Users, BarChart2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketing } from "@/modules/marketing/hooks/use-marketing";
import { CAMPAIGN_TYPE_CONFIG, STATUS_CONFIG } from "@/modules/marketing/types";
import type { MarketingCampaignType } from "@/modules/marketing/types";
import { BudgetDonut } from "@/modules/marketing/components/budget-donut";
import { LeadSourceChart } from "@/modules/marketing/components/lead-source-chart";
import { TerritoryChart } from "@/modules/marketing/components/territory-chart";
import { cn } from "@/lib/utils";

function fmtK(n: number) { if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`; return `₹${(n / 1000).toFixed(0)}K`; }

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function MarketingCampaignsPage() {
  const { campaigns, loading, addAsset, updateCampaign } = useMarketing();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MarketingCampaignType | "all">("all");

  const totalSpent   = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads   = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue_attributed, 0);
  const avgROI       = campaigns.filter((c) => c.roi > 0).reduce((s, c, _, a) => s + c.roi / a.length, 0);

  const filtered = campaigns.filter((c) => {
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === "all" || c.type === typeFilter;
    return ms && mt;
  });

  const typeList = Object.keys(CAMPAIGN_TYPE_CONFIG) as MarketingCampaignType[];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track campaigns, ROI, and lead attribution</p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-9">
          <Plus className="h-4 w-4" />New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={DollarSign} label="Total Spent"        value={fmtK(totalSpent)}       color="bg-purple-600" />
        <SummaryCard icon={Users}      label="Leads Generated"    value={String(totalLeads)}     color="bg-blue-600" />
        <SummaryCard icon={TrendingUp} label="Revenue Attributed" value={fmtK(totalRevenue)}     color="bg-emerald-600" />
        <SummaryCard icon={BarChart2}  label="Avg ROI"            value={`${Math.round(avgROI)}%`} color="bg-pink-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campaign Spend Distribution</p>
          <BudgetDonut campaigns={campaigns} />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top Performing Lead Sources</p>
          <LeadSourceChart />
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top Performing Territories</p>
        <TerritoryChart />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              typeFilter === "all" ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            All Types
          </button>
          {typeList.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                typeFilter === t ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {CAMPAIGN_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Campaign","Type","Status","Budget","Spent","Leads","Revenue","ROI",""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const tc = CAMPAIGN_TYPE_CONFIG[c.type];
                const sc = STATUS_CONFIG[c.status];
                const sp = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-foreground hover:text-purple-600 transition-colors">
                        {c.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.territory ?? "All India"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tc.bg, tc.color)}>
                        <FontAwesomeIcon icon={tc.icon} className="mr-1 h-3 w-3" />{tc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", sc.bg, sc.color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtK(c.budget)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium">{fmtK(c.spent)}</span>
                          <span className="text-[10px] text-muted-foreground">{sp}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden w-20">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${sp}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{c.leads_generated}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmtK(c.revenue_attributed)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-bold",
                        c.roi >= 500 ? "text-emerald-600 dark:text-emerald-400" :
                        c.roi >= 200 ? "text-blue-600 dark:text-blue-400" :
                        "text-amber-600 dark:text-amber-400")}>
                        {c.roi}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/campaigns/${c.id}`} className="text-xs text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
