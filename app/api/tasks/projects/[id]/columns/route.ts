import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COLUMN_SELECT, ensureProjectBoard, type StatusKey } from "../../../_lib/board";
import { loadProject } from "../../_lib";

type Params = { params: Promise<{ id: string }> };
const STATUS_KEYS: StatusKey[] = ["todo", "in_progress", "waiting", "done"];

/** Add a custom status column. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const { ctx, admin } = r;

  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const status_key: StatusKey = STATUS_KEYS.includes(body.status_key) ? body.status_key : "in_progress";

  const { boardId, columns } = await ensureProjectBoard(admin, ctx.workspaceId, id, ctx.userId);
  const { data, error } = await admin.from("task_board_columns").insert({
    board_id: boardId, workspace_id: ctx.workspaceId, name, color: body.color ?? "#94a3b8",
    position: columns.length ? Math.max(...columns.map((c) => c.position)) + 1 : 0,
    status_key, is_done_column: status_key === "done",
  }).select(COLUMN_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ column: data });
}

/**
 * PATCH { id, name?, color?, status_key? } updates one column;
 * PATCH { order: [columnId…] } reorders all columns.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const { ctx, admin } = r;
  const { columns } = await ensureProjectBoard(admin, ctx.workspaceId, id, ctx.userId);
  const body = await request.json().catch(() => ({}));

  if (Array.isArray(body.order)) {
    const valid = body.order.filter((cid: string) => columns.some((c) => c.id === cid));
    await Promise.all(valid.map((cid: string, i: number) => admin.from("task_board_columns").update({ position: i }).eq("id", cid)));
    return NextResponse.json({ ok: true });
  }

  const col = columns.find((c) => c.id === body.id);
  if (!col) return NextResponse.json({ error: "Column not found" }, { status: 404 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    update.name = body.name.trim();
  }
  if (typeof body.color === "string") update.color = body.color;
  if (STATUS_KEYS.includes(body.status_key)) {
    update.status_key = body.status_key;
    update.is_done_column = body.status_key === "done";
  }
  const { data, error } = await admin.from("task_board_columns").update(update).eq("id", col.id).select(COLUMN_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Base status of tasks in the column follows the column.
  if (update.status_key) {
    await admin.from("tasks").update({
      status: update.status_key,
      completed_at: update.status_key === "done" ? new Date().toISOString() : null,
    }).eq("board_column_id", col.id).neq("status", update.status_key as string);
  }
  return NextResponse.json({ column: data });
}

/** DELETE ?column_id=… — tasks in it move to the first remaining column. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const { ctx, admin } = r;
  const columnId = request.nextUrl.searchParams.get("column_id");
  const { columns } = await ensureProjectBoard(admin, ctx.workspaceId, id, ctx.userId);
  const col = columns.find((c) => c.id === columnId);
  if (!col) return NextResponse.json({ error: "Column not found" }, { status: 404 });
  if (columns.length <= 1) return NextResponse.json({ error: "A project needs at least one status" }, { status: 400 });

  const fallback = columns.find((c) => c.id !== col.id)!;
  await admin.from("tasks").update({ board_column_id: fallback.id, status: fallback.status_key }).eq("board_column_id", col.id);
  const { error } = await admin.from("task_board_columns").delete().eq("id", col.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, moved_to: fallback.id });
}
