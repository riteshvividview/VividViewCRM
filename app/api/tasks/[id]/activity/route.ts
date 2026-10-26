import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../../_lib/helpers";

/** Returns the persisted activity log for a task, newest first, with actor + referenced-user profiles resolved. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data: entries, error } = await admin
    .from("task_activity_log")
    .select("id, action, field_name, old_value, new_value, metadata, actor_id, created_at")
    .eq("task_id", id)
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIds = new Set<string>();
  for (const e of entries ?? []) {
    if (e.actor_id) userIds.add(e.actor_id);
    for (const value of [e.new_value, e.old_value]) {
      const ids = (value as Record<string, unknown> | null)?.user_ids;
      const id1 = (value as Record<string, unknown> | null)?.user_id;
      if (Array.isArray(ids)) for (const uid of ids) if (typeof uid === "string") userIds.add(uid);
      if (typeof id1 === "string") userIds.add(id1);
    }
  }

  const { data: profiles } = userIds.size > 0
    ? await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", Array.from(userIds))
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };

  const profileByUserId: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
  for (const p of profiles ?? []) profileByUserId[p.user_id] = { id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url };

  return NextResponse.json({ activity: entries ?? [], profiles: profileByUserId });
}
