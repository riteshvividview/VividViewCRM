"use client";
import { useCallback, useEffect, useState } from "react";
import type { Campaign, CampaignStats } from "../types";

const mkStats = (sent: number, openR: number, clickR: number): CampaignStats => ({
  sent, delivered: Math.round(sent * 0.97),
  opened: Math.round(sent * openR), clicked: Math.round(sent * clickR),
  bounced: Math.round(sent * 0.02), unsubscribed: Math.round(sent * 0.003),
});

export const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "c1", name: "Q2 Product Launch Announcement", status: "sent", template_id: "t1", audience_config: { source: "contacts", count: 342 }, subject: "Introducing our biggest release yet", preview_text: "Everything you asked for, delivered.", schedule_time: "2026-04-15T09:00:00Z", drip_sequence: [], stats: mkStats(342, 0.41, 0.18), created_at: "2026-04-10T10:00:00Z", updated_at: "2026-04-15T10:00:00Z" },
  { id: "c2", name: "Enterprise Outreach — May", status: "sent", template_id: "t2", audience_config: { source: "leads", count: 128 }, subject: "{{first_name}}, let's talk enterprise", preview_text: "A quick note from our team.", schedule_time: "2026-05-01T10:00:00Z", drip_sequence: [], stats: mkStats(128, 0.35, 0.12), created_at: "2026-04-28T10:00:00Z", updated_at: "2026-05-01T11:00:00Z" },
  { id: "c3", name: "Re-engagement: Inactive Contacts", status: "scheduled", template_id: "t3", audience_config: { source: "contacts", count: 89 }, subject: "We miss you, {{first_name}}", preview_text: "It's been a while — here's what's new.", schedule_time: "2026-05-12T08:00:00Z", drip_sequence: [], stats: mkStats(0, 0, 0), created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T10:00:00Z" },
  { id: "c4", name: "Welcome Drip Sequence", status: "sending", template_id: "t1", audience_config: { source: "leads", count: 17 }, subject: "Welcome to Vivid View, {{first_name}}!", preview_text: "Your CRM journey starts here.", schedule_time: null, drip_sequence: [{ day: 0, subject: "Welcome!", preview_text: "Get started" }, { day: 3, subject: "Quick tip", preview_text: "Did you know?" }, { day: 7, subject: "Check-in", preview_text: "How's it going?" }], stats: mkStats(17, 0.62, 0.24), created_at: "2026-05-05T10:00:00Z", updated_at: "2026-05-07T14:00:00Z" },
  { id: "c5", name: "Feature Update Newsletter", status: "draft", template_id: null, audience_config: null, subject: "", preview_text: "", schedule_time: null, drip_sequence: [], stats: mkStats(0, 0, 0), created_at: "2026-05-07T16:00:00Z", updated_at: "2026-05-07T16:00:00Z" },
  { id: "c6", name: "Trade Show Follow-up", status: "paused", template_id: "t2", audience_config: { source: "csv", count: 56, csv_recipients: [] }, subject: "Great meeting you at TechSummit!", preview_text: "Let's continue the conversation.", schedule_time: null, drip_sequence: [], stats: mkStats(23, 0.28, 0.09), created_at: "2026-04-20T10:00:00Z", updated_at: "2026-05-03T10:00:00Z" },
];

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 350)); setCampaigns(MOCK_CAMPAIGNS); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("campaigns").select("*").order("created_at", { ascending: false });
      setCampaigns(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const addCampaign = useCallback(async (partial: Partial<Campaign>): Promise<Campaign> => {
    const n: Campaign = {
      id: crypto.randomUUID(),
      name: partial.name ?? "Untitled Campaign",
      status: "draft",
      template_id: null,
      audience_config: null,
      subject: "",
      preview_text: "",
      schedule_time: null,
      drip_sequence: [],
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...partial,
    };
    setCampaigns((p) => [n, ...p]);
    return n;
  }, []);

  const updateCampaign = useCallback(async (id: string, updates: Partial<Campaign>) => {
    setCampaigns((p) => p.map((c) => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns((p) => p.filter((c) => c.id !== id));
  }, []);

  return { campaigns, loading, fetchCampaigns, addCampaign, updateCampaign, deleteCampaign };
}
