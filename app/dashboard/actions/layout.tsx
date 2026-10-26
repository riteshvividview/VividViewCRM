"use client";

import { TasksProvider } from "@/modules/tasks/context/tasks-context";

// The task app uses the main sidebar for navigation (Planner, Schedule, Tasks, Team, Projects),
// so pages get the full width the weekly planner needs.
export default function ActionsLayout({ children }: { children: React.ReactNode }) {
  return <TasksProvider>{children}</TasksProvider>;
}
