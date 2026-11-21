import { heldResponse } from "../../_lib/hold";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isLead, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import {
  FILE_KINDS, R2_MAX_BYTES, SUPABASE_MAX_BYTES, buildFilePath, presignUpload, putFile, r2Enabled, r2ObjectSize,
  downloadUrls, removeFiles, signedUrls, type FileKind, type FileStore,
} from "../../_lib/files";
import { NOT_YOURS_MESSAGE, canAccessTask, canEditTask, canReadTask, teamIdsOfTasks, teamsById } from "../../_lib/teams";

type Params = { params: Promise<{ id: string }> };
const ATTACHMENT_SELECT = "id, kind, storage, file_path, file_name, size_bytes, mime_type, link_url, purged_at, uploaded_by, created_at";
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** `write` false = viewing only (any brand task can be viewed from the Brands tab). */
async function loadTask(id: string, write = true) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: err("Unauthorized", 401) };
  const admin = adminClient();
  const { data: task } = await admin.from("tasks")
    .select("id, title, number, status, created_at, created_by, assignee_id, hold_at, project:task_projects!project_id(name, key)")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task || !(await (write ? canAccessTask : canReadTask)(admin, ctx, id))) return { error: err("Task not found", 404) };
  const teamId = (await teamIdsOfTasks(admin, [id])).get(id);
  const team = teamId ? (await teamsById(admin, [teamId])).get(teamId) ?? null : null;
  const project = (Array.isArray(task.project) ? task.project[0] ?? null : task.project) as { name: string; key?: string | null } | null;
  return { ctx, admin, task: { ...task, project, team } };
}
type Loaded = Exclude<Awaited<ReturnType<typeof loadTask>>, { error: NextResponse }>;

/** The main (final) file is submitted by the people doing the task, its creator, or a lead. */
async function canSubmitMain(r: Loaded): Promise<boolean> {
  if (isLead(r.ctx.role) || r.task.created_by === r.ctx.userId || r.task.assignee_id === r.ctx.userId) return true;
  const { data } = await r.admin.from("task_assignees").select("user_id").eq("task_id", r.task.id).eq("user_id", r.ctx.userId).maybeSingle();
  return !!data;
}

const parseKind = (v: unknown): FileKind | null => (FILE_KINDS.includes(v as FileKind) ? (v as FileKind) : null);

async function logAdded(r: Loaded, kind: FileKind, names: string[]) {
  if (kind === "chat") return;
  await r.admin.from("task_activity_log").insert({
    task_id: r.task.id, workspace_id: r.ctx.workspaceId, actor_id: r.ctx.userId, action: "attachment_added",
    metadata: { files: names, kind },
  });
}

