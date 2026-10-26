"use client";

import { use } from "react";
import { ProjectView } from "@/modules/tasks/components/project-view";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectView key={id} projectId={id} />;
}
