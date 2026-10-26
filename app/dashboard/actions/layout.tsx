"use client";

import { TasksProvider } from "@/modules/tasks/context/tasks-context";
import { TasksSidebar } from "@/modules/tasks/components/tasks-sidebar";

export default function ActionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      <div className="flex gap-6">
        <TasksSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </TasksProvider>
  );
}
