"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useTasksContext } from "@/modules/tasks/context/tasks-context";
import type { TaskTeam } from "@/modules/tasks/types";

export default function TeamsPage() {
  const { tasks, teams } = useTasksContext();

  function taskCount(team: TaskTeam) {
    return tasks.filter((t) => t.assignees.some((a) => team.member_ids.includes(a.id))).length;
  }

  return (
    <div>
      <PageHeader title="Teams" description={`${teams.length} team${teams.length !== 1 ? "s" : ""}`} />

      {teams.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No teams yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const count = taskCount(team);
            return (
              <Link
                key={team.id}
                href={`/dashboard/actions/teams/${team.id}`}
                className="block bg-card border border-border rounded-2xl p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-foreground truncate flex-1">{team.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{team.member_ids.length} member{team.member_ids.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">{count} task{count !== 1 ? "s" : ""}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
