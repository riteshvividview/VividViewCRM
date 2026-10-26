"use client";

import { Star, Mail, Phone } from "lucide-react";
import { ResourceManager, fmtINR, type Row } from "@/components/hrms/resource-manager";
import { cn } from "@/lib/utils";

const STAGES = [
  { value: "applied", label: "Applied" }, { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" }, { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" }, { value: "rejected", label: "Rejected" },
];
const SOURCES = ["direct", "referral", "linkedin", "naukri", "indeed", "agency", "careers_page"].map((v) => ({ value: v, label: v.replace("_", " ") }));

export default function CandidatesPage() {
  return (
    <ResourceManager
      resource="candidates"
      title="Candidate Pipeline"
      subtitle="Move candidates through the hiring stages"
      singular="Candidate"
      canCreate={(me) => me.isHR}
      fields={[
        { name: "full_name", label: "Full name", type: "text", required: true },
        { name: "job_id", label: "Job", type: "job" },
        { name: "email", label: "Email", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "source", label: "Source", type: "select", options: SOURCES, defaultValue: "direct" },
        { name: "resume_url", label: "Resume link", type: "text" },
        { name: "stage", label: "Stage", type: "select", options: STAGES, defaultValue: "applied" },
        { name: "rating", label: "Rating (1-5)", type: "number" },
        { name: "interview_at", label: "Interview at", type: "datetime" },
        { name: "expected_ctc", label: "Expected CTC (₹)", type: "number" },
        { name: "offered_ctc", label: "Offered CTC (₹)", type: "number" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      columns={[]}
      renderBody={(rows, { edit, patch }) => (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STAGES.map((stage) => {
            const list = rows.filter((r) => r.stage === stage.value);
            return (
              <div
                key={stage.value}
                className="w-64 shrink-0 rounded-xl bg-muted/40 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  const row = rows.find((r) => r.id === id);
                  if (row && row.stage !== stage.value) patch(row, { stage: stage.value });
                }}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {list.map((r: Row) => (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                      onClick={() => edit(r)}
                      className={cn("rounded-lg border bg-card p-3 cursor-pointer hover:shadow-sm", stage.value === "rejected" && "opacity-70")}
                    >
                      <p className="font-medium text-sm">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.job?.title ?? "No job"}</p>
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {r.email && <p className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{r.email}</p>}
                        {r.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</p>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="flex">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={cn("h-3 w-3", n <= (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                          ))}
                        </span>
                        {r.expected_ctc && <span>{fmtINR(r.expected_ctc)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    />
  );
}
