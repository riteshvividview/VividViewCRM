"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Wraps any HR-only page. Redirects non-HR users to /dashboard/access-denied.
 * Shows a spinner while checking — never flashes protected content.
 */
export function HRGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role ?? "employee";
      if (["super_admin", "hr"].includes(role)) {
        setStatus("ok");
      } else {
        setStatus("denied");
        router.replace("/dashboard/access-denied");
      }
    })();
  }, [router]);

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "denied") return null;

  return <>{children}</>;
}
