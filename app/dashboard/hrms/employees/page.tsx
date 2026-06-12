"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, UserPlus, Building2, MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Employee {
  id: string;
  employee_code: string;
  designation: string;
  employment_type: string;
  status: string;
  date_of_joining: string;
  hr_departments: { name: string } | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_notice:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  inactive:   "bg-muted text-muted-foreground",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", intern: "Intern",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) { setLoading(false); return; }

      const [empRes, deptRes] = await Promise.all([
        supabase.from("hr_employees")
          .select("id, employee_code, designation, employment_type, status, date_of_joining, hr_departments!department_id(name), profiles(full_name, avatar_url)")
          .eq("workspace_id", profile.workspace_id)
          .order("date_of_joining", { ascending: false }),
        supabase.from("hr_departments")
          .select("id, name").eq("workspace_id", profile.workspace_id),
      ]);

      if (empRes.error) {
        console.error("Employees fetch error:", empRes.error);
        toast.error("Failed to load employees: " + empRes.error.message);
      }

      setEmployees((empRes.data ?? []) as unknown as Employee[]);
      setDepartments(deptRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = employees.filter((e) => {
    const name = e.profiles?.full_name?.toLowerCase() ?? "";
    const code = e.employee_code.toLowerCase();
    const des  = e.designation.toLowerCase();
    const q    = search.toLowerCase();
    if (search && !name.includes(q) && !code.includes(q) && !des.includes(q)) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (deptFilter !== "all" && e.hr_departments?.name !== deptFilter) return false;
    return true;
  });

  const skeletonRows = [...Array(6)];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total`}
        actions={
          <Button asChild size="sm" className="bg-purple-700 hover:bg-purple-800 text-white">
            <Link href="/dashboard/hrms/employees/new">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Add Employee</span>
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, role…"
            className="pl-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_notice">On Notice</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[150px] h-10"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? skeletonRows.map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No employees found
                      </td>
                    </tr>
                  )
                : filtered.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/hrms/employees/${emp.id}`} className="flex items-center gap-3 group">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={emp.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {initials(emp.profiles?.full_name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground group-hover:text-purple-600 transition-colors truncate">
                              {emp.profiles?.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {emp.employee_code} · {emp.designation}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{emp.hr_departments?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-sm">
                        {TYPE_LABELS[emp.employment_type] ?? emp.employment_type}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {new Date(emp.date_of_joining).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[emp.status] ?? "bg-muted text-muted-foreground")}>
                          {emp.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {employees.length} employees
          </div>
        )}
      </div>

      {/* ── Mobile card view ── */}
      <div className="md:hidden space-y-2">
        {loading
          ? skeletonRows.map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))
          : filtered.length === 0
          ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No employees found
              </div>
            )
          : filtered.map((emp) => (
              <Link
                key={emp.id}
                href={`/dashboard/hrms/employees/${emp.id}`}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
              >
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={emp.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-semibold">
                    {initials(emp.profiles?.full_name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {emp.profiles?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {emp.designation} · {emp.hr_departments?.name ?? "—"}
                  </p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0", STATUS_COLORS[emp.status] ?? "bg-muted text-muted-foreground")}>
                  {emp.status.replace("_", " ")}
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}
