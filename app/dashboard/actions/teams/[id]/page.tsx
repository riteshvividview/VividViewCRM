"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TaskWorkspace } from "@/modules/tasks/components/task-workspace";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";

interface PageProps {
  params: { id: string };
}

export default function TeamDetailPage({ params }: PageProps) {
  const { tasks, teams, members } = useTasksContext();

  const team = teams.find((t) => t.id === params.id);
  const memberSet = useMemo(() => new Set(team?.member_ids ?? []), [team]);

  const teamTasks = useMemo(
    () => tasks.filter((t) => t.assignees.some((a) => memberSet.has(a.id))),
    [tasks, memberSet]
  );

  const memberNames = useMemo(
    () => (team?.member_ids ?? []).map((id) => members.find((m) => m.id === id)?.full_name).filter(Boolean).join(", "),
    [team, members]
  );

  return (
    <div>
      <PageHeader
        title={team?.name ?? "Team"}
        description={memberNames || `${teamTasks.length} task${teamTasks.length !== 1 ? "s" : ""}`}
      />
      <TaskWorkspace tasks={teamTasks} />
    </div>
  );
}
