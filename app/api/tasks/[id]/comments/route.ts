import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../../_lib/helpers";
import { notifyUsers } from "../../_lib/notify";
import type { TaskMember } from "../../_lib/serialize";

interface RawComment {
  id: string;
  task_id: string;
  body: string;
  author_id: string;
  parent_comment_id: string | null;
  edited_at: string | null;
  created_at: string;
  attachment_ids?: string[] | null;
}

interface ChatAttachment { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; url: string | null }

/** Resolves chat attachments (with 1h signed URLs) for a set of comments. */
async function attachmentsFor(admin: ReturnType<typeof adminClient>, taskId: string, comments: RawComment[]) {
  const ids = [...new Set(comments.flatMap((c) => c.attachment_ids ?? []))];
  const map = new Map<string, ChatAttachment>();
  if (!ids.length) return map;
  const { data } = await admin.from("task_attachments").select("id, file_path, file_name, mime_type, size_bytes").eq("task_id", taskId).in("id", ids);
  const paths = (data ?? []).map((a) => a.file_path);
  const { data: signed } = paths.length ? await admin.storage.from("task-attachments").createSignedUrls(paths, 3600) : { data: [] };
  const urlByPath = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  for (const a of data ?? []) map.set(a.id, { id: a.id, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes, url: urlByPath.get(a.file_path) ?? null });
  return map;
}

async function profilesByUserId(admin: ReturnType<typeof adminClient>, userIds: string[]) {
  const { data } = userIds.length > 0
    ? await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null }[] };
  const map = new Map<string, TaskMember>();
  for (const p of data ?? []) map.set(p.user_id, { id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url });
  return map;
}

function serializeComment(c: RawComment, profileByUserId: Map<string, TaskMember>, files = new Map<string, ChatAttachment>()) {
  return {
    attachments: (c.attachment_ids ?? []).map((id) => files.get(id)).filter(Boolean),
    id: c.id,
    task_id: c.task_id,
    body: c.body,
    author: profileByUserId.get(c.author_id) ?? null,
    parent_comment_id: c.parent_comment_id,
    edited_at: c.edited_at,
    created_at: c.created_at,
  };
}

/** Lists non-deleted comments for a task, oldest first, with author profiles resolved. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data: comments, error } = await admin
    .from("task_comments")
    .select("id, task_id, body, author_id, parent_comment_id, edited_at, created_at, attachment_ids")
    .eq("task_id", id)
    .eq("workspace_id", ctx.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const profileByUserId = await profilesByUserId(admin, [...new Set((comments ?? []).map((c) => c.author_id))]);

  const files = await attachmentsFor(admin, id, (comments ?? []) as RawComment[]);
  return NextResponse.json({ comments: (comments ?? []).map((c) => serializeComment(c as RawComment, profileByUserId, files)) });
}

/** Adds a comment to a task. Parses @mentions of workspace members and notifies them. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id, title").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await request.json();
  const text: string = typeof body.body === "string" ? body.body.trim() : "";
  // Files must already be uploaded to this task (POST /attachments) before being sent in chat.
  const requestedFiles: string[] = Array.isArray(body.attachment_ids) ? body.attachment_ids : [];
  const { data: validFiles } = requestedFiles.length
    ? await admin.from("task_attachments").select("id").eq("task_id", id).in("id", requestedFiles)
    : { data: [] as { id: string }[] };
  const attachmentIds = (validFiles ?? []).map((f) => f.id);
  if (!text && !attachmentIds.length) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const { data: comment, error } = await admin
    .from("task_comments")
    .insert({ task_id: id, workspace_id: ctx.workspaceId, author_id: ctx.userId, body: text, attachment_ids: attachmentIds })
    .select("id, task_id, body, author_id, parent_comment_id, edited_at, created_at, attachment_ids")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Resolve @mentions against workspace members.
  const { data: members } = await admin.from("profiles").select("user_id, full_name, avatar_url").eq("workspace_id", ctx.workspaceId);
  const lowerText = text.toLowerCase();
  const mentioned = (members ?? []).filter(
    (m) => m.user_id !== ctx.userId && m.full_name && lowerText.includes(`@${m.full_name.toLowerCase()}`)
  );

  if (mentioned.length > 0) {
    await admin.from("task_mentions").insert(
      mentioned.map((m) => ({ comment_id: comment.id, task_id: id, workspace_id: ctx.workspaceId, mentioned_user_id: m.user_id }))
    );

    const actor = (members ?? []).find((m) => m.user_id === ctx.userId);
    await notifyUsers(admin, ctx.workspaceId, mentioned.map((m) => m.user_id), {
      type: "mention",
      title: `${actor?.full_name ?? "Someone"} mentioned you`,
      body: `On "${task.title}": ${text.length > 140 ? `${text.slice(0, 140)}…` : text}`,
      entity_type: "task",
      entity_id: id,
    });
  }

  // Followers (watchers) hear about every new message, except the author and anyone already @mentioned.
  const { data: watchers } = await admin.from("task_watchers").select("user_id").eq("task_id", id);
  const skip = new Set([ctx.userId, ...mentioned.map((m) => m.user_id)]);
  const author = (members ?? []).find((m) => m.user_id === ctx.userId);
  await notifyUsers(admin, ctx.workspaceId, (watchers ?? []).map((w) => w.user_id).filter((u) => !skip.has(u)), {
    type: "task_assigned",
    title: `New message on "${task.title}"`,
    body: `${author?.full_name ?? "Someone"}: ${text ? (text.length > 120 ? text.slice(0, 120) + "…" : text) : "sent a file"}`,
    entity_type: "task",
    entity_id: id,
  }).catch(() => {});

  const profileByUserId = await profilesByUserId(admin, [ctx.userId]);
  const files = await attachmentsFor(admin, id, [comment as RawComment]);
  return NextResponse.json({ comment: serializeComment(comment as RawComment, profileByUserId, files) });
}
