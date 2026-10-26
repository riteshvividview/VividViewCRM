"use client";

import { Star } from "lucide-react";
import { ResourceManager, StatusPill, fmtDate, empName, type Row, type Me } from "@/components/hrms/resource-manager";

const TYPES = [{ value: "self", label: "Self" }, { value: "manager", label: "Manager" }, { value: "peer", label: "Peer" }];
const RATINGS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${["Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Outstanding"][n - 1]}` }));
const CYCLE_STATUSES = [{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }];

// The person writing the review: the reviewer, or the employee themselves for a self review.
const isWriter = (r: Row, me: Me) =>
  r.status === "pending" && (r.reviewer_employee_id === me.employeeId || (r.review_type === "self" && r.employee_id === me.employeeId));

export default function ReviewsPage() {
  return (
    <div className="space-y-10">
      <ResourceManager
        resource="reviews"
        title="Performance Reviews"
        subtitle="Self, manager and peer (360°) reviews per review cycle"
        singular="Review"
        canCreate={(me) => me.isHR}
        canEdit={(r, me) => me.isHR || isWriter(r, me)}
        tabs={{ field: "status", options: [{ value: "pending", label: "Pending" }, { value: "submitted", label: "Submitted" }] }}
        fields={[
          { name: "cycle_id", label: "Review cycle", type: "cycle", hrOnly: true },
          { name: "employee_id", label: "Employee being reviewed", type: "employee", hrOnly: true, required: true },
          { name: "reviewer_employee_id", label: "Reviewer", type: "employee", hrOnly: true },
          { name: "review_type", label: "Type", type: "select", options: TYPES, hrOnly: true, defaultValue: "manager" },
          { name: "rating", label: "Overall rating", type: "select", options: RATINGS },
          { name: "strengths", label: "Strengths", type: "textarea" },
          { name: "improvements", label: "Areas to improve", type: "textarea" },
          { name: "comments", label: "Comments", type: "textarea" },
          { name: "status", label: "Status", type: "select", options: [{ value: "pending", label: "Draft (pending)" }, { value: "submitted", label: "Submit" }], defaultValue: "pending" },
        ]}
        columns={[
          { key: "employee", label: "Employee", render: (r) => empName(r) },
          { key: "reviewer", label: "Reviewer", render: (r) => (r.review_type === "self" ? "Self" : r.reviewer?.profiles?.full_name ?? "—") },
          { key: "cycle", label: "Cycle", render: (r) => r.cycle?.name ?? "—", className: "hidden md:table-cell" },
          { key: "review_type", label: "Type", render: (r) => <span className="capitalize">{r.review_type}</span> },
          {
            key: "rating", label: "Rating", render: (r) => r.rating ? (
              <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{r.rating}</span>
            ) : "—",
          },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
        ]}
      />

      <ResourceManager
        resource="review-cycles"
        title="Review Cycles"
        subtitle="Quarterly, half-yearly or annual appraisal windows"
        singular="Cycle"
        canCreate={(me) => me.isHR}
        fields={[
          { name: "name", label: "Name", type: "text", required: true, placeholder: "H2 2026 Appraisal" },
          { name: "start_date", label: "Start", type: "date" },
          { name: "end_date", label: "End", type: "date" },
          { name: "status", label: "Status", type: "select", options: CYCLE_STATUSES, defaultValue: "draft" },
        ]}
        columns={[
          { key: "name", label: "Cycle", className: "font-medium" },
          { key: "start_date", label: "Start", render: (r) => fmtDate(r.start_date) },
          { key: "end_date", label: "End", render: (r) => fmtDate(r.end_date) },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
        ]}
      />
    </div>
  );
}
