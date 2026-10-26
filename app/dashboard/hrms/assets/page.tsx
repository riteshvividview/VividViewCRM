"use client";

import { ResourceManager, StatusPill, fmtDate, fmtINR, empName } from "@/components/hrms/resource-manager";

const CATEGORIES = ["laptop", "desktop", "monitor", "phone", "id_card", "furniture", "other"].map((v) => ({ value: v, label: v.replace("_", " ") }));
const STATUSES = [
  { value: "available", label: "Available" }, { value: "assigned", label: "Assigned" },
  { value: "repair", label: "In repair" }, { value: "retired", label: "Retired" },
];

export default function AssetsPage() {
  return (
    <ResourceManager
      resource="assets"
      title="Assets"
      subtitle="Company assets and who they are assigned to"
      singular="Asset"
      canCreate={(me) => me.isHR}
      tabs={{ field: "status", options: STATUSES }}
      fields={[
        { name: "name", label: "Asset name", type: "text", required: true, placeholder: "MacBook Pro 14" },
        { name: "asset_tag", label: "Asset tag", type: "text" },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "laptop" },
        { name: "serial_number", label: "Serial number", type: "text" },
        { name: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "available" },
        { name: "employee_id", label: "Assigned to", type: "employee" },
        { name: "assigned_on", label: "Assigned on", type: "date" },
        { name: "purchase_date", label: "Purchase date", type: "date" },
        { name: "cost", label: "Cost (₹)", type: "number" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "Asset", render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.asset_tag ?? r.serial_number ?? ""}</p></div> },
        { key: "category", label: "Category", render: (r) => <span className="capitalize">{r.category?.replace("_", " ")}</span> },
        { key: "employee", label: "Assigned to", render: (r) => (r.employee ? empName(r) : "—") },
        { key: "assigned_on", label: "Since", render: (r) => fmtDate(r.assigned_on), className: "hidden md:table-cell" },
        { key: "cost", label: "Cost", render: (r) => fmtINR(r.cost), className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
