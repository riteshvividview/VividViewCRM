"use client";

import { useState } from "react";
import { GripVertical, Plus, X, BarChart2, Table, PieChart, TrendingUp, LayoutGrid, Hash, ClipboardList, Handshake, Users, Phone, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartType, DataSource, BuilderField, BuilderState } from "../types";
import { cn } from "@/lib/utils";

const SOURCES: { value: DataSource; label: string; icon: LucideIcon }[] = [
  { value: "leads",      label: "Leads",      icon: ClipboardList },
  { value: "deals",      label: "Deals",      icon: Handshake },
  { value: "contacts",   label: "Contacts",   icon: Users },
  { value: "activities", label: "Activities", icon: Phone },
  { value: "campaigns",  label: "Campaigns",  icon: Megaphone },
];

const SOURCE_FIELDS: Record<DataSource, BuilderField[]> = {
  leads:      [
    { key: "source",      label: "Lead Source",   type: "dimension" },
    { key: "status",      label: "Status",        type: "dimension" },
    { key: "assigned_to", label: "Assigned To",   type: "dimension" },
    { key: "created_at",  label: "Created Date",  type: "dimension" },
    { key: "count",       label: "Count",         type: "measure"   },
    { key: "converted",   label: "Converted",     type: "measure"   },
  ],
  deals:      [
    { key: "stage",       label: "Stage",         type: "dimension" },
    { key: "rep",         label: "Sales Rep",     type: "dimension" },
    { key: "territory",   label: "Territory",     type: "dimension" },
    { key: "month",       label: "Month",         type: "dimension" },
    { key: "value",       label: "Deal Value",    type: "measure"   },
    { key: "count",       label: "Deal Count",    type: "measure"   },
  ],
  contacts:   [
    { key: "company",     label: "Company",       type: "dimension" },
    { key: "industry",    label: "Industry",      type: "dimension" },
    { key: "city",        label: "City",          type: "dimension" },
    { key: "count",       label: "Count",         type: "measure"   },
  ],
  activities: [
    { key: "type",        label: "Activity Type", type: "dimension" },
    { key: "rep",         label: "Rep",           type: "dimension" },
    { key: "day",         label: "Day",           type: "dimension" },
    { key: "count",       label: "Count",         type: "measure"   },
  ],
  campaigns:  [
    { key: "name",        label: "Campaign",      type: "dimension" },
    { key: "type",        label: "Type",          type: "dimension" },
    { key: "budget",      label: "Budget",        type: "measure"   },
    { key: "leads",       label: "Leads",         type: "measure"   },
    { key: "revenue",     label: "Revenue",       type: "measure"   },
    { key: "roi",         label: "ROI",           type: "measure"   },
  ],
};

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: "bar",    label: "Bar",    icon: <BarChart2 className="h-4 w-4" /> },
  { value: "line",   label: "Line",   icon: <TrendingUp className="h-4 w-4" /> },
  { value: "pie",    label: "Pie",    icon: <PieChart className="h-4 w-4" /> },
  { value: "area",   label: "Area",   icon: <TrendingUp className="h-4 w-4" /> },
  { value: "table",  label: "Table",  icon: <Table className="h-4 w-4" /> },
  { value: "metric", label: "Metric", icon: <Hash className="h-4 w-4" /> },
];

interface ReportBuilderProps {
  onSave?: (state: BuilderState & { name: string }) => void;
}

