"use client";

import { use } from "react";
import { TeamPlanner } from "@/modules/tasks/components/team-planner";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TeamPlanner teamId={id} />;
}
