import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadProject } from "../../_lib";

type Params = { params: Promise<{ id: string }> };

/** POST { user_ids: [...] } adds workspace members to the project. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  if (!r.canManage) return NextResponse.json({ error: "Only the project owner or HR can manage members" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
  const { data: valid } = await r.admin.from("profiles").select("user_id").eq("workspace_id", r.ctx.workspaceId).in("user_id", ids);
  if (!valid?.length) return NextResponse.json({ error: "No valid members" }, { status: 400 });

  const { error } = await r.admin.from("task_project_members").upsert(
    valid.map((v) => ({ project_id: id, user_id: v.user_id, workspace_id: r.ctx.workspaceId, role: "member" })),
    { onConflict: "project_id,user_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** DELETE ?user_id=… removes a member (the last owner cannot be removed). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  if (!r.canManage && userId !== r.ctx.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: owners } = await r.admin.from("task_project_members").select("user_id").eq("project_id", id).eq("role", "owner");
  if ((owners ?? []).length === 1 && owners![0].user_id === userId) {
    return NextResponse.json({ error: "The project owner cannot be removed" }, { status: 400 });
  }
  await r.admin.from("task_project_members").delete().eq("project_id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
