"use client";

import { Suspense, use } from "react";
import { TeamView } from "@/modules/tasks/components/team-view";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <TeamView key={id} teamId={id} />
    </Suspense>
  );
}
