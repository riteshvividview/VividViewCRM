"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TaskCalendar } from "@/modules/tasks/components/task-calendar";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";

export default function ActionsCalendarPage() {
  const { tasks, openTask, openQuickAdd } = useTasksContext();
  const [currentDate, setCurrentDate] = useState(new Date());

  const tasksWithDueDate = useMemo(() => tasks.filter((t) => t.due_date), [tasks]);

  function navigate(dir: 1 | -1) {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Tasks by due date"
        action={
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={openQuickAdd}>
            <Plus className="h-3.5 w-3.5" />New Task
          </Button>
        }
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-sm font-semibold text-foreground">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        </div>
        <TaskCalendar currentDate={currentDate} tasks={tasksWithDueDate} onTaskClick={openTask} />
      </div>
    </div>
  );
}
