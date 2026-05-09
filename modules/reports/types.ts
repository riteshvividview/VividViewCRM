import type { LucideIcon } from "lucide-react";
import { TrendingDown, DollarSign, Radio, Trophy, BarChart2, Megaphone, Map, Scale } from "lucide-react";

export type ReportSlug =
  | "sales-pipeline" | "revenue" | "lead-source" | "team-performance"
  | "activity" | "campaign-performance" | "territory" | "won-lost";

export type ReportCategory =
  | "sales" | "marketing" | "team" | "territory" | "activity" | "custom";

export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "scatter" | "table" | "metric";

export type DataSource = "leads" | "deals" | "contacts" | "activities" | "campaigns";

export interface ReportMeta {
  slug: ReportSlug;
  title: string;
  description: string;
  category: ReportCategory;
  icon: LucideIcon;
  isPinned?: boolean;
}

export interface WidgetType {
  id: string;
  type: ChartType;
  title: string;
  dataKey: string;
  colSpan: 1 | 2 | 3;
  rowSpan?: 1 | 2;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  widgets: WidgetType[];
}

export interface SavedReport {
  id: string;
  name: string;
  slug?: ReportSlug;
  category: ReportCategory;
  config: BuilderState;
  is_pinned: boolean;
  created_at: string;
}

export interface BuilderField {
  key: string;
  label: string;
  type: "dimension" | "measure" | "filter";
}

export interface BuilderState {
  source: DataSource;
  rows: BuilderField[];
  columns: BuilderField[];
  values: BuilderField[];
  filters: BuilderField[];
  chartType: ChartType;
}

export const REPORT_CATALOG: ReportMeta[] = [
  { slug: "sales-pipeline",      title: "Sales Pipeline",           description: "Funnel conversion rates and stage analysis",           category: "sales",     icon: TrendingDown, isPinned: true },
  { slug: "revenue",             title: "Revenue Report",           description: "Monthly/quarterly revenue vs target by rep",           category: "sales",     icon: DollarSign,   isPinned: true },
  { slug: "lead-source",         title: "Lead Source Analysis",     description: "Lead volume and conversion rate per acquisition source",category: "marketing", icon: Radio },
  { slug: "team-performance",    title: "Team Performance",         description: "Leaderboard, target attainment, and rep KPIs",         category: "team",      icon: Trophy,       isPinned: true },
  { slug: "activity",            title: "Activity Report",          description: "Calls, emails, meetings per rep — heat map by day",    category: "activity",  icon: BarChart2 },
  { slug: "campaign-performance",title: "Campaign Performance",     description: "ROI per campaign, CPL, pipeline attribution",          category: "marketing", icon: Megaphone },
  { slug: "territory",           title: "Territory Report",         description: "Revenue and pipeline by geographic region",            category: "territory", icon: Map },
  { slug: "won-lost",            title: "Won / Lost Analysis",      description: "Win rates, loss reasons, competitor analysis",         category: "sales",     icon: Scale },
];

export const CATEGORY_CONFIG: Record<ReportCategory, { label: string; color: string; bg: string }> = {
  sales:     { label: "Sales",      color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  marketing: { label: "Marketing",  color: "text-pink-700 dark:text-pink-400",     bg: "bg-pink-100 dark:bg-pink-900/30" },
  team:      { label: "Team",       color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30" },
  territory: { label: "Territory",  color: "text-teal-700 dark:text-teal-400",     bg: "bg-teal-100 dark:bg-teal-900/30" },
  activity:  { label: "Activity",   color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-900/30" },
  custom:    { label: "Custom",     color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800" },
};

// Consistent chart color palette
export const CHART_COLORS = {
  purple: "#7C3AED",
  teal:   "#0D9488",
  coral:  "#F97316",
  green:  "#10B981",
  blue:   "#2563EB",
  pink:   "#EC4899",
  amber:  "#F59E0B",
  slate:  "#64748B",
};

export const PALETTE = Object.values(CHART_COLORS);
