"use client";

import { use } from "react";
import { EmployeeDetail } from "@/components/hrms/employee-detail";

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EmployeeDetail id={id} />;
}
