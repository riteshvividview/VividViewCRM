import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadProject } from "../../_lib";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const { data, error } = await r.admin.from("task_project_notes")
    .select("id, title, content, created_by, updated_by, created_at, updated_at")
    .eq("project_id", id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: data ?? [] });
}

/** POST { title?, content? } creates a note. PATCH { id, title?, content? } saves one. DELETE ?note_id= removes it. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const body = await request.json().catch(() => ({}));
  const { data, error } = await r.admin.from("task_project_notes").insert({
    workspace_id: r.ctx.workspaceId, project_id: id,
    title: (body.title ?? "").trim() || "Untitled", content: body.content ?? "",
    created_by: r.ctx.userId, updated_by: r.ctx.userId,
  }).select("id, title, content, created_by, updated_by, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ note: data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_by: r.ctx.userId, updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title.trim() || "Untitled";
  if (typeof body.content === "string") {
    if (body.content.length > 200_000) return NextResponse.json({ error: "Note is too long" }, { status: 400 });
    update.content = body.content;
  }
  const { data, error } = await r.admin.from("task_project_notes").update(update)
    .eq("id", body.id).eq("project_id", id)
    .select("id, title, content, created_by, updated_by, created_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ note: data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const noteId = request.nextUrl.searchParams.get("note_id");
  const { data: note } = await r.admin.from("task_project_notes").select("created_by").eq("id", noteId ?? "").eq("project_id", id).maybeSingle();
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  if (note.created_by !== r.ctx.userId && !r.canManage) return NextResponse.json({ error: "Only the author or project owner can delete this note" }, { status: 403 });
  await r.admin.from("task_project_notes").delete().eq("id", noteId!);
  return NextResponse.json({ ok: true });
}
