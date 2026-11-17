import { NextResponse } from "next/server";
import { adminClient, getAuthContext, isLead, type AuthContext } from "../_lib/helpers";

type Loaded = {
  ctx: AuthContext;
  admin: ReturnType<typeof adminClient>;
  project: { id: string; name: string; owner_id: string | null; workspace_id: string };
  /** The CEO and team leads manage brands. */
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

  return { ctx, admin, project, canManage: isLead(ctx.role) };
}
