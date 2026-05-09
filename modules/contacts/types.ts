export type ContactStatus = "Active" | "Inactive" | "Prospect";

export interface CustomField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiselect" | "url" | "email";
  value: string | string[] | null;
  options?: string[];
}

export interface ContactActivity {
  id: string;
  contact_id: string;
  type: "call" | "email" | "meeting" | "note" | "deal" | "file";
  content: string;
  created_by: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ContactFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mime_type: string;
  entity_type: "contact" | "company" | "deal";
  entity_id: string;
  created_at: string;
  created_by?: string | null;
}

export interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  company_name: string | null;
  avatar_url: string | null;
  status: ContactStatus;
  tags: string[];
  owner: string | null;
  owner_name: string | null;
  last_activity_at: string | null;
  custom_fields: CustomField[];
  notes_content: Record<string, unknown> | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTACT_TAGS = ["VIP", "Hot Lead", "Partner", "Vendor", "Decision Maker", "Champion", "Influencer", "Finance", "Technical"];
export const AVATAR_PALETTE = ["bg-purple-100 text-purple-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
