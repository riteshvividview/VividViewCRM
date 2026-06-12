"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield, Layers, CheckCircle2, AlertCircle, RefreshCw, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface Policy {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface PolicyAssignment {
  id: string;
  policy_id: string;
  effective_from: string;
  hr_leave_policies: { name: string; description: string | null } | null;
}

interface PolicyRule {
  id: string;
  leave_type_id: string;
  annual_quota: number;
  carry_forward_limit: number;
  encashment_allowed: boolean;
  hr_leave_types: { name: string; code: string } | null;
}

interface Balance {
  leave_type_id: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  carried_forward_days: number;
  hr_leave_types: { name: string; code: string; is_paid: boolean } | null;
}

interface BalanceHistory {
  id: string;
  change_days: number;
  change_type: string;
  note: string | null;
  created_at: string;
  hr_leave_types: { name: string; code: string } | null;
}

const CHANGE_STYLE: Record<string, string> = {
  allocation:    "text-green-700 bg-green-50 dark:bg-green-900/20",
  used:          "text-red-700 bg-red-50 dark:bg-red-900/20",
  carry_forward: "text-blue-700 bg-blue-50 dark:bg-blue-900/20",
  encashment:    "text-orange-700 bg-orange-50 dark:bg-orange-900/20",
  correction:    "text-purple-700 bg-purple-50 dark:bg-purple-900/20",
  lapse:         "text-gray-600 bg-gray-100 dark:bg-gray-800",
  reversal:      "text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function EmployeeLeavePolicyTab({
  employeeId,
  workspaceId,
  viewerRole,
}: {
  employeeId: string;
  workspaceId: string;
  viewerRole: UserRole;
}) {
  const isHR = viewerRole === "super_admin" || viewerRole === "hr";
  const year = new Date().getFullYear();

  const [currentAssignment, setCurrentAssignment] = useState<PolicyAssignment | null>(null);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [previewRules, setPreviewRules] = useState<PolicyRule[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [assignRes, polRes, balRes, histRes] = await Promise.all([
      supabase
        .from("hr_employee_leave_policy")
        .select("id, policy_id, effective_from, hr_leave_policies(name, description)")
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .maybeSingle(),
      isHR
        ? supabase
            .from("hr_leave_policies")
            .select("id, name, description, is_active")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("hr_leave_balances")
        .select("leave_type_id, total_days, used_days, pending_days, carried_forward_days, hr_leave_types(name, code, is_paid)")
        .eq("employee_id", employeeId)
        .eq("year", year),
      supabase
        .from("hr_leave_balance_history")
        .select("id, change_days, change_type, note, created_at, hr_leave_types(name, code)")
        .eq("employee_id", employeeId)
        .eq("year", year)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setCurrentAssignment((assignRes.data ?? null) as PolicyAssignment | null);
    setAllPolicies((polRes.data ?? []) as Policy[]);
    setBalances((balRes.data ?? []) as unknown as Balance[]);
    // Gracefully ignore history if table doesn't exist
    if (!histRes.error || !histRes.error.message?.includes("does not exist")) {
      setHistory((histRes.data ?? []) as unknown as BalanceHistory[]);
    }
    setLoading(false);
  }, [employeeId, workspaceId, isHR, year]);

  useEffect(() => { load(); }, [load]);

  // Load preview rules when a policy is selected
  useEffect(() => {
    if (!selectedPolicyId) { setPreviewRules([]); return; }
    setPreviewLoading(true);
    const supabase = createClient();
    supabase
      .from("hr_leave_policy_rules")
      .select("id, leave_type_id, annual_quota, carry_forward_limit, encashment_allowed, hr_leave_types(name, code)")
      .eq("policy_id", selectedPolicyId)
      .then(({ data }) => {
        setPreviewRules((data ?? []) as unknown as PolicyRule[]);
        setPreviewLoading(false);
      });
  }, [selectedPolicyId]);

  async function assignPolicy() {
    if (!selectedPolicyId) { toast.error("Please select a policy"); return; }
    setAssigning(true);

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: { user } } = await supabase.auth.getUser();
    const selectedPolicy = allPolicies.find((p) => p.id === selectedPolicyId);

    try {
      // 1 — Deactivate all current policy assignments for this employee
      await supabase
        .from("hr_employee_leave_policy")
        .update({ is_active: false, effective_to: today })
        .eq("employee_id", employeeId)
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      // 2 — Insert new policy assignment
      const { error: assignErr } = await supabase.from("hr_employee_leave_policy").insert({
        workspace_id: workspaceId,
        employee_id: employeeId,
        policy_id: selectedPolicyId,
        effective_from: today,
        is_active: true,
      });
      if (assignErr) throw assignErr;

      // 3 — Load the policy rules to know what to allocate
      const { data: rules, error: rulesErr } = await supabase
        .from("hr_leave_policy_rules")
        .select("leave_type_id, annual_quota, carry_forward_limit")
        .eq("policy_id", selectedPolicyId);
      if (rulesErr) throw rulesErr;

      // 4 — Allocate leave balances for each rule (idempotent)
      for (const rule of rules ?? []) {
        const { data: existing } = await supabase
          .from("hr_leave_balances")
          .select("id, used_days, pending_days")
          .eq("employee_id", employeeId)
          .eq("leave_type_id", rule.leave_type_id)
          .eq("year", year)
          .maybeSingle();

        if (existing) {
          // Update total_days only — preserve used_days and pending_days
          await supabase
            .from("hr_leave_balances")
            .update({
              total_days: rule.annual_quota,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Create fresh balance record
          await supabase.from("hr_leave_balances").insert({
            workspace_id: workspaceId,
            employee_id: employeeId,
            leave_type_id: rule.leave_type_id,
            year,
            total_days: rule.annual_quota,
            used_days: 0,
            pending_days: 0,
            carried_forward_days: 0,
          });
        }

        // 5 — Insert audit trail in balance history (graceful if table not yet migrated)
        try {
          await supabase.from("hr_leave_balance_history").insert({
            workspace_id: workspaceId,
            employee_id: employeeId,
            leave_type_id: rule.leave_type_id,
            year,
            change_days: rule.annual_quota,
            change_type: "allocation",
            note: `Auto-allocated via policy "${selectedPolicy?.name ?? "Unknown"}"`,
            created_by: user?.id ?? null,
          });
        } catch {
          // Silently skip — hr_leave_balance_history may not exist yet (Block F migration pending)
        }
      }

      toast.success(
        `Policy "${selectedPolicy?.name}" assigned. ${rules?.length ?? 0} leave type(s) allocated.`
      );
      setSelectedPolicyId("");
      load();
    } catch (e: unknown) {
      toast.error((e as { message?: string }).message ?? "Assignment failed. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Current Policy ───────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-foreground">Current Leave Policy</h3>
        </div>

        {currentAssignment ? (
          <div className="flex items-start justify-between gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-300">
                {currentAssignment.hr_leave_policies?.name ?? "Unknown Policy"}
              </p>
              {currentAssignment.hr_leave_policies?.description && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {currentAssignment.hr_leave_policies.description}
                </p>
              )}
              <p className="text-xs text-indigo-500 mt-1.5">
                Active since {fmtDate(currentAssignment.effective_from)}
              </p>
            </div>
            <Badge className="bg-indigo-600 text-white shrink-0 mt-0.5">Active</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No leave policy assigned.
              {isHR ? " Assign a policy below to automatically allocate leave balances." : " Contact HR to assign a leave policy."}
            </p>
          </div>
        )}
      </div>

      {/* ── Policy Assignment UI (HR only) ───────────────────────────── */}
      {isHR && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold text-foreground">
              {currentAssignment ? "Change Leave Policy" : "Assign Leave Policy"}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a policy…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPolicies.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No active policies found. Create one first.
                      </div>
                    ) : (
                      allPolicies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={assignPolicy}
                disabled={!selectedPolicyId || assigning}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {assigning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Assigning…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {currentAssignment ? "Reassign & Reallocate" : "Assign & Allocate"}
                  </>
                )}
              </Button>
            </div>

            {/* Allocation preview */}
            {selectedPolicyId && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Leave Quotas This Policy Will Allocate
                </p>
                {previewLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-7 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : previewRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules configured for this policy.</p>
                ) : (
                  <div className="space-y-2">
                    {previewRules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{rule.hr_leave_types?.name ?? "Unknown"}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {rule.hr_leave_types?.code ?? ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{rule.annual_quota} days/yr</span>
                          {Number(rule.carry_forward_limit) > 0 && (
                            <span>· carry fwd {rule.carry_forward_limit}d</span>
                          )}
                          {rule.encashment_allowed && (
                            <Badge variant="outline" className="text-[10px] py-0">Encashable</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60 mt-3">
                  Existing used/pending days will be preserved. Only total quota will be updated.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Leave Balances ───────────────────────────────────────────── */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Leave Balances — {year}</h3>

        {balances.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No leave balances allocated yet.</p>
            {isHR && !currentAssignment && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Assign a leave policy above to automatically create balances.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {balances.map((b) => {
              const total   = Number(b.total_days);
              const used    = Number(b.used_days);
              const pending = Number(b.pending_days);
              const avail   = Math.max(0, total - used - pending);
              const pct     = total > 0 ? Math.round(((used + pending) / total) * 100) : 0;

              return (
                <div key={b.leave_type_id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground font-mono">
                      {b.hr_leave_types?.code ?? "—"}
                    </span>
                    {b.hr_leave_types?.is_paid && (
                      <span className="text-[10px] bg-green-50 text-green-600 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                        Paid
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{avail}</p>
                    <p className="text-xs text-muted-foreground">{b.hr_leave_types?.name ?? "Leave"}</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-indigo-500"
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {used}d used · {pending}d pending · {total}d total
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Balance History ──────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Balance History — {year}</h3>
          </div>
          <div className="divide-y divide-border">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm text-foreground">
                    {h.hr_leave_types?.name ?? "—"}
                    {h.hr_leave_types?.code && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                        {h.hr_leave_types.code}
                      </span>
                    )}
                  </p>
                  {h.note && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground/50 mt-0.5">{fmtDate(h.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-xs font-bold",
                    Number(h.change_days) >= 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {Number(h.change_days) >= 0 ? "+" : ""}{h.change_days}d
                  </span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full capitalize font-medium",
                    CHANGE_STYLE[h.change_type] ?? "bg-muted text-muted-foreground"
                  )}>
                    {h.change_type.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
