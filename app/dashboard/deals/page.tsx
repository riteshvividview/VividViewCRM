"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutList, Columns, Plus, Upload, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { SidePanel } from "@/components/shared/side-panel";
import { ImportModal, usePageDrop } from "@/components/shared/import-modal";
import { DealsKanban } from "@/modules/deals/components/deals-kanban";
import { DealsList } from "@/modules/deals/components/deals-list";
import { useDeals } from "@/modules/deals/hooks/use-deals";
import { Label } from "@/components/ui/label";
import { Input as FormInput } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEAL_STAGES, DEAL_LOCATIONS, STAGE_CONFIG, type Deal, type DealStage, type DealLocation } from "@/modules/deals/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ViewMode = "kanban" | "list";

const IMPORT_FIELDS = [
  { key: "title", label: "Deal Title", required: true },
  { key: "company", label: "Company" },
  { key: "value", label: "Value (₹)" },
  { key: "stage", label: "Stage" },
  { key: "location", label: "Location" },
  { key: "assigned_name", label: "Assigned To" },
  { key: "close_date", label: "Close Date" },
];

export default function DealsPage() {
  const { deals, loading, updateDealStage, addDeal, bulkAddDeals, updateDeal } = useDeals();
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const [newDeal, setNewDeal] = useState<Partial<Deal>>({ stage: "Av. Leads", currency: "INR", location: "Delhi" });

  const { isDraggingPage: isFileDragging, bind } = usePageDrop((file) => {
    if (file.name.match(/\.(csv|xlsx|xls)$/i)) setImportOpen(true);
  });
  useEffect(() => bind(), [bind]);

  const filteredDeals = useMemo(() => {
    if (!search) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q) || (d.company?.toLowerCase().includes(q)));
  }, [deals, search]);

  async function handleSaveDeal() {
    if (!newDeal.title?.trim()) { toast.error("Deal title is required"); return; }
    await addDeal({
      title: newDeal.title ?? "",
      lead_id: null,
      stage: (newDeal.stage ?? "Av. Leads") as DealStage,
      value: Number(newDeal.value ?? 0),
      currency: "INR",
      close_date: newDeal.close_date ?? null,
      assigned_to: null,
      assigned_name: newDeal.assigned_name ?? null,
      assigned_avatar: null,
      location: (newDeal.location ?? "Delhi") as DealLocation,
      notes: null,
      company: newDeal.company ?? null,
      contact_name: null,
      won_lost_reason: null,
      workspace_id: null,
    });
    toast.success("Deal added");
    setPanelOpen(false);
    setNewDeal({ stage: "Av. Leads", currency: "INR", location: "Delhi" });
  }

  async function handleImport(rows: Record<string, string>[]) {
    await bulkAddDeals(rows.map((r) => ({
      title: r.title || "Untitled Deal",
      company: r.company || null,
      value: parseFloat(r.value?.replace(/[^0-9.]/g, "") || "0"),
      stage: (r.stage as DealStage) || "Av. Leads",
      location: (r.location as DealLocation) || null,
      assigned_name: r.assigned_name || null,
      close_date: r.close_date || null,
      currency: "INR",
    })));
    toast.success(`${rows.length} deals imported`);
  }

  function handleWon(id: string) {
    updateDealStage(id, "Sales");
    toast.success("🎉 Deal marked as won!");
  }

  function handleLost(id: string) {
    updateDeal(id, { stage: "Av. Leads" });
    toast.info("Deal marked as lost");
  }

  return (
    <div className="relative">
      {isFileDragging && (
        <div className="fixed inset-0 z-50 bg-purple-600/10 border-4 border-dashed border-purple-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-purple-700 text-white rounded-2xl px-8 py-6 text-center shadow-2xl">
            <p className="text-lg font-semibold">Drop to import deals</p>
            <p className="text-sm text-purple-200 mt-1">CSV or Excel accepted</p>
          </div>
        </div>
      )}

      <PageHeader
        title="Deals"
        description="Manage your sales pipeline"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />Import
            </Button>
            <Button size="sm" className="gap-1.5 bg-purple-700 hover:bg-purple-800 text-white" onClick={() => setPanelOpen(true)}>
              <Plus className="h-3.5 w-3.5" />New Deal
            </Button>
          </div>
        }
      />

      {/* Pipeline summary */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const total = stageDeals.reduce((s, d) => s + d.value, 0);
            const cfg = STAGE_CONFIG[stage];
            return (
              <div key={stage} className="bg-card border border-border rounded-xl px-3 py-3 flex flex-col gap-1">
                <span className={cn("text-xs font-semibold truncate", cfg.color)}>{stage}</span>
                <span className="text-lg font-bold text-foreground">
                  {total >= 100000 ? `₹${(total / 100000).toFixed(1)}L` : `₹${(total / 1000).toFixed(0)}K`}
                </span>
                <span className="text-[11px] text-muted-foreground">{stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search deals…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-1">
          {([["kanban", Columns, "Pipeline"], ["list", LayoutList, "List"]] as [ViewMode, React.ElementType, string][]).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors", view === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[260px] bg-card border border-border rounded-xl p-3 space-y-2 animate-pulse">
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-16 bg-muted rounded-lg" />
              <div className="h-16 bg-muted/60 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-fade-in">
          {view === "kanban" && <DealsKanban deals={filteredDeals} onStageChange={updateDealStage} onAddDeal={() => setPanelOpen(true)} onWon={handleWon} onLost={handleLost} />}
          {view === "list" && <DealsList deals={filteredDeals} onWon={handleWon} onLost={handleLost} />}
        </div>
      )}

      {/* New Deal Panel */}
      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} title="New Deal" subtitle="Add a deal to your pipeline">
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Deal Title <span className="text-red-500">*</span></Label>
            <FormInput placeholder="e.g. Enterprise License – Acme" value={newDeal.title ?? ""} onChange={(e) => setNewDeal((p) => ({ ...p, title: e.target.value }))} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <FormInput placeholder="Acme Corp" value={newDeal.company ?? ""} onChange={(e) => setNewDeal((p) => ({ ...p, company: e.target.value }))} className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Value (₹)</Label>
              <FormInput type="number" placeholder="100000" value={newDeal.value ?? ""} onChange={(e) => setNewDeal((p) => ({ ...p, value: Number(e.target.value) }))} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={newDeal.stage ?? "Av. Leads"} onValueChange={(v) => setNewDeal((p) => ({ ...p, stage: v as DealStage }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={newDeal.location ?? ""} onValueChange={(v) => setNewDeal((p) => ({ ...p, location: v as DealLocation }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{DEAL_LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select value={newDeal.assigned_name ?? ""} onValueChange={(v) => setNewDeal((p) => ({ ...p, assigned_name: v }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alex Kumar">Alex Kumar</SelectItem>
                  <SelectItem value="Priya Singh">Priya Singh</SelectItem>
                  <SelectItem value="Sam Tiwari">Sam Tiwari</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Close Date</Label>
            <FormInput type="date" value={newDeal.close_date ?? ""} onChange={(e) => setNewDeal((p) => ({ ...p, close_date: e.target.value }))} className="h-10" />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-purple-700 hover:bg-purple-800 text-white" onClick={handleSaveDeal}>Add Deal</Button>
          </div>
        </div>
      </SidePanel>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} fields={IMPORT_FIELDS} onImport={handleImport} entityName="Deals" />
    </div>
  );
}
