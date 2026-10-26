"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TaskWorkspace } from "@/modules/tasks/components/task-workspace";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import { RoleDashboardStrip } from "@/app/dashboard/_components/role-dashboard-strip";

export default function ActionsPage() {
  const { tasks, openQuickAdd } = useTasksContext();

  return (
    <div>
      <RoleDashboardStrip />
      <PageHeader
        title="Action Items"
        description={`${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">T</kbd> to quick add
            </Button>
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={openQuickAdd}>
              <Plus className="h-3.5 w-3.5" />New Task
            </Button>
          </div>
        }
      />

      <TaskWorkspace tasks={tasks} />
    </div>
  );
}
