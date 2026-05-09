"use client";

import { useState } from "react";
import { SidePanel } from "@/components/shared/side-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUSES, LEAD_SOURCES, type Lead, type LeadStatus, type LeadSource } from "../types";
import { calcScore } from "../types";
import { ScorePill } from "@/components/shared/score-pill";
import { Loader2 } from "lucide-react";

interface LeadSidePanelProps {
  open: boolean;
  onClose: () => void;
  onSave: (lead: Omit<Lead, "id" | "created_at" | "updated_at">) => Promise<void>;
  initial?: Partial<Lead>;
}

const EMPTY: Partial<Lead> = {
  name: "", email: "", phone: "", company: "", source: undefined,
  status: "New", score: 0, assigned_to: null, assigned_name: null,
  custom_fields: null, notes: null, workspace_id: null, company_id: null,
};

export function LeadSidePanel({ open, onClose, onSave, initial }: LeadSidePanelProps) {
  const [form, setForm] = useState<Partial<Lead>>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Lead, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const score = calcScore(form);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name ?? "",
        email: form.email ?? null,
        phone: form.phone ?? null,
        company: form.company ?? null,
        company_id: null,
        source: form.source ?? null,
        status: form.status ?? "New",
        score,
        assigned_to: form.assigned_to ?? null,
        assigned_name: form.assigned_name ?? null,
        custom_fields: null,
        notes: form.notes ?? null,
        workspace_id: null,
      });
      setForm(EMPTY);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel open={open} onClose={onClose} title={initial?.id ? "Edit Lead" : "New Lead"} subtitle="Fill in the details below">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Score badge */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border">
          <span className="text-sm text-muted-foreground">Lead Score</span>
          <ScorePill score={score} showBar className="ml-auto" />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact Info</legend>
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input placeholder="Jane Smith" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@company.com" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+91 98765 43210" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input placeholder="Acme Corp" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className="h-10" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lead Details</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source ?? ""} onValueChange={(v) => set("source", v as LeadSource)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <Select value={form.assigned_name ?? ""} onValueChange={(v) => { set("assigned_name", v); set("assigned_to", v.toLowerCase().replace(" ", "_")); }}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Alex Kumar">Alex Kumar</SelectItem>
                <SelectItem value="Priya Singh">Priya Singh</SelectItem>
                <SelectItem value="Sam Tiwari">Sam Tiwari</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</legend>
          <textarea
            placeholder="Any additional context…"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </fieldset>

        <div className="flex gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1 bg-purple-700 hover:bg-purple-800 text-white" disabled={saving}>
            {saving && <Loader2 className="animate-spin h-4 w-4" />}
            {initial?.id ? "Save Changes" : "Add Lead"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
