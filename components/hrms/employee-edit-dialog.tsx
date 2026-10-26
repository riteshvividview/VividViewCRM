"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useHrOptions, type Option } from "./use-hr-options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Employee = Record<string, any>;

type FieldType = "text" | "number" | "date" | "email" | "tel" | "textarea" | "select" | "department" | "employee";
interface Field { name: string; label: string; type?: FieldType; options?: Option[]; wide?: boolean }

const opt = (...vals: string[]) => vals.map((v) => ({ value: v, label: v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) }));

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "Job",
    fields: [
      { name: "employee_code", label: "Employee code" },
      { name: "designation", label: "Designation" },
      { name: "department_id", label: "Department", type: "department" },
      { name: "reporting_manager_id", label: "Reporting manager", type: "employee" },
      { name: "employment_type", label: "Employment type", type: "select", options: opt("full_time", "part_time", "contract", "intern") },
      { name: "status", label: "Status", type: "select", options: opt("active", "on_notice", "inactive", "terminated") },
      { name: "work_location", label: "Work location", type: "select", options: opt("office", "remote", "hybrid") },
      { name: "date_of_joining", label: "Date of joining", type: "date" },
      { name: "probation_end_date", label: "Probation ends", type: "date" },
      { name: "notice_period_days", label: "Notice period (days)", type: "number" },
      { name: "date_of_exit", label: "Date of exit", type: "date" },
    ],
  },
  {
    title: "Personal",
    fields: [
      { name: "date_of_birth", label: "Date of birth", type: "date" },
      { name: "gender", label: "Gender", type: "select", options: opt("male", "female", "other") },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "personal_email", label: "Personal email", type: "email" },
      { name: "blood_group", label: "Blood group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v })) },
      { name: "marital_status", label: "Marital status", type: "select", options: opt("single", "married", "divorced", "widowed") },
      { name: "current_address", label: "Current address", type: "textarea", wide: true },
      { name: "permanent_address", label: "Permanent address", type: "textarea", wide: true },
    ],
  },
  {
    title: "Compensation",
    fields: [
      { name: "salary_ctc", label: "CTC (annual ₹)", type: "number" },
      { name: "salary_basic", label: "Basic (annual ₹)", type: "number" },
    ],
  },
  {
    title: "Statutory & bank",
    fields: [
      { name: "pan_number", label: "PAN" },
      { name: "aadhaar_number", label: "Aadhaar" },
      { name: "uan_number", label: "UAN" },
      { name: "bank_name", label: "Bank name" },
      { name: "bank_ifsc", label: "IFSC" },
      { name: "bank_account_number", label: "Account number" },
    ],
  },
  {
    title: "Emergency contact",
    fields: [
      { name: "emergency_contact_name", label: "Name" },
      { name: "emergency_contact_phone", label: "Phone", type: "tel" },
      { name: "emergency_contact_relation", label: "Relation" },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (employee: Employee) => void;
}

export function EmployeeEditDialog({ employee, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<Employee>({});
  const [section, setSection] = useState(SECTIONS[0].title);
  const [saving, setSaving] = useState(false);
  const { employees, departments } = useHrOptions({ employees: open, departments: open });

  useEffect(() => {
    if (!open || !employee) return;
    const initial: Employee = {};
    for (const f of ALL_FIELDS) initial[f.name] = employee[f.name] ?? "";
    setForm(initial);
    setSection(SECTIONS[0].title);
  }, [open, employee]);

  async function save() {
    if (!employee) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hrms/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      toast.success("Employee updated");
      onSaved(json.employee);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function input(f: Field) {
    const value = form[f.name] ?? "";
    const set = (v: string) => setForm((s) => ({ ...s, [f.name]: v }));
    if (f.type === "textarea") return <Textarea rows={2} value={value} onChange={(e) => set(e.target.value)} />;
    if (f.type === "select" || f.type === "department" || f.type === "employee") {
      const options = f.type === "department" ? departments
        : f.type === "employee" ? employees.filter((o) => o.value !== employee?.id)
        : f.options ?? [];
      return (
        <select className={selectClass} value={value} onChange={(e) => set(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    return <Input type={f.type ?? "text"} value={value} onChange={(e) => set(e.target.value)} />;
  }

  const current = SECTIONS.find((s) => s.title === section)!;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit employee</DialogTitle></DialogHeader>
        <div className="flex gap-1 border-b -mx-1 px-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button key={s.title} onClick={() => setSection(s.title)}
              className={cn("px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                section === s.title ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {s.title}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {current.fields.map((f) => (
            <div key={f.name} className={cn("grid gap-1.5", f.wide && "sm:col-span-2")}>
              <Label className="text-xs text-muted-foreground font-normal">{f.label}</Label>
              {input(f)}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
