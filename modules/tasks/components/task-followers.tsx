"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskMember } from "../types";
import { AssigneeStack } from "./assignee-picker";

interface TaskFollowersProps {
  taskId: string;
  currentUserId: string | null;
}

/** Followers (watchers) row — avatar stack + follow/unfollow toggle for the current user. */
export function TaskFollowers({ taskId, currentUserId }: TaskFollowersProps) {
  const [watchers, setWatchers] = useState<TaskMember[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/watchers`);
      const json = await res.json();
      if (res.ok) setWatchers(json.watchers ?? []);
    } catch {}
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const isFollowing = currentUserId != null && watchers.some((w) => w.id === currentUserId);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/watchers`, {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok) setWatchers(json.watchers ?? []);
    } catch {}
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Followers</span>
      <div className="flex items-center gap-2">
        <AssigneeStack members={watchers} max={5} />
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 text-xs px-2 rounded-full border", isFollowing ? "border-purple-300 text-purple-700 dark:text-purple-300 dark:border-purple-700" : "border-border text-muted-foreground")}
          onClick={toggle}
          disabled={busy}
        >
          {isFollowing ? "Following" : "Follow"}
        </Button>
      </div>
    </div>
  );
}
