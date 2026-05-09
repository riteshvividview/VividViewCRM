"use client";
import { useCallback, useEffect, useState } from "react";
import type { Contact, ContactActivity, ContactFile } from "../types";

export const MOCK_CONTACTS: Contact[] = [
  { id: "c1", full_name: "Sarah Chen", email: "sarah@techflow.com", phone: "+91 98765 43210", title: "CTO", company_id: "co1", company_name: "TechFlow Inc", avatar_url: null, status: "Active", tags: ["VIP", "Decision Maker"], owner: "u1", owner_name: "Alex Kumar", last_activity_at: "2026-05-07T14:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-01T10:00:00Z", updated_at: "2026-05-07T14:00:00Z" },
  { id: "c2", full_name: "Marcus Webb", email: "m.webb@nexus.io", phone: "+91 87654 32109", title: "VP Sales", company_id: "co2", company_name: "Nexus Digital", avatar_url: null, status: "Active", tags: ["Partner"], owner: "u2", owner_name: "Priya Singh", last_activity_at: "2026-05-06T11:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-05T10:00:00Z", updated_at: "2026-05-06T11:00:00Z" },
  { id: "c3", full_name: "Elena Vasquez", email: "elena@cloudbase.co", phone: "+91 76543 21098", title: "CEO", company_id: "co3", company_name: "CloudBase Labs", avatar_url: null, status: "Prospect", tags: ["Hot Lead"], owner: "u1", owner_name: "Alex Kumar", last_activity_at: "2026-05-05T09:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-10T10:00:00Z", updated_at: "2026-05-05T09:00:00Z" },
  { id: "c4", full_name: "James Okafor", email: "jokafor@meridian.com", phone: "+91 65432 10987", title: "Procurement Manager", company_id: "co4", company_name: "Meridian Corp", avatar_url: null, status: "Active", tags: ["Finance", "Decision Maker"], owner: "u3", owner_name: "Sam Tiwari", last_activity_at: "2026-05-04T15:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-12T10:00:00Z", updated_at: "2026-05-04T15:00:00Z" },
  { id: "c5", full_name: "Lily Nguyen", email: "lily@spark.com", phone: "+91 54321 09876", title: "Director of Analytics", company_id: "co5", company_name: "Spark Analytics", avatar_url: null, status: "Active", tags: ["Champion", "Technical"], owner: "u2", owner_name: "Priya Singh", last_activity_at: "2026-05-03T13:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-15T10:00:00Z", updated_at: "2026-05-03T13:00:00Z" },
  { id: "c6", full_name: "David Kim", email: "dkim@launchpad.io", phone: "+91 43210 98765", title: "Founder & CEO", company_id: "co6", company_name: "LaunchPad Co", avatar_url: null, status: "Active", tags: ["VIP", "Champion"], owner: "u1", owner_name: "Alex Kumar", last_activity_at: "2026-05-02T10:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-20T10:00:00Z", updated_at: "2026-05-02T10:00:00Z" },
  { id: "c7", full_name: "Aisha Patel", email: "aisha@globex.in", phone: "+91 32109 87654", title: "VP Engineering", company_id: "co1", company_name: "TechFlow Inc", avatar_url: null, status: "Inactive", tags: ["Technical"], owner: "u3", owner_name: "Sam Tiwari", last_activity_at: "2026-04-28T09:00:00Z", custom_fields: [], notes_content: null, workspace_id: null, created_at: "2026-04-22T10:00:00Z", updated_at: "2026-04-28T09:00:00Z" },
];

export const MOCK_ACTIVITIES: ContactActivity[] = [
  { id: "a1", contact_id: "c1", type: "call", content: "Discovery call — discussed Q2 requirements", created_by: "Alex Kumar", created_at: "2026-05-07T14:00:00Z" },
  { id: "a2", contact_id: "c1", type: "email", content: "Sent product overview deck", created_by: "Alex Kumar", created_at: "2026-05-06T10:00:00Z" },
  { id: "a3", contact_id: "c1", type: "meeting", content: "Quarterly business review at their office", created_by: "Priya Singh", created_at: "2026-05-04T14:00:00Z" },
  { id: "a4", contact_id: "c1", type: "note", content: "Interested in enterprise plan. Budget approved for Q3.", created_by: "Alex Kumar", created_at: "2026-05-03T09:00:00Z" },
  { id: "a5", contact_id: "c1", type: "deal", content: "Added to deal: Enterprise License – TechFlow", created_by: "System", created_at: "2026-05-01T10:00:00Z" },
];

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 400)); setContacts(MOCK_CONTACTS); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("contacts").select("*").order("created_at", { ascending: false });
      setContacts(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const addContact = useCallback(async (c: Omit<Contact, "id" | "created_at" | "updated_at">) => {
    const n: Contact = { ...c, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setContacts((p) => [n, ...p]);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return n;
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().from("contacts").insert([n]).select().single();
    return data ?? n;
  }, []);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    setContacts((p) => p.map((c) => c.id === id ? { ...c, ...updates } : c));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("contacts").update(updates).eq("id", id);
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    setContacts((p) => p.filter((c) => c.id !== id));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("contacts").delete().eq("id", id);
  }, []);

  return { contacts, loading, fetchContacts, addContact, updateContact, deleteContact, setContacts };
}
