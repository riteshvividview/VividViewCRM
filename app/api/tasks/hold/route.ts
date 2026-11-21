import { NextResponse } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { workspacePeople } from "../_lib/serialize";
import { maybeSendHoldDigest } from "../_lib/hold";

/** GET: every task on hold, with who held it, when and why (CEO only). */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "super_admin") return NextResponse.json({ error: "Not found" }, { status: 403 });
  const admin = adminClient();
  const [{ data, error }, people] = await Promise.all([
    admin.from("tasks")
      .select("id, title, number, status, priority, due_date, hold_at, hold_by, hold_reason, project:task_projects!project_id(id, name, color, key), team:teams!team_id(id, name, color), assignee_rows:task_assignees(user_id), file_rows:task_attachments(kind)")
      .eq("workspace_id", ctx.workspaceId).not("hold_at", "is", null).is("deleted_at", null)
      .order("hold_at", { ascending: false }),
    workspacePeople(admin, ctx.workspaceId),
  ]);
  if (error) return NextResponse.json({ error: "Run RUN-ME-57-task-on-hold.sql in Supabase first." }, { status: 400 });
  await maybeSendHoldDigest(admin, ctx.workspaceId).catch(() => false);
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const items = (data ?? []).map((t) => {
    const p = one(t.project) as { name: string; color: string | null; key: string | null } | null;
    return {
      id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date,
      code: p?.key && t.number ? `${p.key}-${t.number}` : null,
      brand: p ? { name: p.name, color: p.color } : null,
      team: one(t.team) as { name: string; color: string | null } | null,
      hold_at: t.hold_at, hold_reason: t.hold_reason,
      held_by: t.hold_by ? people.get(t.hold_by) ?? null : null,
      assignees: ((t.assignee_rows ?? []) as { user_id: string }[]).map((a) => people.get(a.user_id)).filter(Boolean),
      files: ((t.file_rows ?? []) as unknown[]).length,
    };
  });
  return NextResponse.json({ items });
}
