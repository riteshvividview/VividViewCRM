"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Department { id: string; name: string; }

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  employee_code: "",
  designation: "",
  department_id: "",
  employment_type: "full_time",
  date_of_joining: new Date().toISOString().split("T")[0],
  basic_salary: "",
  status: "active",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relation: "",
};

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) return;
      const { data: depts } = await supabase.from("hr_departments").select("id, name").eq("workspace_id", profile.workspace_id).order("name");
      setDepartments(depts ?? []);
    }
    load();
  }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit() {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    if (!form.email.trim()) { toast.error("Email is required to create the employee's login"); return; }
    if (!form.employee_code.trim()) { toast.error("Employee code is required"); return; }
    if (!form.designation.trim()) { toast.error("Designation is required"); return; }
    if (!form.date_of_joining) { toast.error("Date of joining is required"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/hrms/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create employee");

      toast.success("Employee added — login credentials have been emailed to them");
      router.push(`/dashboard/hrms/employees/${data.id}`);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrms/employees"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Add New Employee</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details to onboard a new team member</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">

        {/* Personal Information */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full Name *</Label>
              <Input placeholder="Rahul Sharma" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div>
              <Label>Email Address *</Label>
              <Input type="email" placeholder="rahul@company.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">A login account will be created and credentials emailed here</p>
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Employment Details */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Employment Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Employee Code *</Label>
              <Input placeholder="EMP-001" value={form.employee_code} onChange={(e) => set("employee_code", e.target.value)} />
            </div>
            <div>
              <Label>Designation *</Label>
              <Input placeholder="Software Engineer" value={form.designation} onChange={(e) => set("designation", e.target.value)} />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department_id || "none"} onValueChange={(v) => set("department_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of Joining *</Label>
              <Input type="date" value={form.date_of_joining} onChange={(e) => set("date_of_joining", e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_notice">On Notice</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Compensation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Basic Monthly Salary (₹)</Label>
              <Input
                type="number"
                placeholder="25000"
                value={form.basic_salary}
                onChange={(e) => set("basic_salary", e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Used for payroll calculations (PF, ESI, PT)</p>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Emergency Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Contact Name</Label>
              <Input placeholder="Sunita Sharma" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="+91 99999 00000" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
            </div>
            <div>
              <Label>Relation</Label>
              <Input placeholder="Spouse, Parent, Sibling…" value={form.emergency_contact_relation} onChange={(e) => set("emergency_contact_relation", e.target.value)} />
            </div>
          </div>
        </div>

      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button variant="outline" asChild><Link href="/dashboard/hrms/employees">Cancel</Link></Button>
        <Button onClick={submit} disabled={saving}>
          <UserPlus className="h-4 w-4 mr-2" />
          {saving ? "Adding…" : "Add Employee"}
        </Button>
      </div>
    </div>
  );
}
