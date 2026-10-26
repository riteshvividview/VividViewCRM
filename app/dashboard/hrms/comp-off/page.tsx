"use client";

import { ResourceManager, StatusPill, fmtDate, empName, type Row, type Me } from "@/components/hrms/resource-manager";

const STATUSES = [{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }];
const ownPending = (r: Row, me: Me) => r.status === "pending" && (me.isHR || r.employee_id === me.employeeId);

export default function CompOffPage() {
  return (
    <ResourceManager
      resource="comp-offs"
      title="Comp-off"
      subtitle="Worked on a weekend or holiday? Request a compensatory day off. Approved days are added to your Comp-off leave balance."
      singular="Comp-off request"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={ownPending}
      canDelete={ownPending}
      fields={[
        { name: "employee_id", label: "Employee", type: "employee", hrOnly: true },
        { name: "worked_date", label: "Date worked", type: "date", required: true },
        { name: "days", label: "Credit", type: "select", options: [{ value: "1", label: "Full day" }, { value: "0.5", label: "Half day" }], defaultValue: "1" },
        { name: "reason", label: "What did you work on?", type: "textarea" },
      ]}
      columns={[
        { key: "employee", label: "Employee", render: (r) => empName(r) },
        { key: "worked_date", label: "Worked on", render: (r) => fmtDate(r.worked_date) },
        { key: "days", label: "Credit", render: (r) => (Number(r.days) === 1 ? "1 day" : "½ day") },
        { key: "reason", label: "Reason", className: "hidden md:table-cell max-w-xs truncate" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
      actions={[
        { label: "Approve", variant: "default", patch: { status: "approved" }, show: (r, me) => me.isHR && r.status === "pending" },
        { label: "Reject", patch: { status: "rejected" }, show: (r, me) => me.isHR && r.status === "pending" },
      ]}
    />
  );
}
