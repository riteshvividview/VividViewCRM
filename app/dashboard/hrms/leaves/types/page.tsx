"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Edit2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  carry_forward_limit: number;
  is_paid: boolean;
  requires_approval: boolean;
  applicable_gender: string;
  accrual_type?: string;
  encashable?: boolean;
  min_advance_notice_days?: number;
  max_consecutive_days?: number;
  approval_levels?: string;
  sandwich_rule?: boolean;
  weekends_counted?: boolean;
  holidays_counted?: boolean;
  allow_negative_balance?: boolean;
}

const EMPTY: Omit<LeaveType, "id"> = {
  name: "",
  code: "",
  days_per_year: 0,
  carry_forward_limit: 0,
  is_paid: true,
  requires_approval: true,
  applicable_gender: "all",
  accrual_type: "annual_upfront",
  encashable: false,
  min_advance_notice_days: 0,
  max_consecutive_days: 0,
  approval_levels: "l1_only",
  sandwich_rule: false,
  weekends_counted: false,
  holidays_counted: false,
  allow_negative_balance: false,
};

const GENDER_OPTS = [
  { value: "all",         label: "All employees" },
  { value: "male_only",   label: "Male only" },
  { value: "female_only", label: "Female only" },
];

const ACCRUAL_OPTS = [
  { value: "annual_upfront",   label: "Annual Upfront (full quota on year start)" },
  { value: "monthly_accrual",  label: "Monthly Accrual (quota divided by 12/month)" },
];

const APPROVAL_OPTS = [
  { value: "none",       label: "No approval needed (auto-approved)" },
  { value: "l1_only",    label: "L1 only (Reporting Manager)" },
  { value: "l1_and_l2",  label: "L1 + L2 (Manager then HR)" },
  { value: "l2_only",    label: "L2 only (HR directly)" },
];

