"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLogo } from "@/components/shared/auth-logo";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/login");
  }, [router]);

  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center gap-4">
          <AuthLogo />
          <p className="text-sm text-muted-foreground text-center">
            Account creation is by invitation only.
            <br />
            Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
