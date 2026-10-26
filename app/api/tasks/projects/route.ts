import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { ensureProjectBoard } from "../_lib/board";

const PROJECT_SELECT = "id, name, description, status, color, icon, team_id, archived_at, owner_id, created_at";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  let q = admin.from("task_projects").select(PROJECT_SELECT).eq("workspace_id", ctx.workspaceId);
  if (request.nextUrl.searchParams.get("archived") !== "1") q = q.is("archived_at", null);
  const { data, error } = await q.order("position").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Open/total task counts for the project list
  const ids = (data ?? []).map((p) => p.id);
  const counts = new Map<string, { open: number; total: number }>();
  if (ids.length) {
    const { data: rows } = await admin.from("tasks").select("project_id, status").in("project_id", ids);
    for (const r of rows ?? []) {
      const c = counts.get(r.project_id) ?? { open: 0, total: 0 };
      c.total++;
      if (r.status !== "done") c.open++;
      counts.set(r.project_id, c);
    }
  }

  return NextResponse.json({
    projects: (data ?? []).map((p) => ({ ...p, task_count: counts.get(p.id)?.total ?? 0, open_count: counts.get(p.id)?.open ?? 0 })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("task_projects")
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      description: body.description ?? null,
      team_id: body.team_id || null,
      color: body.color ?? "#6366f1",
      icon: body.icon ?? null,
      owner_id: ctx.userId,
      created_by: ctx.userId,
      position: Date.now() % 2147483647,
    })
    .select(PROJECT_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Default board + status columns, and the creator (plus chosen members / team) as project members.
  await ensureProjectBoard(admin, ctx.workspaceId, data.id, ctx.userId);
  const memberIds = new Set<string>([ctx.userId, ...(Array.isArray(body.member_ids) ? body.member_ids : [])]);
  if (body.team_id) {
    const { data: tm } = await admin.from("team_members").select("user_id").eq("team_id", body.team_id);
    for (const m of tm ?? []) memberIds.add(m.user_id);
  }
  const { data: valid } = await admin.from("profiles").select("user_id")
    .eq("workspace_id", ctx.workspaceId).in("user_id", Array.from(memberIds));
  if (valid?.length) {
    await admin.from("task_project_members").upsert(valid.map((v) => ({
      project_id: data.id, user_id: v.user_id, workspace_id: ctx.workspaceId, role: v.user_id === ctx.userId ? "owner" : "member",
    })));
  }

  return NextResponse.json({ project: { ...data, task_count: 0, open_count: 0 } });
}
