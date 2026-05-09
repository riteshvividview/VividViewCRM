"use client";
import { useCallback, useEffect, useState } from "react";
import type { MarketingCampaign, CampaignAsset } from "../types";

const dt = (d: number) => new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

export const MOCK_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: "mc1", name: "Google Search — CRM Keywords", type: "google_ads", status: "active",
    budget: 1_50_000, spent: 1_12_000, leads_generated: 84, revenue_attributed: 6_20_000, pipeline_value: 9_40_000, roi: 453,
    start_date: dt(45), end_date: null, territory: "All India",
    utm_params: { source: "google", medium: "cpc", campaign: "crm-keywords", term: "crm software india" },
    assets: [{ id: "a1", name: "Banner_300x250.png", type: "image", url: "", size_kb: 120, uploaded_at: dt(40) }],
    created_at: dt(45),
  },
  {
    id: "mc2", name: "LinkedIn Thought Leadership", type: "linkedin", status: "active",
    budget: 80_000, spent: 48_000, leads_generated: 42, revenue_attributed: 3_80_000, pipeline_value: 5_60_000, roi: 692,
    start_date: dt(30), end_date: null, territory: "Delhi NCR",
    utm_params: { source: "linkedin", medium: "social", campaign: "thought-leadership" },
    assets: [],
    created_at: dt(30),
  },
  {
    id: "mc3", name: "Instagram Awareness — Q2", type: "instagram", status: "active",
    budget: 60_000, spent: 54_000, leads_generated: 31, revenue_attributed: 1_90_000, pipeline_value: 3_20_000, roi: 252,
    start_date: dt(60), end_date: null, territory: "Mumbai",
    utm_params: { source: "instagram", medium: "social", campaign: "q2-awareness" },
    assets: [{ id: "a2", name: "Reel_Cover.mp4", type: "video", url: "", size_kb: 4200, uploaded_at: dt(55) }],
    created_at: dt(60),
  },
  {
    id: "mc4", name: "Tech Blogs — SEO Content", type: "blogs", status: "active",
    budget: 30_000, spent: 22_000, leads_generated: 56, revenue_attributed: 4_10_000, pipeline_value: 6_80_000, roi: 1764,
    start_date: dt(90), end_date: null, territory: "All India",
    utm_params: { source: "organic", medium: "content", campaign: "seo-blogs" },
    assets: [{ id: "a3", name: "Article_Brief.pdf", type: "pdf", url: "", size_kb: 85, uploaded_at: dt(80) }],
    created_at: dt(90),
  },
  {
    id: "mc5", name: "Facebook Retargeting", type: "facebook", status: "paused",
    budget: 70_000, spent: 35_000, leads_generated: 19, revenue_attributed: 1_20_000, pipeline_value: 2_40_000, roi: 243,
    start_date: dt(50), end_date: null, territory: "Bangalore",
    utm_params: { source: "facebook", medium: "paid_social", campaign: "retargeting-q2" },
    assets: [],
    created_at: dt(50),
  },
  {
    id: "mc6", name: "Times of India PR Feature", type: "pr_articles", status: "completed",
    budget: 45_000, spent: 45_000, leads_generated: 28, revenue_attributed: 2_80_000, pipeline_value: 0, roi: 522,
    start_date: dt(75), end_date: dt(45), territory: "All India",
    utm_params: { source: "press", medium: "pr", campaign: "toi-feature" },
    assets: [{ id: "a4", name: "PR_Draft.docx", type: "doc", url: "", size_kb: 64, uploaded_at: dt(70) }],
    created_at: dt(75),
  },
  {
    id: "mc7", name: "Outdoor — Hyderabad Tech Park", type: "outdoor_ads", status: "active",
    budget: 1_20_000, spent: 1_20_000, leads_generated: 15, revenue_attributed: 1_60_000, pipeline_value: 3_00_000, roi: 33,
    start_date: dt(30), end_date: null, territory: "Hyderabad",
    utm_params: { source: "offline", medium: "outdoor", campaign: "hyd-techpark" },
    assets: [{ id: "a5", name: "Billboard_Design.png", type: "image", url: "", size_kb: 890, uploaded_at: dt(28) }],
    created_at: dt(30),
  },
  {
    id: "mc8", name: "Affiliate Partner Network", type: "affiliate", status: "active",
    budget: 50_000, spent: 28_000, leads_generated: 38, revenue_attributed: 3_20_000, pipeline_value: 4_80_000, roi: 1043,
    start_date: dt(20), end_date: null, territory: "All India",
    utm_params: { source: "affiliate", medium: "partner", campaign: "partner-network" },
    assets: [],
    created_at: dt(20),
  },
];

export const LEAD_SOURCE_DATA = [
  { month: "Oct", revenue: 4.2, pipeline: 7.8 },
  { month: "Nov", revenue: 5.1, pipeline: 9.2 },
  { month: "Dec", revenue: 4.8, pipeline: 8.4 },
  { month: "Jan", revenue: 6.3, pipeline: 11.1 },
  { month: "Feb", revenue: 7.2, pipeline: 12.6 },
  { month: "Mar", revenue: 6.8, pipeline: 10.9 },
  { month: "Apr", revenue: 8.4, pipeline: 14.2 },
  { month: "May", revenue: 9.1, pipeline: 15.8 },
];

export const TERRITORY_DATA = [
  { city: "Hyderabad", revenue: 19.7, pipeline: 8.3 },
  { city: "Mumbai",    revenue: 14.3, pipeline: 6.7 },
  { city: "Bangalore", revenue: 12.8, pipeline: 5.9 },
  { city: "Delhi NCR", revenue: 10.4, pipeline: 7.2 },
  { city: "Gurugram",  revenue: 7.6,  pipeline: 4.1 },
  { city: "Chennai",   revenue: 6.2,  pipeline: 3.8 },
  { city: "Pune",      revenue: 4.9,  pipeline: 2.6 },
];

export function useMarketing() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 300));
      setCampaigns(MOCK_CAMPAIGNS);
      setLoading(false);
    };
    load();
  }, []);

  const addCampaign = useCallback((c: Partial<MarketingCampaign>) => {
    const n: MarketingCampaign = {
      id: crypto.randomUUID(), name: c.name ?? "New Campaign",
      type: c.type ?? "google_ads", status: "draft",
      budget: c.budget ?? 0, spent: 0, leads_generated: 0,
      revenue_attributed: 0, pipeline_value: 0, roi: 0,
      start_date: new Date().toISOString().split("T")[0], end_date: null,
      utm_params: { source: "", medium: "", campaign: "" },
      assets: [], created_at: new Date().toISOString(), ...c,
    };
    setCampaigns((p) => [n, ...p]);
    return n;
  }, []);

  const updateCampaign = useCallback((id: string, updates: Partial<MarketingCampaign>) => {
    setCampaigns((p) => p.map((c) => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns((p) => p.filter((c) => c.id !== id));
  }, []);

  const addAsset = useCallback((campaignId: string, asset: CampaignAsset) => {
    setCampaigns((p) => p.map((c) => c.id === campaignId ? { ...c, assets: [...c.assets, asset] } : c));
  }, []);

  return { campaigns, loading, addCampaign, updateCampaign, deleteCampaign, addAsset };
}
