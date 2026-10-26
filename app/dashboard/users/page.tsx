"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Shield, UserRound, Loader2, MoreHorizontal, UserX, UserCheck,
  Puzzle, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULES } from "@/lib/rbac/modules";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  disabled: boolean;
  created_at: string;
  avatar_url: string | null;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  hr:          { label: "HR",          color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  team_lead:   { label: "Team Lead",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  employee:    { label: "Employee",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

const ALL_ROLES = Object.keys(ROLE_CONFIG) as UserRole[];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", role: "employee" as UserRole });
  const [inviting, setInviting] = useState(false);
  const [modulesUser, setModulesUser] = useState<UserRow | null>(null);
  const [moduleData, setModuleData] = useState<{ module_id: string; label: string; group: string; isDefault: boolean; isGranted: boolean }[]>([]);
  const [modulesGranted, setModulesGranted] = useState<Set<string>>(new Set());
  const [modulesSaving, setModulesSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<UserRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load");
      setUsers(await res.json());
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to invite user"); return; }
      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteOpen(false);
      setInviteForm({ full_name: "", email: "", role: "employee" });
      loadUsers();
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      toast.success("Role updated");
    } else {
      toast.error("Failed to update role");
    }
  }

  async function openModulesDialog(user: UserRow) {
    setModulesUser(user);
    setModuleData([]);
    setModulesGranted(new Set());
    const res = await fetch(`/api/users/${user.id}/modules`);
    if (!res.ok) { toast.error("Failed to load modules"); return; }
    const data = await res.json();
    setModuleData(data.modules);
    setModulesGranted(new Set(data.modules.filter((m: { isGranted: boolean; module_id: string }) => m.isGranted).map((m: { module_id: string }) => m.module_id)));
  }

  async function handleSaveModules() {
    if (!modulesUser) return;
    setModulesSaving(true);
    try {
      const res = await fetch(`/api/users/${modulesUser.id}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleIds: Array.from(modulesGranted) }),
      });
      if (!res.ok) { toast.error("Failed to save module access"); return; }
      toast.success("Module access updated");
      setModulesUser(null);
    } catch {
      toast.error("Failed to save module access");
    } finally {
      setModulesSaving(false);
    }
  }

  async function handleToggleDisabled(userId: string, disabled: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, disabled } : u));
      toast.success(disabled ? "User deactivated" : "User reactivated");
    } else {
      toast.error("Failed to update user");
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/users/${removeTarget.id}/remove`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove employee");
      toast.success(`${removeTarget.full_name || removeTarget.email} removed`);
      setUsers((prev) => prev.map((u) => u.id === removeTarget.id ? { ...u, disabled: true } : u));
      setRemoveTarget(null);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to remove employee");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Invite users and manage their roles"
        action={
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Invite User
          </Button>
        }
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <UserRound className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No users yet. Invite your first team member.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Joined</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const rc = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.employee;
                    return (
                      <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={user.avatar_url ?? ""} />
                              <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-semibold">
                                {getInitials(user.full_name || user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{user.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", rc.color)}>
                            <Shield className="h-3 w-3" />
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                            user.disabled
                              ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", user.disabled ? "bg-red-500" : "bg-emerald-500")} />
                            {user.disabled ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString("en-IN", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <UserActionsMenu
                            user={user}
                            onRoleChange={handleRoleChange}
                            onToggleDisabled={handleToggleDisabled}
                            onManageModules={openModulesDialog}
                            onRemove={setRemoveTarget}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border">
              {users.map((user) => {
                const rc = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.employee;
                return (
                  <div key={user.id} className="p-4 flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.avatar_url ?? ""} />
                      <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-semibold">
                        {getInitials(user.full_name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{user.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", rc.color)}>
                          <Shield className="h-3 w-3" />{rc.label}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                          user.disabled
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", user.disabled ? "bg-red-500" : "bg-emerald-500")} />
                          {user.disabled ? "Inactive" : "Active"}
                        </span>
                      </div>
                    </div>
                    <UserActionsMenu
                      user={user}
                      onRoleChange={handleRoleChange}
                      onToggleDisabled={handleToggleDisabled}
                      onManageModules={openModulesDialog}
                      onRemove={setRemoveTarget}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Full Name</Label>
              <Input
                id="inv-name"
                placeholder="Alex Johnson"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Work Email</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="alex@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_CONFIG[r].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              A temporary password will be auto-generated and emailed to this address.
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviting}
                className="bg-purple-700 hover:bg-purple-800 text-white gap-2"
              >
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                {inviting ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Module Management Dialog */}
      <Dialog open={!!modulesUser} onOpenChange={(open) => !open && setModulesUser(null)}>
        <DialogContent className="w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Module Access — {modulesUser?.full_name || modulesUser?.email}</DialogTitle>
          </DialogHeader>
          {moduleData.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 mt-2">
              <p className="text-xs text-muted-foreground">
                Checked modules are accessible. Uncheck to revoke, or add modules beyond the role default.
                <span className="ml-1 text-purple-600 font-medium">Purple = role default.</span>
              </p>
              {Object.entries(
                Object.groupBy(moduleData, (m) => m.group)
              ).map(([group, mods]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
                  <div className="space-y-2">
                    {(mods ?? []).map((mod) => {
                      const isGranted = modulesGranted.has(mod.module_id);
                      return (
                        <label
                          key={mod.module_id}
                          className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={isGranted}
                            onCheckedChange={(checked) => {
                              const next = new Set(modulesGranted);
                              if (checked) next.add(mod.module_id);
                              else next.delete(mod.module_id);
                              setModulesGranted(next);
                            }}
                          />
                          <span className="flex-1 text-sm text-foreground">{mod.label}</span>
                          {mod.isDefault && (
                            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                              default
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setModulesUser(null)}>Cancel</Button>
            <Button
              onClick={handleSaveModules}
              disabled={modulesSaving}
              className="bg-purple-700 hover:bg-purple-800 text-white gap-2"
            >
              {modulesSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {modulesSaving ? "Saving…" : "Save Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !removing) setRemoveTarget(null); }}>
        <DialogContent className="w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Employee?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove{" "}
            <span className="font-medium text-foreground">{removeTarget?.full_name || removeTarget?.email}</span>{" "}
            from HRMS — their department assignment, attendance, leave and payroll records (if any) will be deleted,
            and their login will be disabled so they can no longer access the system. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserActionsMenu({
  user,
  onRoleChange,
  onToggleDisabled,
  onManageModules,
  onRemove,
}: {
  user: UserRow;
  onRoleChange: (id: string, role: UserRole) => void;
  onToggleDisabled: (id: string, disabled: boolean) => void;
  onManageModules: (user: UserRow) => void;
  onRemove: (user: UserRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Change Role</p>
        {ALL_ROLES.map((r) => (
          <DropdownMenuItem
            key={r}
            disabled={user.role === r}
            onClick={() => onRoleChange(user.id, r)}
          >
            {ROLE_CONFIG[r].label}
            {user.role === r && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onManageModules(user)}>
          <Puzzle className="h-4 w-4 mr-2 text-purple-600" />
          Manage Modules
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={user.disabled ? "text-emerald-600 focus:text-emerald-600" : "text-red-600 focus:text-red-600"}
          onClick={() => onToggleDisabled(user.id, !user.disabled)}
        >
          {user.disabled
            ? <><UserCheck className="h-4 w-4 mr-2" />Reactivate</>
            : <><UserX className="h-4 w-4 mr-2" />Deactivate</>
          }
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={() => onRemove(user)}
        >
          <Trash2 className="h-4 w-4 mr-2" />Remove Employee
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
