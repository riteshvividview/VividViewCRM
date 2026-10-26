import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadProject } from "../../_lib";
import { notifyUsers } from "../../../_lib/notify";

type Params = { params: Promise<{ id: string }> };

/** Project chat. GET ?after=<iso> returns only newer messages (used for polling). */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;

  let q = r.admin.from("task_project_messages").select("id, author_id, body, created_at, edited_at").eq("project_id", id);
  const after = request.nextUrl.searchParams.get("after");
  if (after) q = q.gt("created_at", after);
  const { data, error } = await q.order("created_at", { ascending: true }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const authorIds = [...new Set((data ?? []).map((m) => m.author_id).filter(Boolean))] as string[];
  const { data: profiles } = authorIds.length
    ? await r.admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds)
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return NextResponse.json({
    messages: (data ?? []).map((m) => ({
      ...m,
      author: m.author_id ? { id: m.author_id, full_name: byId.get(m.author_id)?.full_name ?? "Unknown", avatar_url: byId.get(m.author_id)?.avatar_url ?? null } : null,
      mine: m.author_id === r.ctx.userId,
    })),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const { data, error } = await r.admin.from("task_project_messages").insert({
    workspace_id: r.ctx.workspaceId, project_id: id, author_id: r.ctx.userId, body: text,
  }).select("id, author_id, body, created_at, edited_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // @mentions by name notify the mentioned project members.
  if (text.includes("@")) {
    const { data: members } = await r.admin.from("task_project_members").select("user_id").eq("project_id", id);
    const ids = (members ?? []).map((m) => m.user_id).filter((u) => u !== r.ctx.userId);
    if (ids.length) {
      const { data: profiles } = await r.admin.from("profiles").select("user_id, full_name").in("user_id", ids);
      const mentioned = (profiles ?? []).filter((p) => p.full_name && text.toLowerCase().includes(`@${p.full_name.toLowerCase()}`));
      await notifyUsers(r.admin, r.ctx.workspaceId, mentioned.map((p) => p.user_id), {
        type: "mention", title: `Mentioned in ${r.project.name}`, body: text.slice(0, 140), entity_type: "project", entity_id: id,
      }).catch(() => {});
    }
  }
  return NextResponse.json({ message: { ...data, mine: true, author: null } });
}

/** DELETE ?message_id= — authors (or project owners) can remove a message. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;
  const messageId = request.nextUrl.searchParams.get("message_id") ?? "";
  const { data: msg } = await r.admin.from("task_project_messages").select("author_id").eq("id", messageId).eq("project_id", id).maybeSingle();
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (msg.author_id !== r.ctx.userId && !r.canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await r.admin.from("task_project_messages").delete().eq("id", messageId);
  return NextResponse.json({ ok: true });
}
