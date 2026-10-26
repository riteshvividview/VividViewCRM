"use client";

import { ResourceManager, StatusPill, fmtDate, empName } from "@/components/hrms/resource-manager";

const CATEGORIES = [
  { value: "hr", label: "HR" }, { value: "payroll", label: "Payroll" }, { value: "it", label: "IT" },
  { value: "admin", label: "Admin" }, { value: "facilities", label: "Facilities" }, { value: "other", label: "Other" },
];
const PRIORITIES = ["low", "medium", "high", "urgent"].map((v) => ({ value: v, label: v }));
const STATUSES = [
  { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" },
];

export default function HelpdeskPage() {
  return (
    <ResourceManager
      resource="tickets"
      title="Helpdesk"
      subtitle="Raise HR, payroll and IT requests and track their resolution"
      singular="Ticket"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={(r, me) => me.isHR || (r.status === "open" && r.employee_id === me.employeeId)}
      fields={[
        { name: "employee_id", label: "Raised by", type: "employee", hrOnly: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "hr" },
        { name: "subject", label: "Subject", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "priority", label: "Priority", type: "select", options: PRIORITIES, defaultValue: "medium" },
        { name: "status", label: "Status", type: "select", options: STATUSES, hrOnly: true },
        { name: "resolution", label: "Resolution", type: "textarea", hrOnly: true },
      ]}
      columns={[
        { key: "subject", label: "Subject", render: (r) => <div><p className="font-medium">{r.subject}</p>{r.resolution && <p className="text-xs text-muted-foreground truncate max-w-xs">↳ {r.resolution}</p>}</div> },
        { key: "employee", label: "Raised by", render: (r) => empName(r) },
        { key: "category", label: "Category", render: (r) => <span className="uppercase text-xs">{r.category}</span>, className: "hidden md:table-cell" },
        { key: "priority", label: "Priority", render: (r) => <StatusPill value={r.priority} /> },
        { key: "created_at", label: "Raised", render: (r) => fmtDate(r.created_at), className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
      actions={[
        { label: "Start", patch: { status: "in_progress" }, show: (r, me) => me.isHR && r.status === "open" },
        {
          label: "Resolve", variant: "default", show: (r, me) => me.isHR && ["open", "in_progress"].includes(r.status),
          patch: () => { const res = window.prompt("Resolution note?"); return res === null ? null : { status: "resolved", resolution: res }; },
        },
      ]}
    />
  );
}
