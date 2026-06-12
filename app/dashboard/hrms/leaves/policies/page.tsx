"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp,
  Edit2, Trash2, Users, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
}

interface PolicyRule {
  id: string;
  leave_type_id: string;
  annual_quota: number;
  monthly_accrual: number;
  carry_forward_limit: number;
  encashment_allowed: boolean;
  approval_required: boolean;
}

interface Policy {
  id: string;
  name: string;
  description: string | null;
  policy_year_start: string;
  is_active: boolean;
  created_at: string;
  rules?: PolicyRule[];
}

const EMPTY_POLICY = {
  name: "",
  description: "",
  policy_year_start: "01-01",
  is_active: true,
};

export default function LeavePoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies]     = useState<Policy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState(EMPTY_POLICY);
  const [rules, setRules]           = useState<Record<string, Partial<PolicyRule>>>({});
  const [saving, setSaving]         = useState(false);

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
      router.replace("/dashboard/access-denied");
      return;
    }

    setWorkspaceId(profile.workspace_id);

    const [polRes, typRes] = await Promise.all([
      supabase
        .from("hr_leave_policies")
        .select("id, name, description, policy_year_start, is_active, created_at")
        .eq("workspace_id", profile.workspace_id)
        .order("name"),
      supabase
        .from("hr_leave_types")
        .select("id, name, code, days_per_year")
        .eq("workspace_id", profile.workspace_id)
        .order("name"),
    ]);

    setPolicies((polRes.data ?? []) as Policy[]);
    setLeaveTypes((typRes.data ?? []) as LeaveType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadRules(policyId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("hr_leave_policy_rules")
      .select("*")
      .eq("policy_id", policyId);
    setPolicies((prev) => prev.map((p) =>
      p.id === policyId ? { ...p, rules: (data ?? []) as PolicyRule[] } : p
    ));
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      loadRules(id);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_POLICY);
    setRules({});
    setShowDialog(true);
  }

  function openEdit(policy: Policy) {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      description: policy.description ?? "",
      policy_year_start: policy.policy_year_start ?? "01-01",
      is_active: policy.is_active,
    });
    // Pre-fill rules from existing
    const ruleMap: Record<string, Partial<PolicyRule>> = {};
    (policy.rules ?? []).forEach((r) => {
      ruleMap[r.leave_type_id] = r;
    });
    setRules(ruleMap);
    setShowDialog(true);
  }

  function setRule(leaveTypeId: string, field: string, value: unknown) {
    setRules((prev) => ({
      ...prev,
      [leaveTypeId]: { ...prev[leaveTypeId], leave_type_id: leaveTypeId, [field]: value },
    }));
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Policy name is required"); return; }
    if (!workspaceId) return;
    setSaving(true);

    const supabase = createClient();
    try {
      let policyId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("hr_leave_policies")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("hr_leave_policies")
          .insert({ ...form, workspace_id: workspaceId })
          .select("id")
          .single();
        if (error) throw error;
        policyId = data.id;
      }

      // Upsert rules for each leave type that has quota > 0
      const ruleEntries = Object.values(rules).filter((r) => r.leave_type_id && Number(r.annual_quota ?? 0) >= 0);
      for (const rule of ruleEntries) {
        await supabase.from("hr_leave_policy_rules").upsert({
          workspace_id: workspaceId,
          policy_id: policyId,
          leave_type_id: rule.leave_type_id,
          annual_quota: Number(rule.annual_quota ?? 0),
          monthly_accrual: Number(rule.monthly_accrual ?? 0),
          carry_forward_limit: Number(rule.carry_forward_limit ?? 0),
          encashment_allowed: rule.encashment_allowed ?? false,
          approval_required: rule.approval_required ?? true,
        }, { onConflict: "policy_id,leave_type_id" });
      }

      toast.success(editingId ? "Policy updated" : "Policy created");
      setShowDialog(false);
      load();
    } catch (e: unknown) {
      toast.error((e as { message?: string }).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(policy: Policy) {
    const supabase = createClient();
    await supabase.from("hr_leave_policies").update({ is_active: !policy.is_active }).eq("id", policy.id);
    setPolicies((prev) => prev.map((p) => p.id === policy.id ? { ...p, is_active: !p.is_active } : p));
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/hrms/leaves"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Leave Policies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define leave entitlements per employee group</p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" />New Policy
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No leave policies yet. Create one to get started.</p>
          <Button size="sm" onClick={openCreate} className="mt-4">Create First Policy</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <div key={policy.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Policy header */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{policy.name}</h3>
                    <Badge variant={policy.is_active ? "default" : "secondary"} className="text-xs">
                      {policy.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {policy.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{policy.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(policy)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpand(policy.id)}>
                    {expanded === policy.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Expanded rules */}
              {expanded === policy.id && (
                <div className="border-t border-border p-4">
                  {!policy.rules ? (
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  ) : policy.rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leave type rules configured for this policy.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">Leave Type</th>
                            <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Annual Days</th>
                            <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Carry Fwd</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Encash</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase">Approval</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {policy.rules.map((rule) => {
                            const lt = leaveTypes.find((t) => t.id === rule.leave_type_id);
                            return (
                              <tr key={rule.id}>
                                <td className="py-2.5">
                                  <span className="font-medium text-foreground">{lt?.name ?? "—"}</span>
                                  <span className="ml-1.5 text-xs text-muted-foreground">{lt?.code ?? ""}</span>
                                </td>
                                <td className="py-2.5 text-right font-semibold text-foreground">{rule.annual_quota}</td>
                                <td className="py-2.5 text-right text-muted-foreground hidden sm:table-cell">{rule.carry_forward_limit}</td>
                                <td className="py-2.5 text-center hidden md:table-cell">
                                  {rule.encashment_allowed ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                                </td>
                                <td className="py-2.5 text-center">
                                  <Badge variant={rule.approval_required ? "default" : "outline"} className="text-xs">
                                    {rule.approval_required ? "Required" : "Auto"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(v) => !v && setShowDialog(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Policy" : "Create Leave Policy"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Policy Name *</Label>
                <Input
                  placeholder="e.g. Junior Developer Policy"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Policy Year Start (MM-DD)</Label>
                <Input
                  placeholder="01-01"
                  value={form.policy_year_start}
                  onChange={(e) => setForm((f) => ({ ...f, policy_year_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe who this policy applies to…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label>Active (enabled for assignment)</Label>
              </div>
            </div>

            {/* Leave type quotas */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Leave Type Entitlements</h3>
              <div className="space-y-3">
                {leaveTypes.map((lt) => {
                  const rule = rules[lt.id] ?? {};
                  return (
                    <div key={lt.id} className="border border-border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm text-foreground">{lt.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{lt.code}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Default: {lt.days_per_year}d/yr</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Annual Days</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder={String(lt.days_per_year)}
                            value={rule.annual_quota ?? ""}
                            onChange={(e) => setRule(lt.id, "annual_quota", Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Carry Fwd</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={rule.carry_forward_limit ?? ""}
                            onChange={(e) => setRule(lt.id, "carry_forward_limit", Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-end gap-2 pb-0.5">
                          <Switch
                            checked={rule.encashment_allowed ?? false}
                            onCheckedChange={(v) => setRule(lt.id, "encashment_allowed", v)}
                          />
                          <Label className="text-xs">Encash</Label>
                        </div>
                        <div className="flex items-end gap-2 pb-0.5">
                          <Switch
                            checked={rule.approval_required ?? true}
                            onCheckedChange={(v) => setRule(lt.id, "approval_required", v)}
                          />
                          <Label className="text-xs">Needs Approval</Label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? "Saving…" : editingId ? "Update Policy" : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
