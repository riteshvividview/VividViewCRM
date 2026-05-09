"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { REPORT_CATALOG } from "@/modules/reports/types";
import {
  PIPELINE_FUNNEL, MONTHLY_REVENUE, LEAD_SOURCES,
  REP_REVENUE, ACTIVITY_BY_REP, CAMPAIGN_ROI,
  TERRITORY_REVENUE, WON_VS_LOST,
} from "@/modules/reports/data/mock-data";
import { ReportShell } from "@/modules/reports/components/report-shell";
import { SalesPipelineReport } from "@/modules/reports/components/sales-pipeline-report";
import { RevenueReport } from "@/modules/reports/components/revenue-report";
import { LeadSourceReport } from "@/modules/reports/components/lead-source-report";
import { TeamPerformanceReport } from "@/modules/reports/components/team-performance-report";
import { ActivityReport } from "@/modules/reports/components/activity-report";
import { CampaignPerformanceReport } from "@/modules/reports/components/campaign-performance-report";
import { TerritoryReport } from "@/modules/reports/components/territory-report";
import { WonLostReport } from "@/modules/reports/components/won-lost-report";

const PERIOD_OPTIONS = [
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

function exportDataFor(slug: string): Record<string, unknown>[] {
  switch (slug) {
    case "sales-pipeline":       return PIPELINE_FUNNEL as unknown as Record<string, unknown>[];
    case "revenue":              return MONTHLY_REVENUE as unknown as Record<string, unknown>[];
    case "lead-source":          return LEAD_SOURCES    as unknown as Record<string, unknown>[];
    case "team-performance":     return REP_REVENUE     as unknown as Record<string, unknown>[];
    case "activity":             return ACTIVITY_BY_REP as unknown as Record<string, unknown>[];
    case "campaign-performance": return CAMPAIGN_ROI    as unknown as Record<string, unknown>[];
    case "territory":            return TERRITORY_REVENUE as unknown as Record<string, unknown>[];
    case "won-lost":             return WON_VS_LOST     as unknown as Record<string, unknown>[];
    default:                     return [];
  }
}

export default function ReportSlugPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const meta = REPORT_CATALOG.find((r) => r.slug === slug);
  if (!meta) notFound();

  const [filters, setFilters] = useState<Record<string, string>>({ period: "monthly" });

  const filterConfig = slug === "revenue"
    ? [{ key: "period", label: "Period", options: PERIOD_OPTIONS }]
    : [];

  return (
    <ReportShell
      title={meta.title}
      description={meta.description}
      icon={meta.icon}
      filters={filterConfig}
      filterValues={filters}
      onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
      exportData={exportDataFor(slug)}
      exportFilename={slug}
    >
      {slug === "sales-pipeline"       && <SalesPipelineReport />}
      {slug === "revenue"              && <RevenueReport period={filters.period} />}
      {slug === "lead-source"          && <LeadSourceReport />}
      {slug === "team-performance"     && <TeamPerformanceReport />}
      {slug === "activity"             && <ActivityReport />}
      {slug === "campaign-performance" && <CampaignPerformanceReport />}
      {slug === "territory"            && <TerritoryReport />}
      {slug === "won-lost"             && <WonLostReport />}
    </ReportShell>
  );
}
