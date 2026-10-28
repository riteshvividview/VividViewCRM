import { NextResponse } from "next/server";
import { adminClient, getAuthContext, isHR, type AuthContext } from "../_lib/helpers";

type Loaded = {
  ctx: AuthContext;
  admin: ReturnType<typeof adminClient>;
  project: { id: string; name: string; owner_id: string | null; workspace_id: string };
  /** Owner, project owner-role members and HR/super_admin can manage settings. */
  canManage: boolean;
};

/** Auth + workspace check for /api/tasks/projects/[id]/* routes. */
export async function loadProject(projectId: string): Promise<Loaded | { error: NextResponse }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = adminClient();
  const { data: project } = await admin.from("task_projects").select("id, name, owner_id, workspace_id")
    .eq("id", projectId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!project) return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };

  let canManage = isHR(ctx.role) || project.owner_id === ctx.userId;
  if (!canManage) {
    const { data: m } = await admin.from("task_project_members").select("role")
      .eq("project_id", projectId).eq("user_id", ctx.userId).maybeSingle();
    canManage = m?.role === "owner" || m?.role === "admin";
  }
  return { ctx, admin, project, canManage };
}
