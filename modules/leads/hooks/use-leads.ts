"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, LeadStatus } from "../types";
import { calcScore } from "../types";

// Rich mock data for dev mode
export const MOCK_LEADS: Lead[] = [
  { id: "1", name: "Sarah Chen", email: "sarah@techflow.com", phone: "+91 98765 43210", company: "TechFlow Inc", company_id: null, source: "Referral", status: "Qualified", score: 85, assigned_to: "u1", assigned_name: "Alex Kumar", custom_fields: null, notes: null, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-01T10:00:00Z", workspace_id: null },
  { id: "2", name: "Marcus Webb", email: "m.webb@nexus.io", phone: "+91 87654 32109", company: "Nexus Digital", company_id: null, source: "Website", status: "Contacted", score: 60, assigned_to: "u2", assigned_name: "Priya Singh", custom_fields: null, notes: null, created_at: "2026-05-02T09:00:00Z", updated_at: "2026-05-02T09:00:00Z", workspace_id: null },
  { id: "3", name: "Elena Vasquez", email: "elena@cloudbase.co", phone: null, company: "CloudBase Labs", company_id: null, source: "Cold Call", status: "New", score: 30, assigned_to: "u1", assigned_name: "Alex Kumar", custom_fields: null, notes: null, created_at: "2026-05-03T08:00:00Z", updated_at: "2026-05-03T08:00:00Z", workspace_id: null },
  { id: "4", name: "James Okafor", email: "jokafor@meridian.com", phone: "+91 76543 21098", company: "Meridian Corp", company_id: null, source: "Event", status: "Proposal", score: 72, assigned_to: "u3", assigned_name: "Sam Tiwari", custom_fields: null, notes: null, created_at: "2026-05-04T11:00:00Z", updated_at: "2026-05-04T11:00:00Z", workspace_id: null },
  { id: "5", name: "Lily Nguyen", email: "lily@spark.com", phone: "+91 65432 10987", company: "Spark Analytics", company_id: null, source: "Social Media", status: "Proposal", score: 78, assigned_to: "u2", assigned_name: "Priya Singh", custom_fields: null, notes: null, created_at: "2026-05-05T14:00:00Z", updated_at: "2026-05-05T14:00:00Z", workspace_id: null },
  { id: "6", name: "David Kim", email: "dkim@launchpad.io", phone: "+91 54321 09876", company: "LaunchPad Co", company_id: null, source: "Partner", status: "Won", score: 95, assigned_to: "u1", assigned_name: "Alex Kumar", custom_fields: null, notes: null, created_at: "2026-05-06T16:00:00Z", updated_at: "2026-05-06T16:00:00Z", workspace_id: null },
  { id: "7", name: "Aisha Patel", email: "aisha@globex.in", phone: "+91 43210 98765", company: "Globex India", company_id: null, source: "Email Campaign", status: "Lost", score: 20, assigned_to: "u3", assigned_name: "Sam Tiwari", custom_fields: null, notes: null, created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T10:00:00Z", workspace_id: null },
  { id: "8", name: "Rajan Mehta", email: "rajan@innotech.com", phone: "+91 32109 87654", company: "InnoTech Solutions", company_id: null, source: "Referral", status: "New", score: 45, assigned_to: "u2", assigned_name: "Priya Singh", custom_fields: null, notes: null, created_at: "2026-05-07T12:00:00Z", updated_at: "2026-05-07T12:00:00Z", workspace_id: null },
];

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const supabaseUrl = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL : null;
      if (!supabaseUrl) {
        await new Promise((r) => setTimeout(r, 400));
        setLeads(MOCK_LEADS);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setLeads(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setLeads(MOCK_LEADS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status, score: calcScore({ ...l, status }) } : l));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("leads").update({ status }).eq("id", id);
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("leads").update(updates).eq("id", id);
  }, []);

  const addLead = useCallback(async (lead: Omit<Lead, "id" | "created_at" | "updated_at">) => {
    const newLead: Lead = {
      ...lead,
      id: crypto.randomUUID(),
      score: calcScore(lead),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLeads((prev) => [newLead, ...prev]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return newLead;
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().from("leads").insert([newLead]).select().single();
    return data ?? newLead;
  }, []);

  const bulkAddLeads = useCallback(async (rows: Partial<Lead>[]) => {
    const newLeads = rows.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      status: (r.status ?? "New") as LeadStatus,
      score: calcScore(r),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as Lead[];
    setLeads((prev) => [...newLeads, ...prev]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("leads").insert(newLeads);
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("leads").delete().eq("id", id);
  }, []);

  return { leads, loading, error, fetchLeads, updateLeadStatus, updateLead, addLead, bulkAddLeads, deleteLead, setLeads };
}
