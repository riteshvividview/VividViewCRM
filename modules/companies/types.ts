export type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "500+";
export type CompanyIndustry = "Technology" | "Finance" | "Healthcare" | "Manufacturing" | "Retail" | "Education" | "Consulting" | "Media" | "Real Estate" | "Other";

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  industry: CompanyIndustry | null;
  website: string | null;
  revenue: number | null;
  employee_count: CompanySize | null;
  hq_location: string | null;
  parent_company_id: string | null;
  parent_company_name: string | null;
  description: string | null;
  workspace_id: string | null;
  created_at: string;
  contact_count?: number;
}

export const COMPANY_INDUSTRIES: CompanyIndustry[] = [
  "Technology", "Finance", "Healthcare", "Manufacturing", "Retail",
  "Education", "Consulting", "Media", "Real Estate", "Other",
];

export const COMPANY_SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "201-500", "500+"];
