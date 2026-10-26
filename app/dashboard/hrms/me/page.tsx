"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmployeeDetail } from "@/components/hrms/employee-detail";

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

  if (employeeId === undefined) {
    return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!employeeId) {
    return <p className="text-center py-16 text-sm text-muted-foreground">Your login isn&apos;t linked to an employee record yet. Please contact HR.</p>;
  }
  return <EmployeeDetail id={employeeId} />;
}
