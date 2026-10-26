"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Emp {
  id: string;
  employee_code: string;
  designation: string | null;
  reporting_manager_id: string | null;
  department: { name: string } | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function Node({ emp, childrenOf, depth, highlight }: { emp: Emp; childrenOf: Map<string, Emp[]>; depth: number; highlight: string }) {
  const kids = childrenOf.get(emp.id) ?? [];
  const [open, setOpen] = useState(depth < 2);
  const name = emp.profiles?.full_name ?? emp.employee_code;
  const match = highlight && name.toLowerCase().includes(highlight.toLowerCase());

  return (
    <li>
      <div className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 w-fit min-w-[260px]", match && "ring-2 ring-purple-500")}>
        <button onClick={() => setOpen(!open)} className={cn("h-5 w-5 flex items-center justify-center text-muted-foreground", !kids.length && "invisible")}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <Link href={`/dashboard/hrms/employees/${emp.id}`} className="text-sm font-medium hover:underline">{name}</Link>
          <p className="text-xs text-muted-foreground truncate">
            {emp.designation ?? "—"}{emp.department ? ` · ${emp.department.name}` : ""}
          </p>
        </div>
        {kids.length > 0 && <span className="ml-auto text-xs text-muted-foreground pl-2">{kids.length}</span>}
      </div>
      {open && kids.length > 0 && (
        <ul className="ml-6 mt-2 space-y-2 border-l pl-4">
          {kids.map((k) => <Node key={k.id} emp={k} childrenOf={childrenOf} depth={depth + 1} highlight={highlight} />)}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    createClient()
      .from("hr_employees")
      .select("id, employee_code, designation, reporting_manager_id, department:hr_departments!department_id(name), profiles(full_name, avatar_url)")
      .eq("status", "active")
      .then(({ data }) => {
        setEmps((data ?? []) as unknown as Emp[]);
        setLoading(false);
      });
  }, []);

  const { roots, childrenOf } = useMemo(() => {
    const ids = new Set(emps.map((e) => e.id));
    const childrenOf = new Map<string, Emp[]>();
    const roots: Emp[] = [];
    for (const e of emps) {
      // Anyone whose manager is missing/inactive is treated as a root.
      if (e.reporting_manager_id && ids.has(e.reporting_manager_id) && e.reporting_manager_id !== e.id) {
        childrenOf.set(e.reporting_manager_id, [...(childrenOf.get(e.reporting_manager_id) ?? []), e]);
      } else {
        roots.push(e);
      }
    }
    return { roots, childrenOf };
  }, [emps]);

  return (
    <div className="space-y-4">
      <PageHeader title="Org Chart" subtitle="Reporting structure, based on each employee's reporting manager" />
      <div className="relative sm:w-72">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Highlight a person…" className="pl-8 h-9" />
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : roots.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No active employees.</p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <ul className="space-y-2">
            {roots.map((r) => <Node key={r.id} emp={r} childrenOf={childrenOf} depth={0} highlight={q} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
