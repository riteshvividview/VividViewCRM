"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { ResourceManager, StatusPill, fmtDate } from "@/components/hrms/resource-manager";
import { Button } from "@/components/ui/button";

const STATUSES = [
  { value: "draft", label: "Draft" }, { value: "open", label: "Open" },
  { value: "on_hold", label: "On hold" }, { value: "closed", label: "Closed" },
];
const TYPES = ["full_time", "part_time", "contract", "intern"].map((v) => ({ value: v, label: v.replace("_", " ") }));

export default function RecruitmentPage() {
  return (
    <ResourceManager
      resource="jobs"
      title="Job Openings"
      subtitle="Open positions and hiring pipeline"
      singular="Job"
      canCreate={(me) => me.isHR}
      tabs={{ field: "status", options: STATUSES }}
      headerExtra={
        <Link href="/dashboard/hrms/recruitment/candidates">
          <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-1.5" />Candidate pipeline</Button>
        </Link>
      }
      fields={[
        { name: "title", label: "Job title", type: "text", required: true },
        { name: "department_id", label: "Department", type: "department" },
        { name: "location", label: "Location", type: "text" },
        { name: "employment_type", label: "Employment type", type: "select", options: TYPES, defaultValue: "full_time" },
        { name: "openings", label: "Openings", type: "number", defaultValue: 1 },
        { name: "description", label: "Job description", type: "textarea" },
        { name: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "open" },
      ]}
      columns={[
        { key: "title", label: "Position", className: "font-medium" },
        { key: "department", label: "Department", render: (r) => r.department?.name ?? "—" },
        { key: "location", label: "Location", className: "hidden md:table-cell" },
        { key: "employment_type", label: "Type", render: (r) => <span className="capitalize">{r.employment_type?.replace("_", " ")}</span>, className: "hidden md:table-cell" },
        { key: "openings", label: "Openings" },
        { key: "created_at", label: "Posted", render: (r) => fmtDate(r.created_at), className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
