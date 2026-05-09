"use client";
import { useCallback, useEffect, useState } from "react";
import type { Company } from "../types";

export const MOCK_COMPANIES: Company[] = [
  { id: "co1", name: "TechFlow Inc", logo_url: null, industry: "Technology", website: "https://techflow.com", revenue: 50000000, employee_count: "201-500", hq_location: "Mumbai, India", parent_company_id: null, parent_company_name: null, description: "Leading SaaS provider for enterprise workflow automation.", workspace_id: null, created_at: "2026-03-01T10:00:00Z", contact_count: 2 },
  { id: "co2", name: "Nexus Digital", logo_url: null, industry: "Technology", website: "https://nexus.io", revenue: 12000000, employee_count: "51-200", hq_location: "Bangalore, India", parent_company_id: null, parent_company_name: null, description: "Digital transformation agency specializing in cloud migration.", workspace_id: null, created_at: "2026-03-05T10:00:00Z", contact_count: 1 },
  { id: "co3", name: "CloudBase Labs", logo_url: null, industry: "Technology", website: "https://cloudbase.co", revenue: 8000000, employee_count: "11-50", hq_location: "Hyderabad, India", parent_company_id: "co1", parent_company_name: "TechFlow Inc", description: "Cloud infrastructure startup (subsidiary of TechFlow).", workspace_id: null, created_at: "2026-03-10T10:00:00Z", contact_count: 1 },
  { id: "co4", name: "Meridian Corp", logo_url: null, industry: "Manufacturing", website: "https://meridian.com", revenue: 120000000, employee_count: "500+", hq_location: "Delhi, India", parent_company_id: null, parent_company_name: null, description: "Industrial manufacturing conglomerate with operations across India.", workspace_id: null, created_at: "2026-03-15T10:00:00Z", contact_count: 1 },
  { id: "co5", name: "Spark Analytics", logo_url: null, industry: "Technology", website: "https://sparkanalytics.com", revenue: 22000000, employee_count: "51-200", hq_location: "Pune, India", parent_company_id: null, parent_company_name: null, description: "Business intelligence and data analytics platform.", workspace_id: null, created_at: "2026-03-20T10:00:00Z", contact_count: 1 },
  { id: "co6", name: "LaunchPad Co", logo_url: null, industry: "Consulting", website: "https://launchpad.io", revenue: 5000000, employee_count: "11-50", hq_location: "Chennai, India", parent_company_id: null, parent_company_name: null, description: "Startup accelerator and venture studio.", workspace_id: null, created_at: "2026-03-25T10:00:00Z", contact_count: 1 },
];

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 400)); setCompanies(MOCK_COMPANIES); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("companies").select("*").order("name");
      setCompanies(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const addCompany = useCallback(async (c: Omit<Company, "id" | "created_at">) => {
    const n: Company = { ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setCompanies((p) => [...p, n]);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return n;
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().from("companies").insert([n]).select().single();
    return data ?? n;
  }, []);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    setCompanies((p) => p.map((c) => c.id === id ? { ...c, ...updates } : c));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("companies").update(updates).eq("id", id);
  }, []);

  return { companies, loading, fetchCompanies, addCompany, updateCompany, setCompanies };
}
