"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PayslipView, MONTHS } from "@/components/hrms/payslip-view";
import { fmtINR } from "@/components/hrms/resource-manager";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slip = Record<string, any>;

export default function MyPayslipsPage() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [selected, setSelected] = useState<Slip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hrms/payroll/payslips").then((r) => r.json()).then((json) => {
      setSlips(json.payslips ?? []);
      setSelected(json.payslips?.[0] ?? null);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Payslips"
        subtitle="Monthly salary statements"
        actions={selected && <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" />Print / PDF</Button>}
      />
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : slips.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No payslips yet. They appear here once HR approves a payroll run.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            {slips.map((s) => (
              <button key={s.id} onClick={() => setSelected(s)}
                className={cn("w-full text-left rounded-lg px-3 py-2 text-sm", selected?.id === s.id ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30" : "hover:bg-muted")}>
                <p className="font-medium">{MONTHS[s.month - 1]} {s.year}</p>
                <p className="text-xs text-muted-foreground">{fmtINR(s.net_salary)}</p>
              </button>
            ))}
          </div>
          {selected && <PayslipView slip={selected} />}
        </div>
      )}
    </div>
  );
}
