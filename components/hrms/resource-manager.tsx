"use client";

/**
 * Generic list + create/edit UI for the HRMS records API (/api/hrms/records/[resource]).
 * A feature page only supplies a config: fields, columns, status tabs and row actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useHrOptions, type Option } from "./use-hr-options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export interface Me { employeeId: string | null; isHR: boolean }

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "employee" | "job" | "cycle" | "department" | "checkbox";
  options?: Option[];
  required?: boolean;
  hrOnly?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (row: Row) => React.ReactNode;
  className?: string;
}

export interface ActionDef {
  label: string;
  patch: Row | ((row: Row) => Row | null);
  show: (row: Row, me: Me) => boolean;
  variant?: "default" | "outline" | "destructive";
  confirm?: string;
}

export interface ResourceManagerProps {
  resource: string;
  title: string;
  subtitle?: string;
  singular: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  tabs?: { field: string; options: Option[] };
  actions?: ActionDef[];
  canCreate?: (me: Me) => boolean;
  canEdit?: (row: Row, me: Me) => boolean;
  canDelete?: (row: Row, me: Me) => boolean;
  /** Fixed query params, e.g. { kind: "onboarding" }. Also used as create defaults. */
  scope?: Record<string, string>;
  headerExtra?: React.ReactNode;
  /** Render the rows yourself (cards, kanban…) instead of the default table. */
  renderBody?: (rows: Row[], helpers: { me: Me; edit: (row: Row) => void; patch: (row: Row, data: Row) => Promise<void> }) => React.ReactNode;
}

// ── Formatting helpers shared by feature pages ─────────────────────────────────
export const fmtINR = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" :
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v));
export const fmtDate = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const empName = (row: Row, key = "employee") => row[key]?.profiles?.full_name ?? row[key]?.employee_code ?? "—";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700", requested: "bg-amber-100 text-amber-700", open: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700", active: "bg-green-100 text-green-700", paid: "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700", resolved: "bg-green-100 text-green-700", submitted: "bg-green-100 text-green-700",
  hired: "bg-green-100 text-green-700", on_track: "bg-green-100 text-green-700", available: "bg-green-100 text-green-700",
  assigned: "bg-blue-100 text-blue-700", in_progress: "bg-blue-100 text-blue-700", interview: "bg-blue-100 text-blue-700",
  screening: "bg-indigo-100 text-indigo-700", offer: "bg-violet-100 text-violet-700", applied: "bg-slate-100 text-slate-700",
  rejected: "bg-red-100 text-red-700", behind: "bg-red-100 text-red-700", urgent: "bg-red-100 text-red-700",
  at_risk: "bg-orange-100 text-orange-700", high: "bg-orange-100 text-orange-700", repair: "bg-orange-100 text-orange-700",
  closed: "bg-slate-100 text-slate-600", retired: "bg-slate-100 text-slate-600", withdrawn: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600", on_hold: "bg-slate-100 text-slate-600", settled: "bg-emerald-100 text-emerald-700",
};

