"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TaskWorkspace } from "@/modules/tasks/components/task-workspace";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";

interface PageProps {
  params: { id: string };
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { tasks, projects } = useTasksContext();

  const project = projects.find((p) => p.id === params.id);
  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === params.id), [tasks, params.id]);

  return (
    <div>
      <PageHeader
        title={project?.name ?? "Project"}
        description={project?.description || `${projectTasks.length} task${projectTasks.length !== 1 ? "s" : ""}`}
        action={
          project?.color ? <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: project.color }} /> : undefined
        }
      />
      <TaskWorkspace tasks={projectTasks} />
    </div>
  );
}
