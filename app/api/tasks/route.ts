import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "./_lib/helpers";
import { TASK_SELECT, attachRelations, type RawTask } from "./_lib/serialize";
import { columnForStatus, ensureProjectBoard, type StatusKey } from "./_lib/board";
import { RECURRING_PATTERNS } from "./_lib/recurrence";
import { notifyUsers } from "./_lib/notify";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: StatusKey[] = ["todo", "in_progress", "waiting", "done"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

/**
 * GET filters: status, assignee_id, project_id, search, limit,
 * planned_from / planned_to (planner week), unscheduled=1 (waiting list), include_done=0.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const assigneeId = params.get("assignee_id");
  const projectId = params.get("project_id");
  const search = params.get("search");
  const plannedFrom = params.get("planned_from");
  const plannedTo = params.get("planned_to");
  const limit = Math.min(Number(params.get("limit")) || 500, 1000);

  let query = admin.from("tasks").select(TASK_SELECT).eq("workspace_id", ctx.workspaceId);

  if (status) query = query.in("status", status.split(",").map((s) => s.trim()).filter(Boolean));
  if (params.get("include_done") === "0") query = query.neq("status", "done");
  if (projectId) query = query.eq("project_id", projectId);
  if (search) query = query.ilike("title", `%${search.replace(/[%_]/g, "")}%`);
  if (params.get("unscheduled") === "1") query = query.is("planned_date", null);
  if (plannedFrom && DATE_RE.test(plannedFrom)) query = query.gte("planned_date", plannedFrom);
  if (plannedTo && DATE_RE.test(plannedTo)) query = query.lte("planned_date", plannedTo);

  if (assigneeId) {
    const { data: assigneeRows } = await admin.from("task_assignees").select("task_id").eq("user_id", assigneeId);
    const ids = (assigneeRows ?? []).map((r) => r.task_id);
    const orParts = [`assignee_id.eq.${assigneeId}`];
    if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = await attachRelations(admin, (data ?? []) as RawTask[]);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (title.length > 500) return NextResponse.json({ error: "Title is too long" }, { status: 400 });

  for (const f of ["due_date", "planned_date", "start_date"]) {
    if (body[f] && !DATE_RE.test(body[f])) return NextResponse.json({ error: `Invalid ${f}` }, { status: 400 });
  }
  if (body.recurring_pattern && !RECURRING_PATTERNS.includes(body.recurring_pattern)) {
    return NextResponse.json({ error: "Invalid repeat pattern" }, { status: 400 });
  }

  const admin = adminClient();
  let status: StatusKey = STATUSES.includes(body.status) ? body.status : "todo";
  let boardId: string | null = null;
  let columnId: string | null = null;

  // Project tasks live in a column of the project's board; the column decides the base status.
  if (body.project_id) {
    const { data: project } = await admin.from("task_projects").select("id")
      .eq("id", body.project_id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    const { boardId: bId, columns } = await ensureProjectBoard(admin, ctx.workspaceId, project.id, ctx.userId);
    boardId = bId;
    const col = body.board_column_id ? columns.find((c) => c.id === body.board_column_id) : columnForStatus(columns, status);
    if (!col) return NextResponse.json({ error: "Status column not found" }, { status: 400 });
    columnId = col.id;
    status = col.status_key;
  }

  const insertData: Record<string, unknown> = {
    title,
    description: body.description ?? "",
    status,
    priority: PRIORITIES.includes(body.priority) ? body.priority : "medium",
    due_date: body.due_date || null,
    planned_date: body.planned_date || null,
    start_date: body.start_date || null,
    color: body.color || null,
    linked_entity_type: body.linked_entity_type ?? null,
    linked_entity_id: body.linked_entity_id ?? null,
    linked_entity_name: body.linked_entity_name ?? null,
    parent_task_id: body.parent_task_id ?? null,
    sub_tasks: Array.isArray(body.sub_tasks) ? body.sub_tasks : [],
    recurring_pattern: body.recurring_pattern || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    project_id: body.project_id ?? null,
    board_id: boardId,
    board_column_id: columnId,
    estimated_hours: body.estimated_hours ?? null,
    position: Number.isFinite(body.position) ? body.position : Date.now() % 2147483647,
    completed_at: status === "done" ? new Date().toISOString() : null,
    created_by: ctx.userId,
    workspace_id: ctx.workspaceId,
  };

  // Assignees: explicit user ids plus optional whole-team expansion; default to the creator.
  const assigneeUserIds = new Set<string>(Array.isArray(body.assignee_ids) ? body.assignee_ids : []);
  if (body.team_id) {
    const { data: members } = await admin.from("team_members").select("user_id").eq("team_id", body.team_id);
    for (const m of members ?? []) assigneeUserIds.add(m.user_id);
  }
  if (assigneeUserIds.size === 0 && body.assign_to_me !== false) assigneeUserIds.add(ctx.userId);

  // Only workspace members can be assigned.
  const { data: validProfiles } = await admin.from("profiles").select("user_id, full_name")
    .eq("workspace_id", ctx.workspaceId).in("user_id", Array.from(assigneeUserIds));
  const assigneeIds = (validProfiles ?? []).map((p) => p.user_id);
  if (assigneeIds.length > 0) {
    insertData.assignee_id = assigneeIds[0];
    insertData.assignee_name = validProfiles?.find((p) => p.user_id === assigneeIds[0])?.full_name ?? null;
  }

  const { data: task, error } = await admin.from("tasks").insert(insertData).select(TASK_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await Promise.all([
    assigneeIds.length > 0
      ? admin.from("task_assignees").insert(assigneeIds.map((userId) => ({ task_id: task.id, user_id: userId, assigned_by: ctx.userId })))
      : Promise.resolve(),
    Array.isArray(body.label_ids) && body.label_ids.length > 0
      ? admin.from("task_label_assignments").insert(body.label_ids.map((labelId: string) => ({ task_id: task.id, label_id: labelId, assigned_by: ctx.userId })))
      : Promise.resolve(),
    admin.from("task_activity_log").insert({ task_id: task.id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "created" }),
  ]);

  await notifyUsers(admin, ctx.workspaceId, assigneeIds.filter((id) => id !== ctx.userId), {
    type: "task_assigned", title: "New task assigned", body: title, entity_type: "task", entity_id: task.id,
  }).catch(() => {});

  const [serialized] = await attachRelations(admin, [task as RawTask]);
  return NextResponse.json({ task: serialized });
}
