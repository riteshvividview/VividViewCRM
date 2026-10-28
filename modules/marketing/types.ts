import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faGoogle, faFacebook, faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { faNewspaper, faPenNib, faSignHanging, faLink } from "@fortawesome/free-solid-svg-icons";
export type MarketingCampaignType =
  | "google_ads" | "facebook" | "instagram" | "pr_articles"
  | "blogs" | "outdoor_ads" | "linkedin" | "affiliate";

export type MarketingCampaignStatus = "active" | "paused" | "completed" | "draft";

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface CampaignAsset {
  id: string;
  name: string;
  type: "image" | "pdf" | "video" | "doc";
  url: string;
  size_kb: number;
  uploaded_at: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  type: MarketingCampaignType;
  status: MarketingCampaignStatus;
  budget: number;
  spent: number;
  leads_generated: number;
  revenue_attributed: number;
  pipeline_value: number;
  roi: number; // percent
  start_date: string;
  end_date: string | null;
  utm_params: UtmParams;
  assets: CampaignAsset[];
  territory?: string;
  created_at: string;
}

export const CAMPAIGN_TYPE_CONFIG: Record<MarketingCampaignType, { label: string; color: string; bg: string; icon: IconDefinition }> = {
  google_ads:   { label: "Google Ads",   color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30",     icon: faGoogle },
  facebook:     { label: "Facebook",     color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/30", icon: faFacebook },
  instagram:    { label: "Instagram",    color: "text-pink-700 dark:text-pink-400",     bg: "bg-pink-100 dark:bg-pink-900/30",     icon: faInstagram },
  pr_articles:  { label: "PR Articles",  color: "text-slate-700 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800",      icon: faNewspaper },
  blogs:        { label: "Blogs",        color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-900/30",   icon: faPenNib },
  outdoor_ads:  { label: "Outdoor Ads",  color: "text-emerald-700 dark:text-emerald-400",bg:"bg-emerald-100 dark:bg-emerald-900/30",icon: faSignHanging },
  linkedin:     { label: "LinkedIn",     color: "text-sky-700 dark:text-sky-400",       bg: "bg-sky-100 dark:bg-sky-900/30",       icon: faLinkedin },
  affiliate:    { label: "Affiliate",    color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", icon: faLink },
};

export const STATUS_CONFIG: Record<MarketingCampaignStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: "Active",    color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30",  dot: "bg-emerald-500" },
  paused:    { label: "Paused",    color: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-950/30",      dot: "bg-amber-400" },
  completed: { label: "Completed", color: "text-slate-600 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-800",        dot: "bg-slate-400" },
  draft:     { label: "Draft",     color: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-50 dark:bg-slate-900",         dot: "bg-slate-300" },
};

// Chart data types
export interface LeadSourcePoint {
  month: string;
  revenue: number;
  pipeline: number;
}

export interface TerritoryBar {
  city: string;
  revenue: number;
  pipeline: number;
}

export interface BudgetSegment {
  channel: string;
  value: number;
  color: string;
}
