"use client";

import { ResourceManager, StatusPill, fmtDate, fmtINR, empName } from "@/components/hrms/resource-manager";

const TYPES = [
  { value: "resignation", label: "Resignation" }, { value: "termination", label: "Termination" },
  { value: "retirement", label: "Retirement" }, { value: "contract_end", label: "Contract end" },
];
const STATUSES = [
  { value: "requested", label: "Requested" }, { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" }, { value: "withdrawn", label: "Withdrawn" },
];

export default function ExitsPage() {
  return (
    <ResourceManager
      resource="exits"
      title="Exits & Full-and-Final"
      subtitle="Resignations, notice period tracking and F&F settlement"
      singular="Exit request"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={(r, me) => me.isHR || (r.status === "requested" && r.employee_id === me.employeeId)}
      fields={[
        { name: "employee_id", label: "Employee", type: "employee", hrOnly: true },
        { name: "exit_type", label: "Exit type", type: "select", options: TYPES, defaultValue: "resignation" },
        { name: "resignation_date", label: "Resignation date", type: "date", hrOnly: true },
        { name: "last_working_day", label: "Last working day", type: "date" },
        { name: "reason", label: "Reason", type: "textarea" },
        { name: "status", label: "Status", type: "select", options: STATUSES, hrOnly: true },
        { name: "fnf_amount", label: "F&F amount (₹)", type: "number", hrOnly: true },
        { name: "fnf_status", label: "F&F status", type: "select", options: [{ value: "pending", label: "Pending" }, { value: "settled", label: "Settled" }], hrOnly: true },
        { name: "exit_interview_notes", label: "Exit interview notes", type: "textarea", hrOnly: true },
      ]}
      columns={[
        { key: "employee", label: "Employee", render: (r) => empName(r) },
        { key: "exit_type", label: "Type", render: (r) => <span className="capitalize">{r.exit_type?.replace("_", " ")}</span> },
        { key: "resignation_date", label: "Resigned", render: (r) => fmtDate(r.resignation_date), className: "hidden md:table-cell" },
        { key: "last_working_day", label: "Last day", render: (r) => fmtDate(r.last_working_day) },
        { key: "fnf_amount", label: "F&F", render: (r) => <span>{fmtINR(r.fnf_amount)} <StatusPill value={r.fnf_status} /></span>, className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
      actions={[
        { label: "Approve", variant: "default", patch: { status: "approved" }, show: (r, me) => me.isHR && r.status === "requested" },
        { label: "Withdraw", patch: { status: "withdrawn" }, show: (r, me) => r.status === "requested" && r.employee_id === me.employeeId, confirm: "Withdraw your resignation?" },
        { label: "Complete", patch: { status: "completed" }, show: (r, me) => me.isHR && r.status === "approved" },
      ]}
    />
  );
}
