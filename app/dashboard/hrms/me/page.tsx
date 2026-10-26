"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmployeeDetailPage from "../employees/[id]/page";

/** The signed-in employee's own HR record (read-only unless they are HR). */
export default function MyHrProfilePage() {
  const [employeeId, setEmployeeId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setEmployeeId(null);
      const { data } = await supabase.from("hr_employees").select("id").eq("user_id", user.id).maybeSingle();
      setEmployeeId(data?.id ?? null);
    });
  }, []);

  // Stable promise so the page's `use(params)` doesn't re-suspend on every render.
  const params = useMemo(() => (employeeId ? Promise.resolve({ id: employeeId }) : null), [employeeId]);

  if (employeeId === undefined) {
    return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!params) {
    return <p className="text-center py-16 text-sm text-muted-foreground">Your login isn&apos;t linked to an employee record yet. Please contact HR.</p>;
  }
  return <EmployeeDetailPage params={params} />;
}
