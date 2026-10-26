"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ResourceManager, fmtDate, empName, type Row } from "@/components/hrms/resource-manager";
import { useHrOptions } from "@/components/hrms/use-hr-options";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OWNERS = ["hr", "it", "manager", "employee", "finance"].map((v) => ({ value: v, label: v.toUpperCase() === "HR" || v === "it" ? v.toUpperCase() : v }));

// Keka-style default templates applied to an employee in one click.
const TEMPLATES: Record<"onboarding" | "offboarding", { title: string; owner: string; offsetDays: number }[]> = {
  onboarding: [
    { title: "Send offer letter & collect acceptance", owner: "hr", offsetDays: -7 },
    { title: "Collect ID, PAN, Aadhaar & bank details", owner: "employee", offsetDays: 0 },
    { title: "Create email & system accounts", owner: "it", offsetDays: 0 },
    { title: "Issue laptop and ID card", owner: "it", offsetDays: 0 },
    { title: "Assign shift & leave policy", owner: "hr", offsetDays: 0 },
    { title: "Team introduction & buddy assignment", owner: "manager", offsetDays: 1 },
    { title: "Policy handbook acknowledgement", owner: "employee", offsetDays: 3 },
    { title: "30-day check-in", owner: "manager", offsetDays: 30 },
  ],
  offboarding: [
    { title: "Accept resignation & confirm last working day", owner: "hr", offsetDays: 0 },
    { title: "Knowledge transfer / handover", owner: "manager", offsetDays: 0 },
    { title: "Recover laptop, ID card & assets", owner: "it", offsetDays: 0 },
    { title: "Revoke system & email access", owner: "it", offsetDays: 0 },
    { title: "Exit interview", owner: "hr", offsetDays: 0 },
    { title: "Full & final settlement", owner: "finance", offsetDays: 15 },
    { title: "Issue relieving & experience letter", owner: "hr", offsetDays: 15 },
  ],
};

function TemplateApplier({ kind }: { kind: "onboarding" | "offboarding" }) {
  const { employees } = useHrOptions({ employees: true });
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!employeeId) return;
    setBusy(true);
    const base = new Date();
    for (const t of TEMPLATES[kind]) {
      const due = new Date(base.getTime() + t.offsetDays * 86400000).toISOString().slice(0, 10);
      await fetch("/api/hrms/records/checklists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, kind, title: t.title, owner: t.owner, due_date: due }),
      });
    }
    setBusy(false);
    toast.success("Checklist created");
    location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <ListPlus className="h-4 w-4 text-purple-600" />
      <span className="text-sm">Start {kind} for</span>
      <select className="h-8 rounded-md border bg-background px-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">Select employee…</option>
        {employees.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Button size="sm" onClick={apply} disabled={!employeeId || busy}>
        {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Apply standard checklist
      </Button>
    </div>
  );
}

export default function OnboardingPage() {
  const [kind, setKind] = useState<"onboarding" | "offboarding">("onboarding");

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["onboarding", "offboarding"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={cn("px-4 py-1.5 rounded-full text-sm font-medium capitalize", kind === k ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground")}>
            {k}
          </button>
        ))}
      </div>
      <ResourceManager
        key={kind}
        resource="checklists"
        scope={{ kind }}
        title={kind === "onboarding" ? "Onboarding" : "Offboarding"}
        subtitle={kind === "onboarding" ? "Pre-joining and first-month checklists for new hires" : "Exit checklists: handover, asset recovery, access revocation, F&F"}
        singular="Task"
        canCreate={(me) => me.isHR}
        headerExtra={<TemplateApplier kind={kind} />}
        fields={[
          { name: "employee_id", label: "Employee", type: "employee", required: true },
          { name: "title", label: "Task", type: "text", required: true },
          { name: "owner", label: "Owner", type: "select", options: OWNERS, defaultValue: "hr" },
          { name: "due_date", label: "Due date", type: "date" },
        ]}
        columns={[]}
        renderBody={(rows, { me, patch }) => {
          const groups = new Map<string, Row[]>();
          for (const r of rows) groups.set(r.employee_id, [...(groups.get(r.employee_id) ?? []), r]);
          if (groups.size === 0) return <p className="text-center py-12 text-muted-foreground">No {kind} checklists yet.</p>;
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from(groups.values()).map((items) => {
                const done = items.filter((i) => i.done).length;
                return (
                  <div key={items[0].employee_id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{empName(items[0])}</p>
                      <span className="text-xs text-muted-foreground">{done}/{items.length} done</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(done / items.length) * 100}%` }} />
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {items.map((i) => (
                        <li key={i.id} className="flex items-start gap-2 text-sm">
                          <button
                            disabled={!me.isHR && i.employee_id !== me.employeeId}
                            onClick={() => patch(i, { done: !i.done })}
                            className="mt-0.5"
                          >
                            {i.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <span className={cn("flex-1", i.done && "line-through text-muted-foreground")}>{i.title}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">{i.owner}</span>
                          <span className="text-xs text-muted-foreground w-24 text-right">{fmtDate(i.due_date)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          );
        }}
      />
    </div>
  );
}
