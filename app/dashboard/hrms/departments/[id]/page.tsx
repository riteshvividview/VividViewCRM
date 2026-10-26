"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, MoreHorizontal, ArrowRightLeft, UserMinus, UserPlus, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DepartmentDetail {
  id: string;
  name: string;
  description: string | null;
  parent_department_id: string | null;
  head_employee_id: string | null;
  parent: { name: string } | null;
  head: { id: string; profiles: { full_name: string; avatar_url: string | null } | null } | null;
}

interface Employee {
  id: string;
  employee_code: string;
  designation: string;
  employment_type: string;
  status: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

interface OtherEmployee {
  id: string;
  employee_code: string;
  designation: string;
  department_id: string | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  hr_departments: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_notice:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  inactive:   "bg-muted text-muted-foreground",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [dept, setDept] = useState<DepartmentDetail | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveTarget, setMoveTarget] = useState<Employee | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [moving, setMoving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Employee | null>(null);
  const [removing, setRemoving] = useState(false);
  const [otherEmployees, setOtherEmployees] = useState<OtherEmployee[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
    if (!profile?.workspace_id) { setLoading(false); return; }

    const [deptRes, empRes, allDeptRes, otherEmpRes] = await Promise.all([
      supabase.from("hr_departments")
        .select("id, name, description, parent_department_id, head_employee_id, parent:hr_departments!parent_department_id(name), head:hr_employees!head_employee_id(id, profiles(full_name, avatar_url))")
        .eq("id", id)
        .single(),
      supabase.from("hr_employees")
        .select("id, employee_code, designation, employment_type, status, profiles(full_name, avatar_url)")
        .eq("department_id", id)
        .eq("workspace_id", profile.workspace_id)
        .order("employee_code"),
      supabase.from("hr_departments")
        .select("id, name")
        .eq("workspace_id", profile.workspace_id)
        .neq("id", id)
        .order("name"),
      supabase.from("hr_employees")
        .select("id, employee_code, designation, department_id, profiles(full_name, avatar_url), hr_departments!department_id(name)")
        .eq("workspace_id", profile.workspace_id)
        .order("employee_code"),
    ]);

    if (deptRes.error) {
      console.error("Department fetch error:", deptRes.error);
      toast.error("Failed to load department");
    }
    if (empRes.error) {
      console.error("Department employees fetch error:", empRes.error);
      toast.error("Failed to load employees: " + empRes.error.message);
    }

    setDept((deptRes.data ?? null) as unknown as DepartmentDetail | null);
    setEmployees((empRes.data ?? []) as unknown as Employee[]);
    setAllDepartments(allDeptRes.data ?? []);
    setOtherEmployees(
      ((otherEmpRes.data ?? []) as unknown as OtherEmployee[]).filter((e) => e.department_id !== id)
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function moveEmployee() {
    if (!moveTarget || !moveTo) return;
    setMoving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("hr_employees")
        .update({ department_id: moveTo })
        .eq("id", moveTarget.id);
      if (error) throw error;
      toast.success(`${moveTarget.profiles?.full_name ?? "Employee"} moved to new department`);
      setMoveTarget(null);
      setMoveTo("");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to move employee");
    } finally {
      setMoving(false);
    }
  }

  function toggleSelectToAdd(empId: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  }

  async function addEmployees() {
    if (selectedToAdd.size === 0) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("hr_employees")
        .update({ department_id: id })
        .in("id", Array.from(selectedToAdd));
      if (error) throw error;
      toast.success(`${selectedToAdd.size} employee${selectedToAdd.size !== 1 ? "s" : ""} added to ${dept?.name}`);
      setAddDialogOpen(false);
      setSelectedToAdd(new Set());
      setAddSearch("");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to add employees");
    } finally {
      setAdding(false);
    }
  }

  async function removeFromDepartment() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("hr_employees")
        .update({ department_id: null })
        .eq("id", removeTarget.id);
      if (error) throw error;
      toast.success(`${removeTarget.profiles?.full_name ?? "Employee"} removed from department`);
      setRemoveTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to remove employee");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-10 w-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-28 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!dept) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Department not found</p>
        <Button variant="outline" asChild><Link href="/dashboard/hrms/departments"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
      </div>
    );
  }

  const addSearchQuery = addSearch.trim().toLowerCase();
  const filteredOtherEmployees = otherEmployees.filter((e) => {
    if (!addSearchQuery) return true;
    return (e.profiles?.full_name ?? "").toLowerCase().includes(addSearchQuery)
      || e.employee_code.toLowerCase().includes(addSearchQuery);
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/hrms/departments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{dept.name}</h1>
          {dept.parent && <p className="text-xs text-muted-foreground">under {dept.parent.name}</p>}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        {dept.description && <p className="text-sm text-muted-foreground">{dept.description}</p>}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{employees.length}</span>
            <span className="text-muted-foreground">employee{employees.length !== 1 ? "s" : ""}</span>
          </div>
          {dept.head?.profiles && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Head:</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={dept.head.profiles.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                  {initials(dept.head.profiles.full_name ?? "")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{dept.head.profiles.full_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Employee list */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Employees in this department</h2>
          <Button
            size="sm"
            onClick={() => { setSelectedToAdd(new Set()); setAddSearch(""); setAddDialogOpen(true); }}
          >
            <UserPlus className="h-4 w-4 mr-2" />Add Employees
          </Button>
        </div>
        {employees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No employees assigned to this department yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link href={`/dashboard/hrms/employees/${emp.id}`} className="flex items-center gap-3 min-w-0 group">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={emp.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                      {initials(emp.profiles?.full_name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-indigo-600 truncate">
                      {emp.profiles?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{emp.employee_code} · {emp.designation}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize hidden sm:inline-block", STATUS_COLORS[emp.status] ?? "bg-muted text-muted-foreground")}>
                    {emp.status.replace("_", " ")}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setMoveTarget(emp); setMoveTo(""); }}>
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />Move to another department
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setRemoveTarget(emp)}>
                        <UserMinus className="h-3.5 w-3.5 mr-2" />Remove from department
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Move to department dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => { if (!o) setMoveTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Move {moveTarget?.profiles?.full_name ?? "Employee"}</DialogTitle></DialogHeader>
          <div className="py-2">
            {allDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other departments available.</p>
            ) : (
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger><SelectValue placeholder="Select target department" /></SelectTrigger>
                <SelectContent>
                  {allDepartments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button>
            <Button onClick={moveEmployee} disabled={moving || !moveTo}>{moving ? "Moving…" : "Move"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove from department?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{removeTarget?.profiles?.full_name}</span> will no longer
            be assigned to {dept.name}. They will remain an active employee without a department.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={removeFromDepartment} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add employees dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(o) => { setAddDialogOpen(o); if (!o) { setSelectedToAdd(new Set()); setAddSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Employees to {dept.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or employee code…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
              {filteredOtherEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {otherEmployees.length === 0 ? "No other employees in this workspace." : "No employees match your search."}
                </p>
              ) : (
                filteredOtherEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    htmlFor={`add-emp-${emp.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      id={`add-emp-${emp.id}`}
                      checked={selectedToAdd.has(emp.id)}
                      onCheckedChange={() => toggleSelectToAdd(emp.id)}
                    />
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={emp.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                        {initials(emp.profiles?.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{emp.profiles?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.employee_code} · {emp.designation}</p>
                    </div>
                    {emp.hr_departments?.name && (
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                        Currently: {emp.hr_departments.name}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={addEmployees} disabled={adding || selectedToAdd.size === 0}>
              {adding ? "Adding…" : `Add${selectedToAdd.size > 0 ? ` (${selectedToAdd.size})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
