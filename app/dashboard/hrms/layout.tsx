import Link from "next/link";
import { ArrowLeft, Users } from "@/components/shared/fa-icons";
import { isComingSoonApp } from "@/lib/rbac/modules";

/** HRMS is switched off for now: every HRMS page shows this notice instead. */
export default function HrmsLayout({ children }: { children: React.ReactNode }) {
  if (!isComingSoonApp("hrms")) return <>{children}</>;
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-lg">
          <Users className="h-7 w-7" />
        </span>
        <p className="mt-6 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">Coming soon</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">HRMS is on its way</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Attendance, leave, payroll and the rest of HR are being finished. You will find them here once they are ready.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <ArrowLeft className="h-3.5 w-3.5" />Back to apps
        </Link>
      </div>
    </div>
  );
}
