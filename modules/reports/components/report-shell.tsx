"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "./export-button";
import { cn } from "@/lib/utils";

interface FilterConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ReportShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  exportData?: Record<string, unknown>[];
  exportFilename?: string;
  children: React.ReactNode;
}

export function ReportShell({
  title, description, icon: Icon, filters = [], filterValues = {},
  onFilterChange, exportData = [], exportFilename = "report", children,
}: ReportShellProps) {
  const [refreshing, setRefreshing] = useState(false);
  const lastUpdated = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  async function handleRefresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Left: filter sidebar */}
      <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/20 p-4 space-y-5 print:hidden">
        <Link href="/dashboard/reports" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />All Reports
        </Link>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {filters.length > 0 && (
          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Filters</p>
            {filters.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <select
                  value={filterValues[f.key] ?? f.options[0]?.value ?? ""}
                  onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                  className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background text-foreground"
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />Updated {lastUpdated}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 h-7 text-xs"
            onClick={handleRefresh}
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh data"}
          </Button>
        </div>
      </aside>

      {/* Right: content */}
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
            <ExportButton filename={exportFilename} data={exportData} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

// Shared chart card wrapper
interface ChartCardProps {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, sub, children, className, action }: ChartCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl p-5", className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Shared metric badge
export function MetricBadge({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
