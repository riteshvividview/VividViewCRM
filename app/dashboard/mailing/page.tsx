"use client";

import { useState } from "react";
import { Plus, Search, Mail, TrendingUp, Users, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCampaigns } from "@/modules/mailing/hooks/use-campaigns";
import { CampaignList } from "@/modules/mailing/components/campaign-list";
import { CampaignWizard } from "@/modules/mailing/components/campaign-wizard";
import { CampaignAnalytics } from "@/modules/mailing/components/campaign-analytics";
import type { Campaign } from "@/modules/mailing/types";
import { cn } from "@/lib/utils";

type View = "list" | "wizard" | "analytics";

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
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

export default function MailingPage() {
  const { campaigns, loading, addCampaign, updateCampaign, deleteCampaign } = useCampaigns();
  const [view, setView] = useState<View>("list");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<Campaign | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const totalSent = campaigns.reduce((s, c) => s + c.stats.sent, 0);
  const avgOpen = campaigns.filter((c) => c.stats.sent > 0).reduce((s, c, _, a) => s + c.stats.opened / c.stats.sent / a.length, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "sending" || c.status === "scheduled").length;

  const filtered = campaigns.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleNewCampaign() {
    setEditingCampaign(null);
    setView("wizard");
  }

  function handleEdit(c: Campaign) {
    setEditingCampaign(c);
    setView("wizard");
  }

  function handleAnalytics(c: Campaign) {
    setAnalyticsCampaign(c);
    setView("analytics");
  }

  function handleSave(partial: Partial<Campaign>) {
    if (editingCampaign) {
      updateCampaign(editingCampaign.id, partial);
    } else {
      addCampaign(partial);
    }
    setView("list");
    setEditingCampaign(null);
  }

  function handleTogglePause(c: Campaign) {
    const newStatus = c.status === "paused" ? "scheduled" : "paused";
    updateCampaign(c.id, { status: newStatus });
  }

  function handleDuplicate(c: Campaign) {
    addCampaign({ ...c, id: undefined as unknown as string, name: `${c.name} (Copy)`, status: "draft", stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }, created_at: new Date().toISOString() });
  }

  if (view === "wizard") {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <CampaignWizard
          initialData={editingCampaign ?? undefined}
          onSave={handleSave}
          onClose={() => { setView("list"); setEditingCampaign(null); }}
        />
      </div>
    );
  }

  if (view === "analytics" && analyticsCampaign) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <CampaignAnalytics
          campaign={analyticsCampaign}
          onBack={() => { setView("list"); setAnalyticsCampaign(null); }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk Mailing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage campaigns, sequences, and analytics</p>
        </div>
        <Button onClick={handleNewCampaign} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
          <Plus className="h-4 w-4" />New Campaign
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={Mail}      label="Total Campaigns"  value={campaigns.length}                          color="bg-slate-500" />
        <SummaryCard icon={Send}      label="Emails Sent"      value={totalSent.toLocaleString()}                color="bg-purple-600" />
        <SummaryCard icon={TrendingUp}label="Avg Open Rate"    value={`${(avgOpen * 100).toFixed(1)}%`}          color="bg-blue-600" />
        <SummaryCard icon={Users}     label="Active Campaigns" value={activeCampaigns}                           color="bg-emerald-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "draft", "scheduled", "sending", "sent", "paused"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading campaigns…</div>
      ) : (
        <CampaignList
          campaigns={filtered}
          onEdit={handleEdit}
          onAnalytics={handleAnalytics}
          onDelete={deleteCampaign}
          onDuplicate={handleDuplicate}
          onTogglePause={handleTogglePause}
        />
      )}
    </div>
  );
}
