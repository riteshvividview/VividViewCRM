"use client";

import { useCallback, useEffect, useState } from "react";
import type { Deal, DealStage } from "../types";

export const MOCK_DEALS: Deal[] = [
  { id: "d1", title: "Enterprise License – TechFlow", lead_id: "1", stage: "Av. Leads", value: 450000, currency: "INR", close_date: "2026-06-30", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Delhi", notes: null, company: "TechFlow Inc", contact_name: "Sarah Chen", won_lost_reason: null, days_in_stage: 3, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-01T10:00:00Z", workspace_id: null },
  { id: "d2", title: "API Integration Package", lead_id: "2", stage: "Samples Sent", value: 120000, currency: "INR", close_date: "2026-06-15", assigned_to: "u2", assigned_name: "Priya Singh", assigned_avatar: null, location: "Mumbai", notes: null, company: "Nexus Digital", contact_name: "Marcus Webb", won_lost_reason: null, days_in_stage: 7, created_at: "2026-05-02T09:00:00Z", updated_at: "2026-05-02T09:00:00Z", workspace_id: null },
  { id: "d3", title: "Annual Support Contract", lead_id: "3", stage: "Quotes", value: 670000, currency: "INR", close_date: "2026-07-01", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Bangalore", notes: null, company: "CloudBase Labs", contact_name: "Elena Vasquez", won_lost_reason: null, days_in_stage: 2, created_at: "2026-05-03T08:00:00Z", updated_at: "2026-05-03T08:00:00Z", workspace_id: null },
  { id: "d4", title: "Platform Expansion Deal", lead_id: "4", stage: "Negotiations", value: 1200000, currency: "INR", close_date: "2026-06-20", assigned_to: "u3", assigned_name: "Sam Tiwari", assigned_avatar: null, location: "Delhi", notes: null, company: "Meridian Corp", contact_name: "James Okafor", won_lost_reason: null, days_in_stage: 11, created_at: "2026-05-04T11:00:00Z", updated_at: "2026-05-04T11:00:00Z", workspace_id: null },
  { id: "d5", title: "Data Analytics Bundle", lead_id: "5", stage: "Sales", value: 890000, currency: "INR", close_date: "2026-05-30", assigned_to: "u2", assigned_name: "Priya Singh", assigned_avatar: null, location: "Mumbai", notes: null, company: "Spark Analytics", contact_name: "Lily Nguyen", won_lost_reason: null, days_in_stage: 1, created_at: "2026-05-05T14:00:00Z", updated_at: "2026-05-05T14:00:00Z", workspace_id: null },
  { id: "d6", title: "Startup Bundle Q2", lead_id: "6", stage: "Av. Leads", value: 150000, currency: "INR", close_date: "2026-07-15", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Bangalore", notes: null, company: "LaunchPad Co", contact_name: "David Kim", won_lost_reason: null, days_in_stage: 5, created_at: "2026-05-06T16:00:00Z", updated_at: "2026-05-06T16:00:00Z", workspace_id: null },
  { id: "d7", title: "Custom Dev Project", lead_id: null, stage: "Quotes", value: 320000, currency: "INR", close_date: "2026-06-10", assigned_to: "u3", assigned_name: "Sam Tiwari", assigned_avatar: null, location: "Chennai", notes: null, company: "InnoTech Solutions", contact_name: "Rajan Mehta", won_lost_reason: null, days_in_stage: 4, created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T10:00:00Z", workspace_id: null },
];

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        await new Promise((r) => setTimeout(r, 400));
        setDeals(MOCK_DEALS);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("deals").select("*").order("created_at", { ascending: false });
      setDeals(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const updateDealStage = useCallback(async (id: string, stage: DealStage) => {
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, stage, days_in_stage: 0 } : d));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("deals").update({ stage }).eq("id", id);
  }, []);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>) => {
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("deals").update(updates).eq("id", id);
  }, []);

  const addDeal = useCallback(async (deal: Omit<Deal, "id" | "created_at" | "updated_at" | "days_in_stage">) => {
    const newDeal: Deal = { ...deal, id: crypto.randomUUID(), days_in_stage: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setDeals((prev) => [newDeal, ...prev]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return newDeal;
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().from("deals").insert([newDeal]).select().single();
    return data ?? newDeal;
  }, []);

  const bulkAddDeals = useCallback(async (rows: Partial<Deal>[]) => {
    const newDeals = rows.map((r) => ({ ...r, id: crypto.randomUUID(), stage: (r.stage ?? "Av. Leads") as DealStage, value: r.value ?? 0, currency: r.currency ?? "INR", days_in_stage: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })) as Deal[];
    setDeals((prev) => [...newDeals, ...prev]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("deals").insert(newDeals);
  }, []);

  return { deals, loading, fetchDeals, updateDealStage, updateDeal, addDeal, bulkAddDeals, setDeals };
}
