"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Globe, MapPin, Users, Building2, GitBranch,
  Pencil, Check, X, Camera, ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanies, MOCK_COMPANIES } from "@/modules/companies/hooks/use-companies";
import { useContacts, MOCK_CONTACTS } from "@/modules/contacts/hooks/use-contacts";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { FileGrid } from "@/components/shared/file-grid";
import { getInitials, formatDate, cn } from "@/lib/utils";
import type { Company, CompanyIndustry, CompanySize } from "@/modules/companies/types";
import type { Contact } from "@/modules/contacts/types";
import type { UploadedFile } from "@/components/shared/file-drop-zone";
import { COMPANY_INDUSTRIES, COMPANY_SIZES } from "@/modules/companies/types";

function formatRevenue(r: number | null) {
  if (!r) return "";
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1)}L`;
  return `₹${r.toLocaleString()}`;
}

function EditableField({ label, value, onSave, type = "text" }: {
  label: string; value: string; onSave: (v: string) => void; type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  function commit() { onSave(draft); setEditing(false); }
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div className="group flex items-center justify-between gap-2 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <Input className="h-7 text-sm flex-1" type={type} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commit}><Check className="h-3.5 w-3.5 text-emerald-500" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm text-foreground flex-1 truncate">{value || <span className="text-muted-foreground/40">—</span>}</span>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
            onClick={() => { setDraft(value); setEditing(true); }}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

function CompanyLogo({ company }: { company: Company }) {
  const parts = company.name.split(/\s+/);
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : company.name.slice(0, 2);
  return (
    <div className="relative group">
      {company.logo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={company.logo_url} alt={company.name} className="w-20 h-20 rounded-2xl object-cover" />
        : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white uppercase">{initials}</span>
          </div>
        )
      }
      <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
        <Camera className="h-5 w-5 text-white" />
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { companies, updateCompany } = useCompanies();
  const [company, setCompany] = useState<Company | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Company[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    const c = companies.find((c) => c.id === id);
    if (c) { setCompany(c); setNameDraft(c.name); }
  }, [companies, id]);

  useEffect(() => {
    // Use mock contacts filtered by company_id
    setLinkedContacts(MOCK_CONTACTS.filter((c) => c.company_id === id));
    setSubsidiaries(MOCK_COMPANIES.filter((c) => c.parent_company_id === id));
  }, [id]);

  function update(updates: Partial<Company>) {
    if (!company) return;
    setCompany((c) => c ? { ...c, ...updates } : c);
    updateCompany(company.id, updates);
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        onClick={() => router.push("/dashboard/companies")}
      >
        <ArrowLeft className="h-4 w-4" />Back to Companies
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left card */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex flex-col items-center text-center gap-2 pb-4 border-b border-border">
              <CompanyLogo company={company} />
              {editingName ? (
                <div className="flex items-center gap-1 w-full">
                  <Input className="h-8 text-sm text-center font-semibold" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { update({ name: nameDraft }); setEditingName(false); } if (e.key === "Escape") setEditingName(false); }} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { update({ name: nameDraft }); setEditingName(false); }}>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </Button>
                </div>
              ) : (
                <button className="group/name flex items-center gap-1" onClick={() => { setNameDraft(company.name); setEditingName(true); }}>
                  <h1 className="text-lg font-bold text-foreground">{company.name}</h1>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                </button>
              )}
              {company.industry && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {company.industry}
                </span>
              )}
            </div>

            <div className="space-y-1 pt-4 text-xs text-muted-foreground">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  {company.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-2.5 w-2.5 ml-auto" />
                </a>
              )}
              {company.hq_location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />{company.hq_location}
                </div>
              )}
              {company.employee_count && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />{company.employee_count} employees
                </div>
              )}
              {company.revenue && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Revenue: {formatRevenue(company.revenue)}</span>
                </div>
              )}
            </div>

            {company.parent_company_name && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                <GitBranch className="h-3.5 w-3.5" />
                Subsidiary of{" "}
                <button className="font-medium underline underline-offset-2" onClick={() => router.push(`/dashboard/companies/${company.parent_company_id}`)}>
                  {company.parent_company_name}
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Created</span><span>{formatDate(company.created_at)}</span></div>
              <div className="flex justify-between"><span>Contacts</span><span className="text-foreground font-medium">{linkedContacts.length}</span></div>
              {subsidiaries.length > 0 && <div className="flex justify-between"><span>Subsidiaries</span><span className="text-foreground font-medium">{subsidiaries.length}</span></div>}
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div>
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts ({linkedContacts.length})</TabsTrigger>
              {subsidiaries.length > 0 && <TabsTrigger value="subsidiaries">Subsidiaries</TabsTrigger>}
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Company Details</h3>
                  <div className="space-y-0">
                    <EditableField label="Name" value={company.name} onSave={(v) => update({ name: v })} />
                    <EditableField label="Website" value={company.website ?? ""} onSave={(v) => update({ website: v })} type="url" />
                    <EditableField label="HQ Location" value={company.hq_location ?? ""} onSave={(v) => update({ hq_location: v })} />
                    <EditableField label="Revenue" value={company.revenue ? String(company.revenue) : ""} onSave={(v) => update({ revenue: v ? Number(v) : null })} type="number" />
                    <EditableField label="Description" value={company.description ?? ""} onSave={(v) => update({ description: v })} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Classification</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Industry</label>
                      <Select value={company.industry ?? ""} onValueChange={(v) => update({ industry: v as CompanyIndustry })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{COMPANY_INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Company Size</label>
                      <Select value={company.employee_count ?? ""} onValueChange={(v) => update({ employee_count: v as CompanySize })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Contacts */}
            <TabsContent value="contacts">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {linkedContacts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No contacts linked</div>
                ) : (
                  <div className="divide-y divide-border">
                    {linkedContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/contacts/${c.id}`)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            {getInitials(c.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">{c.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Subsidiaries */}
            {subsidiaries.length > 0 && (
              <TabsContent value="subsidiaries">
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="divide-y divide-border">
                    {subsidiaries.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/companies/${sub.id}`)}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white uppercase">{sub.name.slice(0, 2)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{sub.name}</p>
                          {sub.industry && <p className="text-xs text-muted-foreground">{sub.industry}</p>}
                        </div>
                        {sub.hq_location && <span className="text-xs text-muted-foreground">{sub.hq_location}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Files */}
            <TabsContent value="files">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
                <FileDropZone
                  entityType="company"
                  entityId={id}
                  onUpload={(f) => setFiles((prev) => [f, ...prev])}
                  compact
                />
                <FileGrid files={files} onDelete={(fid) => setFiles((prev) => prev.filter((f) => f.id !== fid))} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
