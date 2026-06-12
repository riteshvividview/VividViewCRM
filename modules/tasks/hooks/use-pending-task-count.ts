"use client";
import { useEffect, useState } from "react";
import { MOCK_TASKS } from "./use-tasks";
import { api } from "@/lib/api-client";

export function usePendingTaskCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        // Use the NestJS count endpoint (status filter excludes done/cancelled)
        const result = await api.get<{ total: number }>("/tasks", {
          status: "todo,in_progress,in_review,blocked,waiting",
          limit: 1,
        });
        setCount((result as { total: number }).total ?? 0);
      } catch {
        // Fallback: count from mock data
        setCount(MOCK_TASKS.filter((t) => t.status !== "done").length);
      }
    }
    load();
  }, []);

  return count;
}
