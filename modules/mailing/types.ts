import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faHeading, faParagraph, faImage, faHandPointer, faMinus, faArrowsUpDown, faGripLines } from "@fortawesome/free-solid-svg-icons";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";
export type EmailBlockType = "header" | "text" | "button" | "image" | "divider" | "spacer" | "footer";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: string;
  url?: string;
  alt?: string;
  align?: "left" | "center" | "right";
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  padding?: number;
  buttonStyle?: "solid" | "outline";
}

export interface EmailTemplate {
  id: string;
  name: string;
  thumbnail?: string;
  blocks: EmailBlock[];
  html_override: string | null;
  created_at: string;
}

export interface AudienceConfig {
  source: "leads" | "contacts" | "csv";
  filters?: Record<string, string>;
  csv_recipients?: { email: string; first_name?: string; company?: string }[];
  count: number;
}

export interface DripStep {
  day: number;
  subject: string;
  preview_text: string;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  template_id: string | null;
  audience_config: AudienceConfig | null;
  subject: string;
  preview_text: string;
  schedule_time: string | null;
  drip_sequence: DripStep[];
  stats: CampaignStats;
  created_at: string;
  updated_at: string;
}

export const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: "Draft",     color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800",      dot: "bg-slate-400" },
  scheduled: { label: "Scheduled", color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40",      dot: "bg-blue-500" },
  sending:   { label: "Sending",   color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40",  dot: "bg-purple-500" },
  sent:      { label: "Sent",      color: "text-emerald-700 dark:text-emerald-400",bg:"bg-emerald-50 dark:bg-emerald-950/40",dot: "bg-emerald-500" },
  paused:    { label: "Paused",    color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/40",    dot: "bg-amber-400" },
};

export const BLOCK_PALETTE: { type: EmailBlockType; label: string; icon: IconDefinition }[] = [
  { type: "header",  label: "Header",  icon: faHeading },
  { type: "text",    label: "Text",    icon: faParagraph },
  { type: "image",   label: "Image",   icon: faImage },
  { type: "button",  label: "Button",  icon: faHandPointer },
  { type: "divider", label: "Divider", icon: faMinus },
  { type: "spacer",  label: "Spacer",  icon: faArrowsUpDown },
  { type: "footer",  label: "Footer",  icon: faGripLines },
];

export const PERSONALIZATION_TOKENS = [
  { token: "{{first_name}}",  label: "First Name" },
  { token: "{{last_name}}",   label: "Last Name" },
  { token: "{{company}}",     label: "Company" },
  { token: "{{email}}",       label: "Email" },
  { token: "{{unsubscribe}}", label: "Unsubscribe Link" },
];
