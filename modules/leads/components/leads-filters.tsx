"use client";

import { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, LEAD_SOURCES, STATUS_CONFIG, type LeadStatus, type LeadSource } from "../types";
import { cn } from "@/lib/utils";

export interface LeadsFilterState {
  statuses: LeadStatus[];
  sources: LeadSource[];
  assignedTo: string[];
  scoreMin: number;
  scoreMax: number;
}

export const DEFAULT_FILTERS: LeadsFilterState = {
  statuses: [], sources: [], assignedTo: [], scoreMin: 0, scoreMax: 100,
};

interface LeadsFiltersProps {
  filters: LeadsFilterState;
  onChange: (f: LeadsFilterState) => void;
  totalCount: number;
  filteredCount: number;
}

const ASSIGNEES = ["Alex Kumar", "Priya Singh", "Sam Tiwari"];

function Chip({ label, color, onRemove }: { label: string; color?: string; onRemove: () => void }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", color ?? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300")}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function LeadsFilters({ filters, onChange, totalCount, filteredCount }: LeadsFiltersProps) {
  const [open, setOpen] = useState(false);

  const toggleStatus = (s: LeadStatus) => {
    const next = filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  };
  const toggleSource = (s: LeadSource) => {
    const next = filters.sources.includes(s) ? filters.sources.filter((x) => x !== s) : [...filters.sources, s];
    onChange({ ...filters, sources: next });
  };
  const toggleAssignee = (a: string) => {
    const next = filters.assignedTo.includes(a) ? filters.assignedTo.filter((x) => x !== a) : [...filters.assignedTo, a];
    onChange({ ...filters, assignedTo: next });
  };
  const clearAll = () => onChange(DEFAULT_FILTERS);
  const hasFilters = filters.statuses.length > 0 || filters.sources.length > 0 || filters.assignedTo.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 h-8", open && "bg-accent border-purple-300")}
          onClick={() => setOpen((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </Button>

        {/* Active filter chips */}
        {filters.statuses.map((s) => (
          <Chip key={s} label={s} color={cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color)} onRemove={() => toggleStatus(s)} />
        ))}
        {filters.sources.map((s) => (
          <Chip key={s} label={s} onRemove={() => toggleSource(s)} />
        ))}
        {filters.assignedTo.map((a) => (
          <Chip key={a} label={a} color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" onRemove={() => toggleAssignee(a)} />
        ))}
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground gap-1" onClick={clearAll}>
            <X className="h-3 w-3" />Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredCount === totalCount ? `${totalCount} leads` : `${filteredCount} of ${totalCount}`}
        </span>
      </div>

      {/* Expanded filter panel */}
      {open && (
        <div className="bg-card border border-border rounded-xl p-4 animate-fade-in grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = filters.statuses.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-colors", active ? cn(cfg.bg, cfg.color, cfg.border) : "border-border text-muted-foreground hover:bg-muted")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Source</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSource(s)}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-colors", filters.sources.includes(s) ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assigned To</p>
            <div className="flex flex-wrap gap-1.5">
              {ASSIGNEES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAssignee(a)}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium border transition-colors", filters.assignedTo.includes(a) ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {a.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
