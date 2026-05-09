"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, DollarSign, Users, BarChart2, Calculator } from "lucide-react";
import { useMarketing } from "@/modules/marketing/hooks/use-marketing";
import { CAMPAIGN_TYPE_CONFIG, STATUS_CONFIG } from "@/modules/marketing/types";
import type { CampaignAsset } from "@/modules/marketing/types";
import { BudgetDonut } from "@/modules/marketing/components/budget-donut";
import { LeadSourceChart } from "@/modules/marketing/components/lead-source-chart";
import { UtmBuilder } from "@/modules/marketing/components/utm-builder";
import { AssetLibrary } from "@/modules/marketing/components/asset-library";
import { BudgetSliders } from "@/modules/marketing/components/budget-sliders";
import { cn } from "@/lib/utils";

function fmtK(n: number) { if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`; return `₹${(n / 1000).toFixed(0)}K`; }

interface PageProps { params: { id: string } }

export default function CampaignDetailPage({ params }: PageProps) {
  const { id } = params;
  const { campaigns, loading, updateCampaign, addAsset } = useMarketing();
  const [tab, setTab] = useState<"overview" | "utm" | "assets" | "budget">("overview");

  const campaign = campaigns.find((c) => c.id === id);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!campaign) return <div className="p-6 text-sm text-muted-foreground">Campaign not found.</div>;

  const tc = CAMPAIGN_TYPE_CONFIG[campaign.type];
  const sc = STATUS_CONFIG[campaign.status];
  const spentPct = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0;
  const costPerLead = campaign.leads_generated > 0 ? Math.round(campaign.spent / campaign.leads_generated) : 0;

  const TABS = [
    { key: "overview" as const, label: "Overview" },
    { key: "utm"      as const, label: "UTM Builder" },
    { key: "assets"   as const, label: `Assets (${campaign.assets.length})` },
    { key: "budget"   as const, label: "Budget Allocation" },
  ];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/dashboard/campaigns" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to Campaigns
      </Link>

      {/* Campaign header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tc.bg, tc.color)}>
                {tc.icon} {tc.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", sc.bg, sc.color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />{sc.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {campaign.territory ?? "All India"} · Started {new Date(campaign.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { icon: DollarSign, label: "Budget",          value: fmtK(campaign.budget),         color: "bg-slate-500" },
            { icon: TrendingUp, label: "Spent",           value: `${fmtK(campaign.spent)} (${spentPct}%)`, color: "bg-purple-600" },
            { icon: Users,      label: "Leads Generated", value: String(campaign.leads_generated), color: "bg-blue-600" },
            { icon: BarChart2,  label: "ROI",             value: `${campaign.roi}%`,             color: campaign.roi >= 200 ? "bg-emerald-600" : "bg-amber-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-3 flex items-center gap-2.5">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", color)}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tab === key ? "border-purple-600 text-purple-600 dark:text-purple-400" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ROI Calculator */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ROI Summary</p>
            </div>
            {[
              { label: "Total Spend",        value: fmtK(campaign.spent) },
              { label: "Revenue Attributed", value: fmtK(campaign.revenue_attributed), highlight: true },
              { label: "Pipeline Value",     value: fmtK(campaign.pipeline_value) },
              { label: "Leads Generated",    value: String(campaign.leads_generated) },
              { label: "Cost Per Lead",      value: `₹${costPerLead.toLocaleString()}` },
              { label: "Return on Ad Spend", value: `${campaign.roi}%`, highlight: campaign.roi >= 200 },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={cn("text-sm font-semibold", highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Budget donut (this campaign only) */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Budget vs Spent</p>
            <BudgetDonut campaigns={[campaign]} />
            <div className="mt-3 space-y-2">
              {[
                { label: "Budget",    value: fmtK(campaign.budget),          color: "bg-slate-300 dark:bg-slate-600" },
                { label: "Spent",     value: fmtK(campaign.spent),           color: "bg-purple-500" },
                { label: "Remaining", value: fmtK(campaign.budget - campaign.spent), color: "bg-emerald-200 dark:bg-emerald-900" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lead source trend */}
          <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lead Source Attribution — Revenue vs In Pipeline</p>
            <LeadSourceChart />
          </div>
        </div>
      )}

      {tab === "utm" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl">
          <p className="text-sm text-muted-foreground mb-4">Build and copy UTM tracking links for this campaign.</p>
          <UtmBuilder
            initial={campaign.utm_params}
            onSave={(params) => updateCampaign(campaign.id, { utm_params: params })}
          />
        </div>
      )}

      {tab === "assets" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl">
          <p className="text-sm text-muted-foreground mb-4">Upload and manage creatives for this campaign.</p>
          <AssetLibrary
            assets={campaign.assets}
            onAdd={(asset: CampaignAsset) => addAsset(campaign.id, asset)}
            onDelete={(assetId: string) => updateCampaign(campaign.id, {
              assets: campaign.assets.filter((a) => a.id !== assetId),
            })}
          />
        </div>
      )}

      {tab === "budget" && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-xl">
          <p className="text-sm text-muted-foreground mb-4">Adjust budget allocation across all campaigns.</p>
          <BudgetSliders campaigns={campaigns} />
        </div>
      )}
    </div>
  );
}
