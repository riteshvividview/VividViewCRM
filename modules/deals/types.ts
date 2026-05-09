export type DealStage = "Av. Leads" | "Samples Sent" | "Quotes" | "Negotiations" | "Sales";
export type DealLocation = "Delhi" | "Mumbai" | "Bangalore" | "Chennai" | "Hyderabad" | "Other";

export interface Deal {
  id: string;
  title: string;
  lead_id: string | null;
  stage: DealStage;
  value: number;
  currency: string;
  close_date: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_avatar: string | null;
  location: DealLocation | null;
  notes: string | null;
  company: string | null;
  contact_name: string | null;
  won_lost_reason: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
  workspace_id: string | null;
}

export const DEAL_STAGES: DealStage[] = ["Av. Leads", "Samples Sent", "Quotes", "Negotiations", "Sales"];

export const DEAL_LOCATIONS: DealLocation[] = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Hyderabad", "Other"];

export const LOCATION_CONFIG: Record<DealLocation, { color: string; bg: string; border: string }> = {
  Delhi:     { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-l-blue-500" },
  Mumbai:    { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-l-amber-500" },
  Bangalore: { color: "text-emerald-700",bg: "bg-emerald-50",border: "border-l-emerald-500" },
  Chennai:   { color: "text-purple-700", bg: "bg-purple-50", border: "border-l-purple-500" },
  Hyderabad: { color: "text-rose-700",   bg: "bg-rose-50",   border: "border-l-rose-500" },
  Other:     { color: "text-slate-600",  bg: "bg-slate-50",  border: "border-l-slate-400" },
};

export const STAGE_CONFIG: Record<DealStage, { color: string; bg: string }> = {
  "Av. Leads":    { color: "text-slate-700",   bg: "bg-slate-100" },
  "Samples Sent": { color: "text-blue-700",    bg: "bg-blue-100" },
  "Quotes":       { color: "text-amber-700",   bg: "bg-amber-100" },
  "Negotiations": { color: "text-purple-700",  bg: "bg-purple-100" },
  "Sales":        { color: "text-emerald-700", bg: "bg-emerald-100" },
};

export interface DealActivity {
  id: string;
  deal_id: string;
  type: "note" | "status_change" | "file_upload" | "call" | "email";
  content: string;
  created_by: string | null;
  created_at: string;
}