export default function LeaveTypesPage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes]   = useState<LeaveType[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showDialog, setShowDialog]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<Omit<LeaveType, "id">>(EMPTY);
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile?.workspace_id) return;
    if (!["super_admin", "hr"].includes(profile.role ?? "")) {
      router.replace("/dashboard/access-denied"); return;
    }

    setWorkspaceId(profile.workspace_id);

    const { data } = await supabase
      .from("hr_leave_types")
      .select("*")
      .eq("workspace_id", profile.workspace_id)
      .order("name");

    setLeaveTypes((data ?? []) as LeaveType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowDialog(true);
  }

  function openEdit(lt: LeaveType) {
    setEditingId(lt.id);
    setForm({
      name: lt.name,
      code: lt.code,
      days_per_year: lt.days_per_year,
      carry_forward_limit: lt.carry_forward_limit ?? 0,
      is_paid: lt.is_paid,
      requires_approval: lt.requires_approval,
      applicable_gender: lt.applicable_gender ?? "all",
      accrual_type: lt.accrual_type ?? "annual_upfront",
      encashable: lt.encashable ?? false,
      min_advance_notice_days: lt.min_advance_notice_days ?? 0,
      max_consecutive_days: lt.max_consecutive_days ?? 0,
      approval_levels: lt.approval_levels ?? "l1_only",
      sandwich_rule: lt.sandwich_rule ?? false,
      weekends_counted: lt.weekends_counted ?? false,
      holidays_counted: lt.holidays_counted ?? false,
      allow_negative_balance: lt.allow_negative_balance ?? false,
    });
    setShowDialog(true);
  }

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Leave type name is required"); return; }
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    if (!workspaceId) return;
    setSaving(true);

    const supabase = createClient();
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        days_per_year: Number(form.days_per_year),
        carry_forward_limit: Number(form.carry_forward_limit),
        is_paid: form.is_paid,
        requires_approval: form.requires_approval,
        applicable_gender: form.applicable_gender,
        // Extended fields (may not exist until SQL migration runs)
        accrual_type: form.accrual_type,
        encashable: form.encashable,
        min_advance_notice_days: Number(form.min_advance_notice_days),
        max_consecutive_days: Number(form.max_consecutive_days),
        approval_levels: form.approval_levels,
        sandwich_rule: form.sandwich_rule,
        weekends_counted: form.weekends_counted,
        holidays_counted: form.holidays_counted,
        allow_negative_balance: form.allow_negative_balance,
      };

      if (editingId) {
        const { error } = await supabase.from("hr_leave_types").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("hr_leave_types")
          .insert({ ...payload, workspace_id: workspaceId });
        if (error) throw error;
      }

      toast.success(editingId ? "Leave type updated" : "Leave type created");
      setShowDialog(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? "Save failed";
      toast.error(msg.includes("duplicate") ? "Leave code already exists" : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrms/leaves"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Leave Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure leave categories and their rules</p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" />Add Leave Type
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : leaveTypes.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Tag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No leave types yet. Add one to start.</p>
          <Button size="sm" onClick={openCreate} className="mt-4">Add First Leave Type</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Leave Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Days/Year</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Carry Fwd</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Approval</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Gender</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{lt.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">{lt.code}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{lt.days_per_year}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{lt.carry_forward_limit ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={lt.is_paid ? "default" : "secondary"} className="text-xs">
                        {lt.is_paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {APPROVAL_OPTS.find(a => a.value === (lt.approval_levels ?? (lt.requires_approval ? "l1_only" : "none")))?.label.split(" ")[0] ?? "L1"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground capitalize">
                        {GENDER_OPTS.find(g => g.value === lt.applicable_gender)?.label ?? "All"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lt)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(v) => !v && setShowDialog(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Basic Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Leave Name *</Label>
                  <Input placeholder="e.g. Casual Leave" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Code * <span className="text-muted-foreground text-xs">(e.g. CL, SL, PL)</span></Label>
                  <Input placeholder="CL" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={10} />
                </div>
                <div className="space-y-1.5">
                  <Label>Annual Quota (days)</Label>
                  <Input type="number" min="0" step="0.5" value={form.days_per_year} onChange={(e) => set("days_per_year", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Carry Forward (days)</Label>
                  <Input type="number" min="0" step="0.5" value={form.carry_forward_limit} onChange={(e) => set("carry_forward_limit", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Accrual Type</Label>
                  <Select value={form.accrual_type ?? "annual_upfront"} onValueChange={(v) => set("accrual_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCRUAL_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Gender Restriction</Label>
                  <Select value={form.applicable_gender} onValueChange={(v) => set("applicable_gender", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Approval Flow</Label>
                  <Select value={form.approval_levels ?? "l1_only"} onValueChange={(v) => set("approval_levels", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPROVAL_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Min Advance Notice (days)</Label>
                  <Input type="number" min="0" value={form.min_advance_notice_days ?? 0} onChange={(e) => set("min_advance_notice_days", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Consecutive Days (0 = unlimited)</Label>
                  <Input type="number" min="0" value={form.max_consecutive_days ?? 0} onChange={(e) => set("max_consecutive_days", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Toggle options */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Rules & Restrictions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                {[
                  { field: "is_paid" as const,                label: "Paid Leave",                 sub: "Employee is paid during this leave" },
                  { field: "requires_approval" as const,      label: "Requires Approval",           sub: "Must go through approval workflow" },
                  { field: "encashable" as const,             label: "Encashment Allowed",          sub: "Unused balance can be encashed" },
                  { field: "sandwich_rule" as const,          label: "Sandwich Rule",               sub: "Weekends between leave days are counted" },
                  { field: "weekends_counted" as const,       label: "Count Weekends",              sub: "Saturdays/Sundays are counted in leave days" },
                  { field: "holidays_counted" as const,       label: "Count Holidays",              sub: "Public holidays are counted as leave days" },
                  { field: "allow_negative_balance" as const, label: "Allow Negative Balance",      sub: "Employee can take more than available balance" },
                ].map(({ field, label, sub }) => (
                  <div key={field} className="flex items-start gap-3">
                    <Switch
                      className="mt-0.5 shrink-0"
                      checked={Boolean(form[field])}
                      onCheckedChange={(v) => set(field, v as never)}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
