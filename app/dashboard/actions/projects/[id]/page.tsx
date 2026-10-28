"use client";

import { Suspense, use } from "react";
import { ProjectView } from "@/modules/tasks/components/project-view";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ProjectView key={id} projectId={id} />
    </Suspense>
  );
}
