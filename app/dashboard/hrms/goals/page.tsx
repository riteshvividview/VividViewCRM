"use client";

import { ResourceManager, StatusPill, fmtDate, empName, type Row, type Me } from "@/components/hrms/resource-manager";

const TYPES = [{ value: "okr", label: "OKR" }, { value: "kpi", label: "KPI" }, { value: "development", label: "Development" }];
const STATUSES = [
  { value: "not_started", label: "Not started" }, { value: "on_track", label: "On track" },
  { value: "at_risk", label: "At risk" }, { value: "behind", label: "Behind" }, { value: "completed", label: "Completed" },
];
const mine = (r: Row, me: Me) => me.isHR || r.employee_id === me.employeeId;

export default function GoalsPage() {
  return (
    <ResourceManager
      resource="goals"
      title="Goals & OKRs"
      subtitle="Set objectives, track progress and keep everyone aligned"
      singular="Goal"
      tabs={{ field: "status", options: STATUSES }}
      canEdit={mine}
      canDelete={mine}
      fields={[
        { name: "employee_id", label: "Owner", type: "employee", hrOnly: true },
        { name: "title", label: "Objective", type: "text", required: true },
        { name: "description", label: "Key results / details", type: "textarea" },
        { name: "goal_type", label: "Type", type: "select", options: TYPES, defaultValue: "okr" },
        { name: "period", label: "Period", type: "text", placeholder: "Q4 2026" },
        { name: "due_date", label: "Due date", type: "date" },
        { name: "progress", label: "Progress (%)", type: "number", defaultValue: 0 },
        { name: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "on_track" },
      ]}
      columns={[
        { key: "title", label: "Goal", render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground uppercase">{r.goal_type} {r.period ? `· ${r.period}` : ""}</p></div> },
        { key: "employee", label: "Owner", render: (r) => empName(r) },
        {
          key: "progress", label: "Progress", render: (r) => (
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-purple-600" style={{ width: `${r.progress ?? 0}%` }} />
              </div>
              <span className="text-xs tabular-nums w-8 text-right">{r.progress ?? 0}%</span>
            </div>
          ),
        },
        { key: "due_date", label: "Due", render: (r) => fmtDate(r.due_date), className: "hidden md:table-cell" },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
