"use client";
import { useState } from "react";
import type { EmailTemplate, EmailBlock } from "../types";

const mkBlock = (type: EmailBlock["type"], content: string, extra?: Partial<EmailBlock>): EmailBlock => ({
  id: crypto.randomUUID(), type, content, align: "center", ...extra,
});

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "t1",
    name: "Product Announcement",
    created_at: "2026-04-01T10:00:00Z",
    html_override: null,
    blocks: [
      mkBlock("header", "Vivid View CRM", { bgColor: "#7C3AED", textColor: "#ffffff" }),
      mkBlock("image", "", { url: "", alt: "Product hero image" }),
      mkBlock("text", "# Introducing something new\n\nHi {{first_name}},\n\nWe're excited to share our latest update with you. Here's what's new in Vivid View CRM.", { align: "left" }),
      mkBlock("button", "See What's New", { url: "https://vividview.com", bgColor: "#7C3AED", textColor: "#ffffff" }),
      mkBlock("divider", ""),
      mkBlock("footer", " 2026 Vivid View CRM · [Unsubscribe]({{unsubscribe}})", { textColor: "#94a3b8" }),
    ],
  },
  {
    id: "t2",
    name: "Cold Outreach",
    created_at: "2026-04-05T10:00:00Z",
    html_override: null,
    blocks: [
      mkBlock("header", "Vivid View", { bgColor: "#1e293b", textColor: "#ffffff" }),
      mkBlock("text", "Hi {{first_name}},\n\nI noticed {{company}} has been growing rapidly — congratulations!\n\nI wanted to reach out because we help companies like yours streamline their sales process.", { align: "left" }),
      mkBlock("button", "Book a 15-min Call", { url: "https://cal.com", bgColor: "#7C3AED", textColor: "#ffffff" }),
      mkBlock("text", "Best regards,\nThe Vivid View Team", { align: "left" }),
      mkBlock("footer", "Sent via Vivid View CRM · [Unsubscribe]({{unsubscribe}})", { textColor: "#94a3b8" }),
    ],
  },
  {
    id: "t3",
    name: "Re-engagement",
    created_at: "2026-04-10T10:00:00Z",
    html_override: null,
    blocks: [
      mkBlock("header", "We miss you", { bgColor: "#f59e0b", textColor: "#ffffff" }),
      mkBlock("spacer", ""),
      mkBlock("text", "Hi {{first_name}},\n\nIt's been a while since we last connected. A lot has changed at Vivid View — here's a quick update.", { align: "left" }),
      mkBlock("image", "", { alt: "New features" }),
      mkBlock("button", "See What's New", { url: "https://vividview.com", bgColor: "#f59e0b", textColor: "#ffffff" }),
      mkBlock("footer", " 2026 Vivid View · [Unsubscribe]({{unsubscribe}})", { textColor: "#94a3b8" }),
    ],
  },
];

export function useTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);

  const saveTemplate = (t: EmailTemplate) => {
    setTemplates((p) => {
      const idx = p.findIndex((x) => x.id === t.id);
      if (idx >= 0) { const n = [...p]; n[idx] = t; return n; }
      return [t, ...p];
    });
  };

  const deleteTemplate = (id: string) => setTemplates((p) => p.filter((t) => t.id !== id));

  const duplicateTemplate = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    const copy: EmailTemplate = { ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, created_at: new Date().toISOString() };
    setTemplates((p) => [copy, ...p]);
  };

  return { templates, saveTemplate, deleteTemplate, duplicateTemplate };
}
