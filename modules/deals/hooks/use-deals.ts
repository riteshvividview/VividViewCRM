"use client";

import { useCallback, useEffect, useState } from "react";
import type { Deal, DealStage } from "../types";
import { dealsApi } from "@/lib/api-client";

// ── Mock data ─────────────────────────────────────────────────────────────────
export const MOCK_DEALS: Deal[] = [
  { id: "d1", title: "Enterprise License – TechFlow", lead_id: "1", stage: "Av. Leads", value: 450000, currency: "INR", close_date: "2026-06-30", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Delhi", notes: null, company: "TechFlow Inc", contact_name: "Sarah Chen", won_lost_reason: null, days_in_stage: 3, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-01T10:00:00Z", workspace_id: null },
  { id: "d2", title: "API Integration Package", lead_id: "2", stage: "Samples Sent", value: 120000, currency: "INR", close_date: "2026-06-15", assigned_to: "u2", assigned_name: "Priya Singh", assigned_avatar: null, location: "Mumbai", notes: null, company: "Nexus Digital", contact_name: "Marcus Webb", won_lost_reason: null, days_in_stage: 7, created_at: "2026-05-02T09:00:00Z", updated_at: "2026-05-02T09:00:00Z", workspace_id: null },
  { id: "d3", title: "Annual Support Contract", lead_id: "3", stage: "Quotes", value: 670000, currency: "INR", close_date: "2026-07-01", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Bangalore", notes: null, company: "CloudBase Labs", contact_name: "Elena Vasquez", won_lost_reason: null, days_in_stage: 2, created_at: "2026-05-03T08:00:00Z", updated_at: "2026-05-03T08:00:00Z", workspace_id: null },
  { id: "d4", title: "Platform Expansion Deal", lead_id: "4", stage: "Negotiations", value: 1200000, currency: "INR", close_date: "2026-06-20", assigned_to: "u3", assigned_name: "Sam Tiwari", assigned_avatar: null, location: "Delhi", notes: null, company: "Meridian Corp", contact_name: "James Okafor", won_lost_reason: null, days_in_stage: 11, created_at: "2026-05-04T11:00:00Z", updated_at: "2026-05-04T11:00:00Z", workspace_id: null },
  { id: "d5", title: "Data Analytics Bundle", lead_id: "5", stage: "Sales", value: 890000, currency: "INR", close_date: "2026-05-30", assigned_to: "u2", assigned_name: "Priya Singh", assigned_avatar: null, location: "Mumbai", notes: null, company: "Spark Analytics", contact_name: "Lily Nguyen", won_lost_reason: null, days_in_stage: 1, created_at: "2026-05-05T14:00:00Z", updated_at: "2026-05-05T14:00:00Z", workspace_id: null },
  { id: "d6", title: "Startup Bundle Q2", lead_id: "6", stage: "Av. Leads", value: 150000, currency: "INR", close_date: "2026-07-15", assigned_to: "u1", assigned_name: "Alex Kumar", assigned_avatar: null, location: "Bangalore", notes: null, company: "LaunchPad Co", contact_name: "David Kim", won_lost_reason: null, days_in_stage: 5, created_at: "2026-05-06T16:00:00Z", updated_at: "2026-05-06T16:00:00Z", workspace_id: null },
  { id: "d7", title: "Custom Dev Project", lead_id: null, stage: "Quotes", value: 320000, currency: "INR", close_date: "2026-06-10", assigned_to: "u3", assigned_name: "Sam Tiwari", assigned_avatar: null, location: "Chennai", notes: null, company: "InnoTech Solutions", contact_name: "Rajan Mehta", won_lost_reason: null, days_in_stage: 4, created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T10:00:00Z", workspace_id: null },
];

// Prisma returns value as Decimal string — coerce to number for the frontend
function normalizeDeals(items: Deal[]): Deal[] {
  return items.map((d) => ({ ...d, value: Number(d.value) }));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dealsApi.list({ limit: "200" }) as { items: Deal[] };
      setDeals(normalizeDeals(result.items ?? []));
    } catch (e) {
      console.warn("[useDeals] NestJS API unavailable, falling back to mock data:", e);
      setDeals(MOCK_DEALS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const updateDealStage = useCallback(async (id: string, stage: DealStage) => {
    const snapshot = deals;
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, stage, days_in_stage: 0 } : d));
    try {
      await dealsApi.update(id, { stage });
    } catch (e) {
      console.error("[useDeals] updateDealStage failed, reverting:", e);
      setDeals(snapshot);
    }
  }, [deals]);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>) => {
    const snapshot = deals;
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
    try {
      await dealsApi.update(id, updates);
    } catch (e) {
      console.error("[useDeals] updateDeal failed, reverting:", e);
      setDeals(snapshot);
    }
  }, [deals]);

  const addDeal = useCallback(async (deal: Omit<Deal, "id" | "created_at" | "updated_at" | "days_in_stage">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Deal = {
      ...deal,
      id: tempId,
      days_in_stage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDeals((prev) => [optimistic, ...prev]);
    try {
      const created = await dealsApi.create(deal) as Deal;
      setDeals((prev) => prev.map((d) => d.id === tempId ? { ...created, value: Number(created.value) } : d));
      return created;
    } catch (e) {
      console.error("[useDeals] addDeal failed, removing optimistic row:", e);
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
      return optimistic;
    }
  }, []);

  const bulkAddDeals = useCallback(async (rows: Partial<Deal>[]) => {
    const newDeals = rows.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      stage: (r.stage ?? "Av. Leads") as DealStage,
      value: r.value ?? 0,
      currency: r.currency ?? "INR",
      days_in_stage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as Deal[];
    setDeals((prev) => [...newDeals, ...prev]);
    try {
      await Promise.all(newDeals.map((d) => dealsApi.create(d)));
      await fetchDeals();
    } catch {
      await fetchDeals();
    }
  }, [fetchDeals]);

  return { deals, loading, fetchDeals, updateDealStage, updateDeal, addDeal, bulkAddDeals, setDeals };
}
