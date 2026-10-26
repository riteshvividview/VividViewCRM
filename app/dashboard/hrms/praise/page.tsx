"use client";

import { Award, MessageSquare, Users } from "lucide-react";
import { ResourceManager, fmtDate, empName } from "@/components/hrms/resource-manager";

const KINDS = [
  { value: "praise", label: "Praise" }, { value: "feedback", label: "Feedback" }, { value: "one_on_one", label: "1:1 notes" },
];
const BADGES = ["Team Player", "Problem Solver", "Above & Beyond", "Customer Champion", "Leadership", "Innovation"].map((b) => ({ value: b, label: b }));
const ICONS = { praise: Award, feedback: MessageSquare, one_on_one: Users } as const;

export default function PraisePage() {
  return (
    <ResourceManager
      resource="feedback"
      title="Praise & Feedback"
      subtitle="Recognise colleagues, share continuous feedback and record 1:1s"
      singular="Post"
      tabs={{ field: "kind", options: KINDS }}
      canEdit={(r, me) => r.employee_id === me.employeeId}
      canDelete={(r, me) => me.isHR || r.employee_id === me.employeeId}
      fields={[
        { name: "to_employee_id", label: "To", type: "employee", required: true },
        { name: "kind", label: "Type", type: "select", options: KINDS, defaultValue: "praise" },
        { name: "badge", label: "Badge", type: "select", options: BADGES },
        { name: "message", label: "Message", type: "textarea", required: true },
      ]}
      columns={[]}
      renderBody={(rows) => rows.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Nothing here yet — be the first to recognise someone.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const Icon = ICONS[r.kind as keyof typeof ICONS] ?? Award;
            return (
              <article key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">{empName(r)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{empName(r, "recipient")}</span>
                </div>
                {r.badge && <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">🏅 {r.badge}</span>}
                <p className="text-sm mt-2 whitespace-pre-wrap">{r.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{fmtDate(r.created_at)}</p>
              </article>
            );
          })}
        </div>
      )}
    />
  );
}
