"use client";

import { useState } from "react";
import Link from "next/link";
import { Pin, PinOff, BarChart2, Clock, Search } from "lucide-react";
import { REPORT_CATALOG, CATEGORY_CONFIG, type ReportCategory, type ReportMeta } from "@/modules/reports/types";
import { useReports } from "@/modules/reports/hooks/use-reports";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: "all" | ReportCategory; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "sales",     label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "team",      label: "Team" },
  { value: "territory", label: "Territory" },
  { value: "activity",  label: "Activity" },
];

export default function ReportsPage() {
  const { pinned, recent, isPinned, pin, unpin } = useReports();
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState<"all" | ReportCategory>("all");

  const filtered = REPORT_CATALOG.filter((r) => {
    const matchesQ = r.title.toLowerCase().includes(query.toLowerCase()) || r.description.toLowerCase().includes(query.toLowerCase());
    const matchesC = category === "all" || r.category === category;
    return matchesQ && matchesC;
  });

  return (
    <div className="p-6 space-y-7 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pre-built reports and custom analytics</p>
        </div>
        <Link
          href="/dashboard/reports/builder"
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Custom Report
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reports…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn("h-9 px-3 text-xs font-medium rounded-xl border transition-colors",
                category === c.value
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && query === "" && category === "all" && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <Pin className="h-3.5 w-3.5 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Pinned</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinned.map((r) => <ReportCard key={r.slug} report={r} pinned isPinned={isPinned} onPin={pin} onUnpin={unpin} />)}
          </div>
        </section>
      )}

      {/* Recent */}
      {recent.length > 0 && query === "" && category === "all" && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recently Viewed</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {recent.map((r) => {
              const RecentIcon = r.icon;
              return (
                <Link
                  key={r.slug}
                  href={`/dashboard/reports/${r.slug}`}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <RecentIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {r.title}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* All reports */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">{query || category !== "all" ? "Results" : "All Reports"}</h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No reports match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => <ReportCard key={r.slug} report={r} pinned={false} isPinned={isPinned} onPin={pin} onUnpin={unpin} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportCard({
  report,
  isPinned,
  onPin,
  onUnpin,
}: {
  report: ReportMeta;
  pinned: boolean;
  isPinned: (slug: string) => boolean;
  onPin: (slug: string) => void;
  onUnpin: (slug: string) => void;
}) {
  const cat    = CATEGORY_CONFIG[report.category];
  const pinned = isPinned(report.slug);
  const Icon   = report.icon;

  return (
    <div className="group relative bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow">
      <button
        onClick={(e) => { e.preventDefault(); pinned ? onUnpin(report.slug) : onPin(report.slug); }}
        className={cn("absolute top-4 right-4 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
          pinned ? "opacity-100 text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        {pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
      </button>

      <Link href={`/dashboard/reports/${report.slug}`} className="block">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">{report.title}</p>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block", cat.bg, cat.color)}>{cat.label}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{report.description}</p>
      </Link>
    </div>
  );
}
