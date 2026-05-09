export type LeadStatus = "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
export type LeadSource = "Website" | "Referral" | "Cold Call" | "Social Media" | "Event" | "Email Campaign" | "Partner" | "Other";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_id: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  score: number;
  assigned_to: string | null;
  assigned_name: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  workspace_id: string | null;
}

export type ViewMode = "table" | "kanban" | "list";

export const LEAD_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

export const LEAD_SOURCES: LeadSource[] = [
  "Website", "Referral", "Cold Call", "Social Media", "Event", "Email Campaign", "Partner", "Other",
];

export const STATUS_CONFIG: Record<LeadStatus, { color: string; bg: string; border: string; dot: string }> = {
  New:        { color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-950/60",    border: "border-blue-200 dark:border-blue-800",   dot: "bg-blue-500" },
  Contacted:  { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/60",  border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  Qualified:  { color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/60", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-500" },
  Proposal:   { color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-950/60", border: "border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500" },
  Won:        { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  Lost:       { color: "text-red-700 dark:text-red-300",     bg: "bg-red-50 dark:bg-red-950/60",      border: "border-red-200 dark:border-red-800",     dot: "bg-red-500" },
};

export function calcScore(lead: Partial<Lead>): number {
  let score = 0;
  if (lead.email) score += 20;
  if (lead.phone) score += 15;
  if (lead.company) score += 15;
  const statusBonus: Record<string, number> = { New: 5, Contacted: 15, Qualified: 35, Proposal: 55, Won: 100, Lost: 0 };
  score += statusBonus[lead.status ?? "New"] ?? 0;
  const sourceBonus: Record<string, number> = { Referral: 10, Website: 7, Event: 8, Partner: 10 };
  score += sourceBonus[lead.source ?? ""] ?? 0;
  return Math.min(100, score);
}

export function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}
