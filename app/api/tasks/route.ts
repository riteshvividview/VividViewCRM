import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "./_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "./_lib/serialize";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const assigneeId = params.get("assignee_id");
  const projectId = params.get("project_id");
  const boardId = params.get("board_id");
  const search = params.get("search");
  const limit = Math.min(Number(params.get("limit")) || 200, 500);

  let query = admin.from("tasks").select(TASK_SELECT).eq("workspace_id", ctx.workspaceId);

  if (status) query = query.in("status", status.split(",").map((s) => s.trim()).filter(Boolean));
  if (projectId) query = query.eq("project_id", projectId);
  if (boardId) query = query.eq("board_id", boardId);
  if (search) query = query.ilike("title", `%${search}%`);

  if (assigneeId) {
    const { data: assigneeRows } = await admin.from("task_assignees").select("task_id").eq("user_id", assigneeId);
    const ids = (assigneeRows ?? []).map((r) => r.task_id);
    const orParts = [`assignee_id.eq.${assigneeId}`];
    if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = await attachRelations(admin, (data ?? []) as RawTask[]);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const admin = adminClient();

  const insertData: Record<string, unknown> = {
    title,
    description: body.description ?? "",
    status: body.status ?? "todo",
    priority: body.priority ?? "medium",
    due_date: body.due_date ?? null,
    linked_entity_type: body.linked_entity_type ?? null,
    linked_entity_id: body.linked_entity_id ?? null,
    linked_entity_name: body.linked_entity_name ?? null,
    parent_task_id: body.parent_task_id ?? null,
    sub_tasks: body.sub_tasks ?? [],
    recurring_pattern: body.recurring_pattern ?? null,
    tags: body.tags ?? [],
    project_id: body.project_id ?? null,
    board_id: body.board_id ?? null,
    estimated_hours: body.estimated_hours ?? null,
    created_by: ctx.userId,
    workspace_id: ctx.workspaceId,
  };

  // Resolve assignees: explicit user_ids plus optional team expansion (team leader -> whole team)
  const assigneeUserIds = new Set<string>(Array.isArray(body.assignee_ids) ? body.assignee_ids : []);
  if (body.team_id) {
    const { data: members } = await admin.from("team_members").select("user_id").eq("team_id", body.team_id);
    for (const m of members ?? []) assigneeUserIds.add(m.user_id);
  }
  const assigneeIds = Array.from(assigneeUserIds);

  if (assigneeIds.length > 0) {
    insertData.assignee_id = assigneeIds[0];
    const { data: firstProfile } = await admin.from("profiles").select("full_name").eq("user_id", assigneeIds[0]).maybeSingle();
    insertData.assignee_name = firstProfile?.full_name ?? null;
  }

  const { data: task, error } = await admin.from("tasks").insert(insertData).select(TASK_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (assigneeIds.length > 0) {
    await admin.from("task_assignees").insert(
      assigneeIds.map((userId) => ({ task_id: task.id, user_id: userId, assigned_by: ctx.userId }))
    );
  }

  const labelIds: string[] = Array.isArray(body.label_ids) ? body.label_ids : [];
  if (labelIds.length > 0) {
    await admin.from("task_label_assignments").insert(
      labelIds.map((labelId) => ({ task_id: task.id, label_id: labelId, assigned_by: ctx.userId }))
    );
  }

  await admin.from("task_activity_log").insert({
    task_id: task.id,
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    action: "created",
  });

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}
