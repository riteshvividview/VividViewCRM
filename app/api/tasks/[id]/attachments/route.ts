import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../../_lib/helpers";

const BUCKET = "task-attachments";
const MAX_BYTES = 25 * 1024 * 1024;
type Params = { params: Promise<{ id: string }> };

async function loadTask(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = adminClient();
  const { data: task } = await admin.from("tasks").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!task) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  return { ctx, admin };
}

/** Lists attachments with short-lived signed download URLs. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadTask(id);
  if ("error" in r) return r.error;
  const { data, error } = await r.admin.from("task_attachments")
    .select("id, file_path, file_name, size_bytes, mime_type, uploaded_by, created_at").eq("task_id", id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const paths = (data ?? []).map((a) => a.file_path);
  const { data: signed } = paths.length
    ? await r.admin.storage.from(BUCKET).createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return NextResponse.json({ attachments: (data ?? []).map((a) => ({ ...a, url: urlByPath.get(a.file_path) ?? null })) });
}

/** POST multipart/form-data with one or more "file" fields. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadTask(id);
  if ("error" in r) return r.error;

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const saved = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} is larger than 25 MB` }, { status: 400 });
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
    const path = `${r.ctx.workspaceId}/${id}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await r.admin.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    const { data, error } = await r.admin.from("task_attachments").insert({
      workspace_id: r.ctx.workspaceId, task_id: id, file_path: path, file_name: file.name,
      size_bytes: file.size, mime_type: file.type || null, uploaded_by: r.ctx.userId,
    }).select("id, file_path, file_name, size_bytes, mime_type, uploaded_by, created_at").single();
    if (error) {
      await r.admin.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    saved.push(data);
  }
  await r.admin.from("task_activity_log").insert({
    task_id: id, workspace_id: r.ctx.workspaceId, actor_id: r.ctx.userId, action: "attachment_added",
    metadata: { files: files.map((f) => f.name) },
  });
  return NextResponse.json({ attachments: saved });
}

/** DELETE ?attachment_id= */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await loadTask(id);
  if ("error" in r) return r.error;
  const attId = request.nextUrl.searchParams.get("attachment_id") ?? "";
  const { data: att } = await r.admin.from("task_attachments").select("id, file_path").eq("id", attId).eq("task_id", id).maybeSingle();
  if (!att) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  await r.admin.storage.from(BUCKET).remove([att.file_path]);
  await r.admin.from("task_attachments").delete().eq("id", att.id);
  return NextResponse.json({ ok: true });
}
