"use client";

import { useState } from "react";
import { REPORT_CATALOG, ReportMeta } from "../types";

interface SavedReport {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  pinnedAt?: string;
}

const INITIAL_SAVED: SavedReport[] = [
  { id: "1", name: "Monthly Revenue Tracker", slug: "revenue",       config: { period: "monthly" }, pinnedAt: new Date().toISOString() },
  { id: "2", name: "Pipeline Health Check",   slug: "sales-pipeline", config: {},                   pinnedAt: new Date().toISOString() },
];

export function useReports() {
  const [saved, setSaved]   = useState<SavedReport[]>(INITIAL_SAVED);
  const [recent, setRecent] = useState<string[]>(["revenue", "sales-pipeline", "lead-source"]);

  function pin(slug: string) {
    setSaved((prev) => {
      const exists = prev.find((r) => r.slug === slug);
      if (exists) return prev.map((r) => r.slug === slug ? { ...r, pinnedAt: new Date().toISOString() } : r);
      const meta = REPORT_CATALOG.find((r) => r.slug === slug);
      if (!meta) return prev;
      return [...prev, { id: Date.now().toString(), name: meta.title, slug, config: {}, pinnedAt: new Date().toISOString() }];
    });
  }

  function unpin(slug: string) {
    setSaved((prev) => prev.filter((r) => r.slug !== slug));
  }

  function isPinned(slug: string) {
    return saved.some((r) => r.slug === slug && r.pinnedAt);
  }

  function markRecent(slug: string) {
    setRecent((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 6));
  }

  const recentReports: ReportMeta[] = recent
    .map((slug) => REPORT_CATALOG.find((r) => r.slug === slug))
    .filter(Boolean) as ReportMeta[];

  const pinnedReports: ReportMeta[] = saved
    .filter((s) => s.pinnedAt)
    .map((s) => REPORT_CATALOG.find((r) => r.slug === s.slug))
    .filter(Boolean) as ReportMeta[];

  return { saved, recent: recentReports, pinned: pinnedReports, pin, unpin, isPinned, markRecent };
}
