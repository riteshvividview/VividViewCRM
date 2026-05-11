"use client";
import { useEffect, useState } from "react";
import { MOCK_TASKS } from "./use-tasks";

export function usePendingTaskCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) {
        setCount(MOCK_TASKS.filter((t) => t.status !== "done").length);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const { count: c } = await createClient()
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .neq("status", "done");
      setCount(c ?? 0);
    }
    load();
  }, []);

  return count;
}
