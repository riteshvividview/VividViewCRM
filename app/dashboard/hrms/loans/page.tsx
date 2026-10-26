"use client";

import { ResourceManager, StatusPill, fmtINR, fmtDate, empName, type Row, type Me } from "@/components/hrms/resource-manager";

const TYPES = [{ value: "loan", label: "Loan" }, { value: "salary_advance", label: "Salary advance" }];
const STATUSES = [
  { value: "pending", label: "Pending" }, { value: "active", label: "Active" },
  { value: "closed", label: "Closed" }, { value: "rejected", label: "Rejected" },
];
const ownPending = (r: Row, me: Me) => r.status === "pending" && (me.isHR || r.employee_id === me.employeeId);

export default function LoansPage() {
  return (
    <ResourceManager
      resource="loans"
      title="Loans & Advances"
      subtitle="Active loans are recovered as an EMI deduction in payroll"
      singular="Loan request"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={(r, me) => me.isHR || ownPending(r, me)}
      canDelete={ownPending}
      fields={[
        { name: "employee_id", label: "Employee", type: "employee", hrOnly: true },
        { name: "loan_type", label: "Type", type: "select", options: TYPES, defaultValue: "loan" },
        { name: "amount", label: "Amount (₹)", type: "number", required: true },
        { name: "emi_amount", label: "Monthly EMI (₹)", type: "number", hrOnly: true },
        { name: "outstanding", label: "Outstanding (₹)", type: "number", hrOnly: true },
        { name: "reason", label: "Reason", type: "textarea" },
      ]}
      columns={[
        { key: "employee", label: "Employee", render: (r) => empName(r) },
        { key: "loan_type", label: "Type", render: (r) => <span className="capitalize">{r.loan_type?.replace("_", " ")}</span> },
        { key: "amount", label: "Amount", render: (r) => fmtINR(r.amount) },
        { key: "emi_amount", label: "EMI", render: (r) => fmtINR(r.emi_amount), className: "hidden md:table-cell" },
        { key: "outstanding", label: "Outstanding", render: (r) => <span className="font-medium">{fmtINR(r.outstanding)}</span> },
        { key: "created_at", label: "Requested", render: (r) => fmtDate(r.created_at), className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
      actions={[
        {
          label: "Approve", variant: "default", show: (r, me) => me.isHR && r.status === "pending",
          patch: (r) => {
            const emi = window.prompt("Monthly EMI to recover (₹)?", String(Math.ceil(Number(r.amount) / 12)));
            return emi === null ? null : { status: "active", emi_amount: Number(emi) || 0, outstanding: r.amount };
          },
        },
        { label: "Reject", patch: { status: "rejected" }, show: (r, me) => me.isHR && r.status === "pending" },
        { label: "Close", patch: { status: "closed", outstanding: 0 }, show: (r, me) => me.isHR && r.status === "active", confirm: "Mark this loan as fully repaid?" },
      ]}
    />
  );
}
