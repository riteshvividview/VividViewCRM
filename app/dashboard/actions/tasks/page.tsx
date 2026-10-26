"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TaskWorkspace } from "@/modules/tasks/components/task-workspace";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";

/** Every task in the workspace — board, table, timeline and list views with filters. */
export default function AllTasksPage() {
  const { tasks, openQuickAdd } = useTasksContext();

  return (
    <div>
      <PageHeader
        title="All tasks"
        description={`${tasks.length} task${tasks.length !== 1 ? "s" : ""} · press T anywhere to add one`}
        action={<Button size="sm" onClick={() => openQuickAdd()}><Plus className="h-4 w-4 mr-1.5" />New task</Button>}
      />
      <TaskWorkspace tasks={tasks} />
    </div>
  );
}
