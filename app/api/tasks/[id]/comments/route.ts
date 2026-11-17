import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import { broadcast, notifyUsers } from "../../_lib/notify";
import type { TaskMember } from "../../_lib/serialize";
import { downloadUrls, signedUrls, type FileStore } from "../../_lib/files";
import { withAttachments } from "@/modules/notifications/body";
import { canAccessTask, canReadTask } from "../../_lib/teams";

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

interface ChatAttachment { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; url: string | null; download_url: string | null; purged: boolean }

/** Resolves chat attachments (with 1h signed URLs) for a set of comments. */
async function attachmentsFor(admin: ReturnType<typeof adminClient>, taskId: string, comments: RawComment[]) {
  const ids = [...new Set(comments.flatMap((c) => c.attachment_ids ?? []))];
  const map = new Map<string, ChatAttachment>();
  if (!ids.length) return map;
  const { data } = await admin.from("task_attachments").select("id, file_path, storage, file_name, mime_type, size_bytes, purged_at").eq("task_id", taskId).in("id", ids);
  const stored = (data ?? []) as { file_path: string | null; storage: FileStore; file_name: string }[];
  const [urlByPath, downloadByPath] = await Promise.all([signedUrls(admin, stored), downloadUrls(admin, stored)]);
  for (const a of data ?? []) {
    map.set(a.id, {
      id: a.id, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes,
      url: a.file_path ? urlByPath.get(a.file_path) ?? null : null,
      download_url: a.file_path ? downloadByPath.get(a.file_path) ?? null : null, purged: !!a.purged_at,
    });
  }
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

/**
 * Lists non-deleted comments for a task, oldest first, with author profiles resolved.
 * ?after=<ISO time> returns only messages newer than that (live updates fetch just the new ones).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task || !(await canReadTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const after = request.nextUrl.searchParams.get("after");
  let q = admin
    .from("task_comments")
    .select("id, task_id, body, author_id, parent_comment_id, edited_at, created_at, attachment_ids")
    .eq("task_id", id)
    .eq("workspace_id", ctx.workspaceId)
    .is("deleted_at", null);
  // Compared as given: message times have microseconds that a JavaScript date would drop.
  if (after && /^\d{4}-\d{2}-\d{2}[T ][\d:.]+([+-]\d{2}:?\d{2}|Z)?$/.test(after)) q = q.gt("created_at", after);
  const { data: comments, error } = await q.order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const profileByUserId = await profilesByUserId(admin, [...new Set((comments ?? []).map((c) => c.author_id))]);

  const files = await attachmentsFor(admin, id, (comments ?? []) as RawComment[]);
  return NextResponse.json({ comments: (comments ?? []).map((c) => serializeComment(c as RawComment, profileByUserId, files)) });
}

/** Adds a comment to a task. Parses @mentions of workspace members and notifies them. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  syncWorkspace(ctx.workspaceId, () => ({ tasks: [id] }));

  const { id } = await params;
  const admin = adminClient();

  const { data: task } = await admin.from("tasks").select("id, title, created_by, assignee_id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task || !(await canAccessTask(admin, ctx, id))) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await request.json();
  const text: string = typeof body.body === "string" ? body.body.trim() : "";
  // Files must already be uploaded to this task (POST /attachments) before being sent in chat.
  const requestedFiles: string[] = Array.isArray(body.attachment_ids) ? body.attachment_ids : [];
  const { data: validFiles } = requestedFiles.length
    ? await admin.from("task_attachments").select("id, file_name").eq("task_id", id).eq("kind", "chat").in("id", requestedFiles)
    : { data: [] as { id: string; file_name: string }[] };
  const fileNames = (validFiles ?? []).map((f) => f.file_name);
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
      body: withAttachments(`On "${task.title}": ${text.length > 140 ? `${text.slice(0, 140)}…` : text}`, fileNames),
      entity_type: "task_message",
      entity_id: id,
    });
  }

  // Only the people on the task (its creator and assignees) hear about new messages; anyone
  // else is told only when @mentioned (handled above). Team members who merely see the task
  // on a board are never notified.
  const { data: assignees } = await admin.from("task_assignees").select("user_id").eq("task_id", id);
  const skip = new Set([ctx.userId, ...mentioned.map((m) => m.user_id)]);
  const author = (members ?? []).find((m) => m.user_id === ctx.userId);
  const receivers = [task.created_by, task.assignee_id, ...(assignees ?? []).map((a) => a.user_id)];
  await notifyUsers(admin, ctx.workspaceId, receivers.filter((u) => u && !skip.has(u)), {
    type: "task_assigned",
    title: `${author?.full_name ?? "Someone"} · ${task.title}`,
    body: withAttachments(text.length > 200 ? text.slice(0, 200) + "…" : text, fileNames),
    entity_type: "task_message",
    entity_id: id,
  }).catch(() => {});

  // Anyone who has this task open sees the message straight away.
  await broadcast([{ topic: `task-chat:${id}`, event: "message" }]);

  const profileByUserId = await profilesByUserId(admin, [ctx.userId]);
  const files = await attachmentsFor(admin, id, [comment as RawComment]);
  return NextResponse.json({ comment: serializeComment(comment as RawComment, profileByUserId, files) });
}
