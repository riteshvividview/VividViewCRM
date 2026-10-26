"use client";

import { Pin, Pencil } from "lucide-react";
import { ResourceManager, fmtDate } from "@/components/hrms/resource-manager";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["general", "policy", "event", "celebration", "urgent"].map((v) => ({ value: v, label: v }));

export default function AnnouncementsPage() {
  return (
    <ResourceManager
      resource="announcements"
      title="Announcements"
      subtitle="Company-wide news, policy updates and celebrations"
      singular="Announcement"
      canCreate={(me) => me.isHR}
      tabs={{ field: "category", options: CATEGORIES }}
      fields={[
        { name: "title", label: "Title", type: "text", required: true },
        { name: "body", label: "Message", type: "textarea", required: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "general" },
        { name: "pinned", label: "Pin to top", type: "checkbox" },
        { name: "expires_on", label: "Show until", type: "date" },
      ]}
      columns={[]}
      renderBody={(rows, { me, edit }) => {
        const today = new Date().toISOString().slice(0, 10);
        const list = rows
          .filter((r) => me.isHR || !r.expires_on || r.expires_on >= today)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned));
        if (list.length === 0) return <p className="text-center py-12 text-muted-foreground">No announcements yet.</p>;
        return (
          <div className="grid gap-3">
            {list.map((r) => (
              <article key={r.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {r.pinned && <Pin className="h-3.5 w-3.5 text-purple-600" />}
                      <h3 className="font-semibold">{r.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{r.category} · {fmtDate(r.created_at)}</p>
                  </div>
                  {me.isHR && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => edit(r)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-3 whitespace-pre-wrap">{r.body}</p>
              </article>
            ))}
          </div>
        );
      }}
    />
  );
}
