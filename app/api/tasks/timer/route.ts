import { NextResponse } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";

/** The caller's running timer (if any), used for the global timer indicator. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await adminClient().from("task_time_entries")
    .select("id, task_id, started_at, task:tasks(id, title)")
    .eq("user_id", ctx.userId).eq("workspace_id", ctx.workspaceId).is("ended_at", null).maybeSingle();
  return NextResponse.json({ running: data ?? null });
}
