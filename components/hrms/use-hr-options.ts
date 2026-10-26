"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Option { value: string; label: string }

interface Want { employees?: boolean; jobs?: boolean; cycles?: boolean; departments?: boolean }

/** Loads dropdown options for HRMS forms; only queries the lists that are actually needed. */
export function useHrOptions(want: Want) {
  const [employees, setEmployees] = useState<Option[]>([]);
  const [jobs, setJobs] = useState<Option[]>([]);
  const [cycles, setCycles] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const { employees: e, jobs: j, cycles: c, departments: d } = want;

  useEffect(() => {
    const supabase = createClient();
    if (e) {
      supabase.from("hr_employees").select("id, employee_code, profiles(full_name)").eq("status", "active").order("employee_code")
        .then(({ data }) => setEmployees((data ?? []).map((r: { id: string; employee_code: string; profiles: unknown }) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return { value: r.id, label: `${(p as { full_name?: string } | null)?.full_name ?? "Unnamed"} (${r.employee_code})` };
        })));
    }
    if (d) {
      supabase.from("hr_departments").select("id, name").order("name")
        .then(({ data }) => setDepartments((data ?? []).map((r) => ({ value: r.id, label: r.name }))));
    }
    if (j) {
      fetch("/api/hrms/records/jobs").then((r) => r.json())
        .then((json) => setJobs((json.records ?? []).map((r: { id: string; title: string }) => ({ value: r.id, label: r.title }))));
    }
    if (c) {
      fetch("/api/hrms/records/review-cycles").then((r) => r.json())
        .then((json) => setCycles((json.records ?? []).map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))));
    }
  }, [e, j, c, d]);

  return { employees, jobs, cycles, departments };
}