/** Lists the task's files with short-lived download URLs. ?kind= filters to one section. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadTask(id, false);
  if ("error" in r) return r.error;
  let q = r.admin.from("task_attachments").select(ATTACHMENT_SELECT).eq("task_id", id);
  const kind = parseKind(request.nextUrl.searchParams.get("kind"));
  q = kind ? q.eq("kind", kind) : q.neq("kind", "chat");
  const { data, error } = await q.order("created_at");
  if (error) return err(error.message);

  const stored = (data ?? []) as { file_path: string | null; storage: FileStore; file_name: string }[];
  const [urls, downloads] = await Promise.all([signedUrls(r.admin, stored), downloadUrls(r.admin, stored)]);
  return NextResponse.json({
    attachments: (data ?? []).map(({ file_path, ...a }) => ({
      ...a, url: a.link_url ?? (file_path ? urls.get(file_path) ?? null : null),
      download_url: file_path ? downloads.get(file_path) ?? null : null,
    })),
    can_submit_main: (await canEditTask(r.admin, r.ctx, id)) && (await canSubmitMain(r)),
    can_edit: await canEditTask(r.admin, r.ctx, id),
  });
}

/**
 * POST multipart/form-data: "file" fields + "kind"  → uploads through the server.
 * POST JSON { action: "presign", file_name, size, mime, kind } → URL for a direct browser upload to Cloudflare.
 * POST JSON { action: "confirm", path, file_name, mime, kind } → records a finished direct upload.
 * POST JSON { action: "link", url, kind } → saves a link instead of a file.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  { const held = await heldResponse(id); if (held) return held; } // on hold: no changes until a CEO resumes it
  const r = await loadTask(id);
  if ("error" in r) return r.error;
  if (r.ctx.readOnly) return readOnlyResponse();
  syncWorkspace(r.ctx.workspaceId, () => ({ tasks: [id] }));
  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");

  if (isJson) {
    const body = await request.json().catch(() => ({}));
    const kind = parseKind(body.kind);
    if (!kind) return err("Invalid file section");
    if (kind === "main" && !(await canSubmitMain(r))) return err("Only the assignees can submit the main file", 403);
    if (kind !== "chat" && !(await canEditTask(r.admin, r.ctx, id))) return err(NOT_YOURS_MESSAGE, 403);
    if (kind !== "chat" && r.task.status === "done") return err("This task is completed. Reopen it to change its files.");

    if (body.action === "link") {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!/^https?:\/\/\S+$/i.test(url) || url.length > 2000) return err("Enter a valid link starting with http:// or https://");
      const { data, error } = await r.admin.from("task_attachments").insert({
        workspace_id: r.ctx.workspaceId, task_id: id, kind, file_path: null, link_url: url,
        file_name: url.replace(/^https?:\/\//i, "").slice(0, 120), uploaded_by: r.ctx.userId,
      }).select(ATTACHMENT_SELECT).single();
      if (error) return err(error.message);
      await logAdded(r, kind, [data.file_name]);
      return NextResponse.json({ attachments: [{ ...data, file_path: undefined, url }] });
    }

    const fileName = typeof body.file_name === "string" ? body.file_name.slice(0, 255) : "";
    const mime = typeof body.mime === "string" && body.mime ? body.mime : "application/octet-stream";

    if (body.action === "presign") {
      if (!fileName) return err("File name is required");
      if (!r2Enabled()) return NextResponse.json({ mode: "server", max_bytes: SUPABASE_MAX_BYTES });
      if ((Number(body.size) || 0) > R2_MAX_BYTES) return err(`${fileName} is larger than 5 GB`);
      const path = buildFilePath(r.ctx.workspaceId, r.task, kind, fileName);
      return NextResponse.json({ mode: "direct", path, upload_url: await presignUpload(path, mime) });
    }

    if (body.action === "confirm") {
      const path = typeof body.path === "string" ? body.path : "";
      // The path must be one this workspace was given by "presign", and the object must really exist.
      if (!r2Enabled() || !path.startsWith(`${r.ctx.workspaceId}/`) || path.includes("..")) return err("Invalid upload");
      const stored = await r2ObjectSize(path);
      if (stored === null) return err("Upload did not finish, please try again");
      const { data, error } = await r.admin.from("task_attachments").insert({
        workspace_id: r.ctx.workspaceId, task_id: id, kind, storage: "r2", file_path: path, file_name: fileName || "file",
        size_bytes: stored, mime_type: mime, uploaded_by: r.ctx.userId,
      }).select(ATTACHMENT_SELECT).single();
      if (error) {
        await removeFiles(r.admin, [{ file_path: path, storage: "r2" }]);
        return err(error.message);
      }
      await logAdded(r, kind, [data.file_name]);
      return NextResponse.json({ attachments: [{ ...data, file_path: undefined, url: null }] });
    }
    return err("Unknown action");
  }

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return err("No file uploaded");
  const kind = parseKind(form?.get("kind") ?? "reference");
  if (!kind) return err("Invalid file section");
  if (kind === "main" && !(await canSubmitMain(r))) return err("Only the assignees can submit the main file", 403);
  if (kind !== "chat" && !(await canEditTask(r.admin, r.ctx, id))) return err(NOT_YOURS_MESSAGE, 403);
  if (kind !== "chat" && r.task.status === "done") return err("This task is completed. Reopen it to change its files.");

  const saved = [];
  for (const file of files) {
    if (file.size > SUPABASE_MAX_BYTES) return err(`${file.name} is larger than 25 MB`);
    const path = buildFilePath(r.ctx.workspaceId, r.task, kind, file.name);
    const put = await putFile(r.admin, path, file);
    if (put.error) return err(put.error);
    const { data, error } = await r.admin.from("task_attachments").insert({
      workspace_id: r.ctx.workspaceId, task_id: id, kind, storage: put.store, file_path: path, file_name: file.name,
      size_bytes: file.size, mime_type: file.type || null, uploaded_by: r.ctx.userId,
    }).select(ATTACHMENT_SELECT).single();
    if (error) {
      await removeFiles(r.admin, [{ file_path: path, storage: put.store }]);
      return err(error.message);
    }
    saved.push({ ...data, file_path: undefined, url: null });
  }
  await logAdded(r, kind, files.map((f) => f.name));
  return NextResponse.json({ attachments: saved });
}

/** DELETE ?attachment_id= — the uploader, the task creator or a lead. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  { const held = await heldResponse(id); if (held) return held; } // on hold: no changes until a CEO resumes it
  const r = await loadTask(id);
  if ("error" in r) return r.error;
  if (r.ctx.readOnly) return readOnlyResponse();
  syncWorkspace(r.ctx.workspaceId, () => ({ tasks: [id] }));
  const attId = request.nextUrl.searchParams.get("attachment_id") ?? "";
  const { data: att } = await r.admin.from("task_attachments").select("id, kind, storage, file_path, uploaded_by").eq("id", attId).eq("task_id", id).maybeSingle();
  if (!att) return err("File not found", 404);
  if (att.kind !== "chat" && !(await canEditTask(r.admin, r.ctx, id))) return err(NOT_YOURS_MESSAGE, 403);
  if (att.kind !== "chat" && r.task.status === "done") return err("This task is completed. Reopen it to change its files.");
  if (r.task.hold_at && r.ctx.role !== "super_admin") return err("This task is on hold.");
  if (!(isLead(r.ctx.role) || att.uploaded_by === r.ctx.userId || r.task.created_by === r.ctx.userId)) {
    return err("You can only remove files you uploaded", 403);
  }
  if (att.kind === "main" && r.task.status === "done") {
    const { count } = await r.admin.from("task_attachments").select("id", { count: "exact", head: true }).eq("task_id", id).eq("kind", "main").is("purged_at", null);
    if ((count ?? 0) <= 1) return err("A completed task must keep its main file. Reopen the task to replace it.");
  }
  await removeFiles(r.admin, [att as { file_path: string | null; storage: FileStore }]);
  await r.admin.from("task_attachments").delete().eq("id", att.id);
  return NextResponse.json({ ok: true });
}