export function StatusPill({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap", STATUS_COLORS[value] ?? "bg-slate-100 text-slate-700")}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function ResourceManager(props: ResourceManagerProps) {
  const { resource, title, subtitle, singular, fields, columns, tabs, actions = [], scope, headerExtra, renderBody } = props;
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<Me>({ employeeId: null, isHR: false });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);

  const needs = useMemo(() => new Set(fields.map((f) => f.type)), [fields]);
  const opts = useHrOptions({
    employees: needs.has("employee"), jobs: needs.has("job"), cycles: needs.has("cycle"), departments: needs.has("department"),
  });

  const scopeKey = JSON.stringify(scope ?? {});
  const load = useCallback(async () => {
    const qs = new URLSearchParams(JSON.parse(scopeKey)).toString();
    const res = await fetch(`/api/hrms/records/${resource}${qs ? `?${qs}` : ""}`);
    const json = await res.json();
    if (!res.ok) toast.error(json.error ?? "Failed to load");
    setRows(json.records ?? []);
    if (json.me) setMe(json.me);
    setLoading(false);
  }, [resource, scopeKey]);

  useEffect(() => { load(); }, [load]);

  const visibleFields = fields.filter((f) => !f.hrOnly || me.isHR);
  const canCreate = props.canCreate ? props.canCreate(me) : true;

  function openForm(row: Row | null) {
    const initial: Row = {};
    for (const f of fields) {
      initial[f.name] = row ? row[f.name] ?? "" : f.defaultValue ?? (f.type === "checkbox" ? false : "");
    }
    if (!row && scope) Object.assign(initial, scope);
    setForm(initial);
    setEditing(row ?? {});
  }

  async function save() {
    setSaving(true);
    try {
      const isNew = !editing?.id;
      const payload: Row = {};
      for (const f of visibleFields) payload[f.name] = form[f.name];
      if (isNew && scope) Object.assign(payload, scope);
      const res = await fetch(`/api/hrms/records/${resource}${isNew ? "" : `/${editing!.id}`}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(`${singular} ${isNew ? "created" : "updated"}`);
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const patch = useCallback(async (row: Row, data: Row) => {
    const res = await fetch(`/api/hrms/records/${resource}/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? json.record : r)));
  }, [resource]);

  async function runAction(a: ActionDef, row: Row) {
    if (a.confirm && !window.confirm(a.confirm)) return;
    const data = typeof a.patch === "function" ? a.patch(row) : a.patch;
    if (!data) return;
    await patch(row, data);
    toast.success(`${singular} updated`);
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}?`)) return;
    const res = await fetch(`/api/hrms/records/${resource}/${row.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Delete failed"); return; }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast.success(`${singular} deleted`);
  }

  const filtered = rows.filter((r) => {
    if (tabs && tab !== "all" && String(r[tabs.field]) !== tab) return false;
    if (search) return JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const canEdit = (row: Row) => (props.canEdit ? props.canEdit(row, me) : me.isHR);
  const canDelete = (row: Row) => (props.canDelete ? props.canDelete(row, me) : me.isHR);

  function optionsFor(f: FieldDef): Option[] {
    switch (f.type) {
      case "employee": return opts.employees;
      case "job": return opts.jobs;
      case "cycle": return opts.cycles;
      case "department": return opts.departments;
      default: return f.options ?? [];
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={canCreate && (
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-1.5" />New {singular}
          </Button>
        )}
      />
      {headerExtra}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        {tabs ? (
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: "all", label: "All" }, ...tabs.options].map((o) => {
              const count = o.value === "all" ? rows.length : rows.filter((r) => String(r[tabs.field]) === o.value).length;
              return (
                <button
                  key={o.value}
                  onClick={() => setTab(o.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    tab === o.value ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {o.label} <span className="opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        ) : <div />}
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : renderBody ? (
        renderBody(filtered, { me, edit: openForm, patch })
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columns.map((c) => (
                    <th key={c.key} className={cn("text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide", c.className)}>{c.label}</th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">No {title.toLowerCase()} yet.</td></tr>
                ) : filtered.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-2.5", c.className)}>
                        {c.render ? c.render(row) : (row[c.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {actions.filter((a) => a.show(row, me)).map((a) => (
                          <Button key={a.label} size="sm" variant={a.variant ?? "outline"} className="h-7 text-xs" onClick={() => runAction(a, row)}>
                            {a.label}
                          </Button>
                        ))}
                        {canEdit(row) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openForm(row)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete(row) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => remove(row)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${singular}` : `New ${singular}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {visibleFields.map((f) => (
              <div key={f.name} className={cn("grid gap-1.5", f.type === "checkbox" && "flex items-center gap-2")}>
                <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={f.name} rows={3} value={form[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                ) : f.type === "checkbox" ? (
                  <input id={f.name} type="checkbox" className="h-4 w-4" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                ) : ["select", "employee", "job", "cycle", "department"].includes(f.type) ? (
                  <select id={f.name} className={selectClass} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                    <option value="">— Select —</option>
                    {optionsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input
                    id={f.name}
                    type={f.type === "datetime" ? "datetime-local" : f.type}
                    value={f.type === "datetime" && form[f.name] ? String(form[f.name]).slice(0, 16) : form[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
