import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureProjectBoard } from "../../_lib/board";
import { loadProject } from "../_lib";

type Params = { params: Promise<{ id: string }> };

/** Project with its board columns and members. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const { ctx, admin, canManage } = r;

  const [{ data: project }, board, { data: members }] = await Promise.all([
    admin.from("task_projects").select("id, name, description, status, color, icon, team_id, archived_at, owner_id, start_date, end_date, created_at").eq("id", id).single(),
    ensureProjectBoard(admin, ctx.workspaceId, id, ctx.userId),
    admin.from("task_project_members").select("user_id, role, added_at").eq("project_id", id),
  ]);

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return NextResponse.json({
    project,
    board_id: board.boardId,
    columns: board.columns,
    members: (members ?? []).map((m) => ({
      id: m.user_id, role: m.role, full_name: byId.get(m.user_id)?.full_name ?? "Unknown", avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
    })),
    can_manage: canManage,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  if (!r.canManage) return NextResponse.json({ error: "Only the project owner or HR can change project settings" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const k of ["name", "description", "color", "icon", "status", "start_date", "end_date", "team_id"]) {
    if (k in body) update[k] = body[k] === "" ? null : body[k];
  }
  if ("archived" in body) update.archived_at = body.archived ? new Date().toISOString() : null;
  if (typeof update.name === "string" && !update.name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const { data, error } = await r.admin.from("task_projects").update(update).eq("id", id)
    .select("id, name, description, status, color, icon, team_id, archived_at, owner_id, start_date, end_date, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data });
}

/** Permanently deletes the project. Its tasks are kept but unlinked from the project. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  if (!r.canManage) return NextResponse.json({ error: "Only the project owner or HR can delete a project" }, { status: 403 });

  await r.admin.from("tasks").update({ project_id: null, board_id: null, board_column_id: null }).eq("project_id", id);
  const { error } = await r.admin.from("task_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
