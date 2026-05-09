"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutList, Columns, Table2, Plus, Upload, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { ImportModal, usePageDrop } from "@/components/shared/import-modal";
import { LeadsTable } from "@/modules/leads/components/leads-table";
import { LeadsKanban } from "@/modules/leads/components/leads-kanban";
import { LeadsList } from "@/modules/leads/components/leads-list";
import { LeadSidePanel } from "@/modules/leads/components/lead-side-panel";
import { LeadsFilters, DEFAULT_FILTERS, type LeadsFilterState } from "@/modules/leads/components/leads-filters";
import { BulkActions } from "@/modules/leads/components/bulk-actions";
import { useLeads } from "@/modules/leads/hooks/use-leads";
import type { Lead, LeadStatus, ViewMode } from "@/modules/leads/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const IMPORT_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "assigned_name", label: "Assigned To" },
];

const SKELETON_COUNT = 6;

export default function LeadsPage() {
  const { leads, loading, addLead, updateLead, updateLeadStatus, deleteLead, bulkAddLeads } = useLeads();
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LeadsFilterState>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const importFileRef = useRef<((file: File) => void) | null>(null);

  // Page-level file drop → open import modal
  const { isDraggingPage, bind } = usePageDrop((file) => {
    if (file.name.match(/\.(csv|xlsx|xls)$/i)) setImportOpen(true);
  });

  useEffect(() => bind(), [bind]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        (l.email?.toLowerCase().includes(q)) ||
        (l.company?.toLowerCase().includes(q))
      );
    }
    if (filters.statuses.length) result = result.filter((l) => filters.statuses.includes(l.status));
    if (filters.sources.length) result = result.filter((l) => l.source && filters.sources.includes(l.source));
    if (filters.assignedTo.length) result = result.filter((l) => l.assigned_name && filters.assignedTo.includes(l.assigned_name));
    return result;
  }, [leads, search, filters]);

  async function handleImport(rows: Record<string, string>[]) {
    await bulkAddLeads(rows.map((r) => ({
      name: r.name || "Unknown",
      email: r.email || null,
      phone: r.phone || null,
      company: r.company || null,
      company_id: null,
      source: (r.source as Lead["source"]) || null,
      status: (r.status as LeadStatus) || "New",
      assigned_to: null,
      assigned_name: r.assigned_name || null,
      custom_fields: null,
      notes: null,
      workspace_id: null,
      score: 0,
    })));
    toast.success(`${rows.length} leads imported`);
  }

  async function handleExport() {
    const XLSX = await import("xlsx");
    const exportData = (selectedIds.size > 0 ? filteredLeads.filter((l) => selectedIds.has(l.id)) : filteredLeads).map((l) => ({
      Name: l.name, Email: l.email, Phone: l.phone, Company: l.company,
      Source: l.source, Status: l.status, Score: l.score,
      "Assigned To": l.assigned_name, Created: l.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "leads-export.xlsx");
    toast.success("Exported successfully");
  }

  function handleEditLead(lead: Lead) {
    setEditingLead(lead);
    setPanelOpen(true);
  }

  async function handleSaveLead(data: Omit<Lead, "id" | "created_at" | "updated_at">) {
    if (editingLead?.id) {
      await updateLead(editingLead.id, data);
      toast.success("Lead updated");
    } else {
      await addLead(data);
      toast.success("Lead added");
    }
    setEditingLead(undefined);
  }

  async function handleBulkDelete() {
    for (const id of selectedIds) await deleteLead(id);
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} leads deleted`);
  }

  return (
    <div className="relative">
      {/* Page-level drag overlay */}
      {isDraggingPage && (
        <div className="fixed inset-0 z-50 bg-purple-600/10 border-4 border-dashed border-purple-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-purple-700 text-white rounded-2xl px-8 py-6 text-center shadow-2xl">
            <p className="text-lg font-semibold">Drop to import leads</p>
            <p className="text-sm text-purple-200 mt-1">CSV or Excel accepted</p>
          </div>
        </div>
      )}

      <PageHeader
        title="Leads"
        description="Manage and track your pipeline leads"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />Import
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />Export
            </Button>
            <Button size="sm" className="gap-1.5 bg-purple-700 hover:bg-purple-800 text-white" onClick={() => { setEditingLead(undefined); setPanelOpen(true); }}>
              <Plus className="h-3.5 w-3.5" />New Lead
            </Button>
          </div>
        }
      />

      {/* Drop zone banner */}
      <div
        className="mb-4 border-2 border-dashed border-border hover:border-purple-400 rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors group"
        onClick={() => setImportOpen(true)}
      >
        <div className="w-9 h-9 rounded-lg bg-muted group-hover:bg-purple-50 dark:group-hover:bg-purple-950/30 flex items-center justify-center transition-colors">
          <Upload className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Drop your Excel or CSV here to import leads</p>
          <p className="text-xs text-muted-foreground">or click to browse — supports .csv, .xlsx</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <LeadsFilters filters={filters} onChange={setFilters} totalCount={leads.length} filteredCount={filteredLeads.length} />

        <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-1">
          {([["table", Table2], ["kanban", Columns], ["list", LayoutList]] as [ViewMode, React.ElementType][]).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                view === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4">
          <BulkActions
            selectedCount={selectedIds.size}
            onAssign={() => toast.info("Assign coming soon")}
            onChangeStatus={() => toast.info("Bulk status change coming soon")}
            onExport={handleExport}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedIds(new Set())}
          />
        </div>
      )}

      {/* Views */}
      {loading ? (
        <SkeletonLoader view={view} />
      ) : (
        <div className="animate-fade-in">
          {view === "table" && (
            <LeadsTable
              leads={filteredLeads}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onEditLead={handleEditLead}
              onDeleteLead={deleteLead}
              onStatusChange={updateLeadStatus}
            />
          )}
          {view === "kanban" && (
            <LeadsKanban
              leads={filteredLeads}
              onStatusChange={updateLeadStatus}
              onAddLead={() => { setEditingLead(undefined); setPanelOpen(true); }}
            />
          )}
          {view === "list" && (
            <LeadsList
              leads={filteredLeads}
              onEditLead={handleEditLead}
              onDeleteLead={deleteLead}
              onStatusChange={updateLeadStatus}
            />
          )}
        </div>
      )}

      {/* Side Panel */}
      <LeadSidePanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setEditingLead(undefined); }}
        onSave={handleSaveLead}
        initial={editingLead}
      />

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        fields={IMPORT_FIELDS}
        onImport={handleImport}
        entityName="Leads"
      />
    </div>
  );
}

function SkeletonLoader({ view }: { view: ViewMode }) {
  if (view === "table") {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
        <div className="h-10 bg-muted/60 border-b border-border" />
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-border/50 last:border-0">
            <div className="w-4 h-4 bg-muted rounded" />
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-muted rounded w-32" />
              <div className="h-2.5 bg-muted/60 rounded w-24" />
            </div>
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-5 bg-muted rounded-full w-20" />
            <div className="h-5 bg-muted rounded-full w-12" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-3", view === "kanban" ? "grid-cols-3 lg:grid-cols-6" : "grid-cols-1")}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-1"><div className="h-3.5 bg-muted rounded w-24" /><div className="h-2.5 bg-muted/60 rounded w-16" /></div>
          </div>
          <div className="h-2 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