export function ReportBuilder({ onSave }: ReportBuilderProps) {
  const [name,   setName]   = useState("Untitled Report");
  const [source, setSource] = useState<DataSource>("deals");
  const [state,  setState]  = useState<BuilderState>({
    source: "deals",
    rows:    [],
    columns: [],
    values:  [],
    filters: [],
    chartType: "bar",
  });

  const availableFields = SOURCE_FIELDS[source];

  function changeSource(s: DataSource) {
    setSource(s);
    setState({ source: s, rows: [], columns: [], values: [], filters: [], chartType: state.chartType });
  }

  function addToZone(zone: "rows" | "columns" | "values", field: BuilderField) {
    setState((prev) => {
      const already = prev[zone].some((f) => f.key === field.key);
      if (already) return prev;
      return { ...prev, [zone]: [...prev[zone], field] };
    });
  }

  function removeFromZone(zone: "rows" | "columns" | "values", key: string) {
    setState((prev) => ({ ...prev, [zone]: prev[zone].filter((f) => f.key !== key) }));
  }

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* Left panel: source + fields */}
      <aside className="w-56 shrink-0 border-r border-border bg-muted/20 p-4 space-y-5">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Data Source</p>
          <div className="space-y-1">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                onClick={() => changeSource(s.value)}
                className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
                  source === s.value ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" />{s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Fields</p>
          <div className="space-y-1">
            {availableFields.map((f) => (
              <div
                key={f.key}
                className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs cursor-default"
              >
                <div className="flex items-center gap-1.5">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className={f.type === "measure" ? "text-purple-600 dark:text-purple-400" : "text-foreground"}>{f.label}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {f.type === "dimension" ? (
                    <>
                      <button onClick={() => addToZone("rows", f)} className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">R</button>
                      <button onClick={() => addToZone("columns", f)} className="text-[9px] px-1 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">C</button>
                    </>
                  ) : (
                    <button onClick={() => addToZone("values", f)} className="text-[9px] px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">V</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main builder canvas */}
      <main className="flex-1 p-6 space-y-6">
        {/* Report name */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-purple-500 focus:outline-none transition-colors py-0.5 min-w-0 flex-1"
          />
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-4"
            onClick={() => onSave?.({ ...state, name })}
          >
            Save Report
          </Button>
        </div>

        {/* Chart type selector */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Visualisation</p>
          <div className="flex gap-2 flex-wrap">
            {CHART_TYPES.map((c) => (
              <button
                key={c.value}
                onClick={() => setState((prev) => ({ ...prev, chartType: c.value }))}
                className={cn("flex items-center gap-1.5 h-9 px-3 text-xs rounded-xl border transition-colors",
                  state.chartType === c.value ? "bg-purple-600 border-purple-600 text-white" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {c.icon}{c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DropZone title="Rows" color="blue" fields={state.rows}    onRemove={(k) => removeFromZone("rows", k)} />
          <DropZone title="Columns" color="teal" fields={state.columns} onRemove={(k) => removeFromZone("columns", k)} />
          <DropZone title="Values" color="purple" fields={state.values}  onRemove={(k) => removeFromZone("values", k)} />
        </div>

        {/* Preview placeholder */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-xs font-semibold text-muted-foreground mb-4">Preview</p>
          {state.rows.length === 0 && state.values.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <LayoutGrid className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Add fields to rows and values to see a preview</p>
              <p className="text-xs text-muted-foreground mt-1">Click R / C / V on a field to place it</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48">
              <div className="flex items-end gap-2 mb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-8 rounded-t bg-purple-500/60" style={{ height: `${30 + Math.random() * 70}px` }} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {state.chartType === "table" ? "Table preview" : `${state.chartType.charAt(0).toUpperCase() + state.chartType.slice(1)} chart`}
                {" — "}
                {state.rows.map((f) => f.label).join(", ")} × {state.values.map((f) => f.label).join(", ")}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DropZone({
  title, color, fields, onRemove,
}: {
  title: string;
  color: "blue" | "teal" | "purple";
  fields: BuilderField[];
  onRemove: (key: string) => void;
}) {
  const colorMap = {
    blue:   { border: "border-blue-200 dark:border-blue-800",   bg: "bg-blue-50 dark:bg-blue-950/20",   tag: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
    teal:   { border: "border-teal-200 dark:border-teal-800",   bg: "bg-teal-50 dark:bg-teal-950/20",   tag: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400" },
    purple: { border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-50 dark:bg-purple-950/20", tag: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  };
  const c = colorMap[color];

  return (
    <div className={cn("rounded-xl border-2 border-dashed p-4 min-h-[100px]", c.border, c.bg)}>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</p>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Drag fields here or click the zone button</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <span key={f.key} className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium", c.tag)}>
              {f.label}
              <button onClick={() => onRemove(f.key)} className="hover:opacity-70">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
