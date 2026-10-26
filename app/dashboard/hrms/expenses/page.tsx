"use client";

import { ResourceManager, StatusPill, fmtDate, fmtINR, empName, type Row, type Me } from "@/components/hrms/resource-manager";

const CATEGORIES = ["travel", "food", "accommodation", "fuel", "internet", "medical", "office_supplies", "other"].map((v) => ({ value: v, label: v.replace("_", " ") }));
const STATUSES = [
  { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" }, { value: "rejected", label: "Rejected" },
];
const ownPending = (r: Row, me: Me) => r.status === "pending" && (me.isHR || r.employee_id === me.employeeId);

export default function ExpensesPage() {
  return (
    <ResourceManager
      resource="expenses"
      title="Expenses & Reimbursements"
      subtitle="Submit claims; approved claims are paid out with the next payroll run"
      singular="Claim"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={ownPending}
      canDelete={ownPending}
      fields={[
        { name: "employee_id", label: "Employee", type: "employee", hrOnly: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "travel" },
        { name: "amount", label: "Amount (₹)", type: "number", required: true },
        { name: "expense_date", label: "Expense date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
        { name: "description", label: "Description", type: "textarea" },
        { name: "receipt_url", label: "Receipt link", type: "text", placeholder: "https://…" },
      ]}
      columns={[
        { key: "employee", label: "Employee", render: (r) => empName(r) },
        { key: "category", label: "Category", render: (r) => <span className="capitalize">{r.category?.replace("_", " ")}</span> },
        { key: "expense_date", label: "Date", render: (r) => fmtDate(r.expense_date) },
        { key: "description", label: "Description", className: "hidden lg:table-cell max-w-xs truncate" },
        { key: "amount", label: "Amount", render: (r) => <span className="font-medium">{fmtINR(r.amount)}</span> },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
      actions={[
        { label: "Approve", patch: { status: "approved" }, show: (r, me) => me.isHR && r.status === "pending", variant: "default" },
        {
          label: "Reject", show: (r, me) => me.isHR && r.status === "pending",
          patch: () => { const reason = window.prompt("Reason for rejection?"); return reason === null ? null : { status: "rejected", rejection_reason: reason }; },
        },
        { label: "Mark paid", patch: { status: "paid" }, show: (r, me) => me.isHR && r.status === "approved" },
      ]}
    />
  );
}
