"use client";
import { useEffect, useState } from "react";

export function usePendingTaskCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tasks?status=todo,in_progress,waiting&limit=500");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        setCount((json.items ?? []).length);
      } catch {
        setCount(0);
      }
    }
    load();
  }, []);

  return count;
}
