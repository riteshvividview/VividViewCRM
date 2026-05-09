"use client";
import { useCallback, useEffect, useState } from "react";
import type { Document, Block } from "../types";
import { DOCUMENT_TEMPLATES } from "../types";

export const MOCK_DOCUMENTS: Document[] = [
  { id: "doc1", title: "Q2 Sales Strategy", icon: "BarChart2", blocks: [{ id: "b1", type: "h1", content: "Q2 Sales Strategy" }, { id: "b2", type: "paragraph", content: "Focus on enterprise deals above ₹5L." }], owner_id: "u1", workspace_id: null, is_template: false, template_type: null, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-05-07T12:00:00Z" },
  { id: "doc2", title: "TechFlow Meeting Notes", icon: "FileText", blocks: [{ id: "b1", type: "h1", content: "TechFlow Meeting Notes" }, { id: "b2", type: "paragraph", content: "Discussed enterprise license requirements." }, { id: "b3", type: "todo", content: "Send follow-up proposal", checked: false }], owner_id: "u1", workspace_id: null, is_template: false, template_type: null, created_at: "2026-05-06T14:00:00Z", updated_at: "2026-05-07T09:00:00Z" },
  { id: "doc3", title: "Onboarding — David Kim", icon: "ListChecks", blocks: DOCUMENT_TEMPLATES[3].blocks, owner_id: "u2", workspace_id: null, is_template: false, template_type: "onboarding", created_at: "2026-05-05T10:00:00Z", updated_at: "2026-05-05T16:00:00Z" },
];

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) { await new Promise((r) => setTimeout(r, 300)); setDocuments(MOCK_DOCUMENTS); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().from("documents").select("*").order("updated_at", { ascending: false });
      setDocuments(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const createDocument = useCallback(async (partial?: Partial<Document>): Promise<Document> => {
    const doc: Document = {
      id: crypto.randomUUID(),
      title: partial?.title ?? "Untitled",
      icon: partial?.icon ?? "File",
      blocks: partial?.blocks ?? [{ id: crypto.randomUUID(), type: "paragraph", content: "" }],
      owner_id: null,
      workspace_id: null,
      is_template: false,
      template_type: partial?.template_type ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDocuments((p) => [doc, ...p]);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return doc;
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().from("documents").insert([{ ...doc, blocks: undefined, content: { blocks: doc.blocks } }]).select().single();
    return data ?? doc;
  }, []);

  const saveDocument = useCallback(async (id: string, updates: Partial<Document>) => {
    setDocuments((p) => p.map((d) => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    const { blocks, ...rest } = updates;
    const payload: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (blocks) payload.content = { blocks };
    await createClient().from("documents").update(payload).eq("id", id);
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setDocuments((p) => p.filter((d) => d.id !== id));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().from("documents").delete().eq("id", id);
  }, []);

  return { documents, loading, fetchDocuments, createDocument, saveDocument, deleteDocument, setDocuments };
}
