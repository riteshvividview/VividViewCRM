"use client";

import { useRouter } from "next/navigation";
import { ReportBuilder } from "@/modules/reports/components/report-builder";
import { BuilderState } from "@/modules/reports/types";

export default function ReportBuilderPage() {
  const router = useRouter();

  function handleSave(state: BuilderState & { name: string }) {
    console.log("Saving report:", state);
    router.push("/dashboard/reports");
  }

  return <ReportBuilder onSave={handleSave} />;
}
