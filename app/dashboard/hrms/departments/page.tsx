"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Users, Plus, Pencil, Trash2, ChevronRight,
  MoreHorizontal, UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_department_id: string | null;
  head_employee_id: string | null;
  workspace_id: string;
  created_at: string;
  parent?: { name: string } | null;
  _count?: { employees: number };
}

interface Employee {
  id: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

const DEPT_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
];

function colorFor(idx: number) { return DEPT_COLORS[idx % DEPT_COLORS.length]; }

const EMPTY_FORM = { name: "", description: "", parent_id: "", manager_id: "" };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empCounts, setEmpCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
    if (!profile?.workspace_id) return;
    setWorkspaceId(profile.workspace_id);

    const [deptRes, empRes, countRes] = await Promise.all([
      supabase
        .from("hr_departments")
        .select("id, name, description, parent_department_id, head_employee_id, workspace_id, created_at, parent:hr_departments!parent_department_id(name)")
        .eq("workspace_id", profile.workspace_id)
        .order("name"),
      supabase
        .from("hr_employees")
        .select("id, department_id, profiles(full_name, avatar_url)")
        .eq("workspace_id", profile.workspace_id)
        .eq("status", "active"),
      supabase
        .from("hr_employees")
        .select("department_id")
        .eq("workspace_id", profile.workspace_id)
        .eq("status", "active"),
    ]);

    const counts: Record<string, number> = {};
    for (const e of countRes.data ?? []) {
      if (e.department_id) counts[e.department_id] = (counts[e.department_id] ?? 0) + 1;
    }

    setDepartments((deptRes.data ?? []) as unknown as Department[]);
    setEmployees((empRes.data ?? []) as unknown as Employee[]);
    setEmpCounts(counts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(dept: Department) {
    setEditTarget(dept);
    setForm({
      name: dept.name,
      description: dept.description ?? "",
      parent_id: dept.parent_department_id ?? "",
      manager_id: dept.head_employee_id ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Department name is required"); return; }
    if (!workspaceId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        parent_department_id: form.parent_id || null,
        head_employee_id: form.manager_id || null,
        workspace_id: workspaceId,
      };

      if (editTarget) {
        const { error } = await supabase.from("hr_departments").update(payload).eq("id", editTarget.id);
        if (error) throw error;
        toast.success("Department updated");
      } else {
        const { error } = await supabase.from("hr_departments").insert(payload);
        if (error) throw error;
        toast.success("Department created");
      }

      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("hr_departments").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Department deleted");
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const totalActive = Object.values(empCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} departments · ${totalActive} active employees`}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />Add Department
          </Button>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Departments</p>
          <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Employees</p>
          <p className="text-2xl font-bold text-gray-900">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Managed Depts</p>
          <p className="text-2xl font-bold text-gray-900">{departments.filter((d) => d.head_employee_id).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Sub-departments</p>
          <p className="text-2xl font-bold text-gray-900">{departments.filter((d) => d.parent_department_id).length}</p>
        </div>
      </div>

      {/* Department grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-gray-100 mb-3" />
              <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-48 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No departments yet</p>
          <p className="text-sm text-gray-400 mb-4">Create your first department to organise your team.</p>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Department</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept, idx) => {
            const count = empCounts[dept.id] ?? 0;
            const color = colorFor(idx);
            return (
              <Link
                key={dept.id}
                href={`/dashboard/hrms/departments/${dept.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(dept)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteTarget(dept)}
                        disabled={count > 0}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                        {count > 0 && <span className="ml-1 text-xs text-gray-400">(has employees)</span>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{dept.name}</h3>
                {dept.parent && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                    <ChevronRight className="h-3 w-3" />under {(dept.parent as { name: string }).name}
                  </p>
                )}
                {dept.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{dept.description}</p>
                )}

                {(() => {
                    const mgr = employees.find(e => e.id === dept.head_employee_id);
                    return (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{count}</span>
                          <span className="text-gray-400">active</span>
                        </div>
                        {mgr?.profiles && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={mgr.profiles.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                {initials(mgr.profiles.full_name ?? "")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-gray-500">{mgr.profiles.full_name}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </Link>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Department" : "New Department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Department Name *</Label>
              <Input
                placeholder="e.g. Engineering, Sales, HR..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="What does this department do?"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Parent Department</Label>
              <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {departments
                    .filter((d) => d.id !== editTarget?.id)
                    .map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department Manager</Label>
              <Select value={form.manager_id || "none"} onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="No manager assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.profiles?.full_name ?? emp.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Department?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Are you sure you want to delete <span className="font-medium text-gray-900">{deleteTarget?.name}</span>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
