"use client";

import { useCallback, useEffect, useState } from "react";
import type { Contact, ContactActivity, ContactFile } from "../types";
import { contactsApi } from "@/lib/api-client";

// ── Mock data ─────────────────────────────────────────────────────────────────
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

// ── Field mapping ─────────────────────────────────────────────────────────────
// DB schema:  full_name, email, phone, company (string), role, avatar_url, status, notes
// Frontend:   full_name, email, phone, company_name,     title, avatar_url, status, notes_content
// The NestJS API uses DB field names — we map on the way in and out.

type ApiContact = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;  // DB field name
  role?: string | null;     // DB field name (maps to frontend "title")
  avatar_url?: string | null;
  status?: string | null;
  notes?: string | null;    // DB field name (maps to frontend "notes_content")
  workspace_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

function apiToContact(c: ApiContact): Contact {
  return {
    id: c.id,
    full_name: c.full_name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    title: c.role ?? null,             // DB: role → frontend: title
    company_id: null,
    company_name: c.company ?? null,    // DB: company → frontend: company_name
    avatar_url: c.avatar_url ?? null,
    status: (c.status as Contact["status"]) ?? "Active",
    tags: [],
    owner: null,
    owner_name: null,
    last_activity_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
    custom_fields: [],
    notes_content: c.notes ?? null,    // DB: notes → frontend: notes_content
    workspace_id: c.workspace_id ?? null,
    created_at: c.created_at ?? new Date().toISOString(),
    updated_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
  };
}

function contactToApi(c: Partial<Contact>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (c.full_name !== undefined) payload["full_name"] = c.full_name;
  if (c.email !== undefined)     payload["email"]     = c.email;
  if (c.phone !== undefined)     payload["phone"]     = c.phone;
  if (c.title !== undefined)     payload["role"]      = c.title;        // frontend: title → DB: role
  if (c.company_name !== undefined) payload["company"] = c.company_name; // frontend: company_name → DB: company
  if (c.avatar_url !== undefined)   payload["avatar_url"] = c.avatar_url;
  if (c.status !== undefined)    payload["status"]    = c.status;
  if (c.notes_content !== undefined) payload["notes"] = c.notes_content; // frontend: notes_content → DB: notes
  return payload;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await contactsApi.list({ limit: "200" }) as { items: ApiContact[] };
      setContacts((result.items ?? []).map(apiToContact));
    } catch (e) {
      console.warn("[useContacts] NestJS API unavailable, falling back to mock data:", e);
      setContacts(MOCK_CONTACTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const addContact = useCallback(async (c: Omit<Contact, "id" | "created_at" | "updated_at">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Contact = {
      ...c,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setContacts((prev) => [optimistic, ...prev]);
    try {
      const created = await contactsApi.create(contactToApi(c)) as ApiContact;
      setContacts((prev) => prev.map((x) => x.id === tempId ? apiToContact(created) : x));
      return apiToContact(created);
    } catch (e) {
      console.error("[useContacts] addContact failed, removing optimistic row:", e);
      setContacts((prev) => prev.filter((x) => x.id !== tempId));
      return optimistic;
    }
  }, []);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    const snapshot = contacts;
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
    try {
      await contactsApi.update(id, contactToApi(updates));
    } catch (e) {
      console.error("[useContacts] updateContact failed, reverting:", e);
      setContacts(snapshot);
    }
  }, [contacts]);

  const deleteContact = useCallback(async (id: string) => {
    const snapshot = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await contactsApi.delete(id);
    } catch (e) {
      console.error("[useContacts] deleteContact failed, reverting:", e);
      setContacts(snapshot);
    }
  }, [contacts]);

  return { contacts, loading, fetchContacts, addContact, updateContact, deleteContact, setContacts };
}
