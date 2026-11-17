import type { SupabaseClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Task file storage. Files live in Cloudflare R2 when the R2_* env vars are set,
 * otherwise in the private Supabase bucket (fallback, 25 MB per file).
 * Each attachment row remembers which store holds it.
 */
export type FileStore = "r2" | "supabase";
export type FileKind = "brief" | "reference" | "main" | "chat";
export const FILE_KINDS: FileKind[] = ["brief", "reference", "main", "chat"];

export const SUPABASE_BUCKET = "task-attachments";
export const SUPABASE_MAX_BYTES = 25 * 1024 * 1024;
export const R2_MAX_BYTES = 5 * 1024 * 1024 * 1024; // single PUT limit

const env = () => ({
  account: process.env.R2_ACCOUNT_ID,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
});

export function r2Enabled(): boolean {
  const e = env();
  return !!(e.account && e.key && e.secret && e.bucket);
}

let client: S3Client | null = null;
function r2(): S3Client {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${e.account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: e.key!, secretAccessKey: e.secret! },
    });
  }
  return client;
}

export const clean = (s: string, max = 60) => s.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, " ").slice(0, max) || "untitled";

interface PathTask { id: string; title: string; number: number | null; created_at: string; project?: { name: string; key?: string | null } | null; team?: { name: string } | null }

/** Folder name of each file section inside a task's folder. */
const SECTION_FOLDER: Record<FileKind, string> = { brief: "brief", reference: "refs", main: "main-files", chat: "chat" };

/**
 * Brand / team / month / task / section / file, e.g.
 * "Nike/Design Team/2026-11/DES-42 Launch reel/main-files/1a2b3c4d-final.mp4".
 * Sections are brief, refs, main-files and chat. A brand holds one folder per team.
 * The workspace id prefixes the path so workspaces never share a folder.
 */
export function buildFilePath(workspaceId: string, task: PathTask, kind: FileKind, fileName: string): string {
  const brand = clean(task.project?.name ?? "No brand");
  const team = clean(task.team?.name ?? "No team");
  const month = (task.created_at ?? new Date().toISOString()).slice(0, 7);
  const key = task.number ? `${task.project?.key ?? "TASK"}-${task.number} ` : "";
  const folder = clean(`${key}${task.title}`, 80);
  return `${workspaceId}/${brand}/${team}/${month}/${folder}/${SECTION_FOLDER[kind]}/${crypto.randomUUID().slice(0, 8)}-${clean(fileName, 120)}`;
}

/**
 * After a task's brand or team changes, moves its stored files to the matching
 * `Brand / Team / …` folder and updates their records. Cleaned-up files and links
 * have nothing stored, so they are skipped. Returns how many files moved.
 */
export async function moveTaskFiles(admin: SupabaseClient, workspaceId: string, taskId: string): Promise<number> {
  const { data: t } = await admin.from("tasks")
    .select("id, title, number, created_at, team_id, project:task_projects!project_id(name, key)").eq("id", taskId).maybeSingle();
  if (!t) return 0;
  const project = (Array.isArray(t.project) ? t.project[0] : t.project) as { name: string; key?: string | null } | null;
  const { data: team } = t.team_id ? await admin.from("teams").select("name").eq("id", t.team_id).maybeSingle() : { data: null };
  const task: PathTask = { id: t.id, title: t.title, number: t.number, created_at: t.created_at, project, team };

  const { data: files } = await admin.from("task_attachments").select("id, kind, storage, file_path").eq("task_id", taskId).not("file_path", "is", null);
  let moved = 0;
  for (const f of files ?? []) {
    const from = f.file_path as string;
    const folder = buildFilePath(workspaceId, task, f.kind as FileKind, "x").split("/").slice(0, -1).join("/");
    const to = `${folder}/${from.split("/").pop()}`;
    if (to === from) continue;
    try {
      if (f.storage === "r2") {
        if (!r2Enabled()) continue;
        const bucket = env().bucket!;
        await r2().send(new CopyObjectCommand({ Bucket: bucket, Key: to, CopySource: `${bucket}/${from.split("/").map(encodeURIComponent).join("/")}` }));
        await r2().send(new DeleteObjectCommand({ Bucket: bucket, Key: from }));
      } else {
        const { error } = await admin.storage.from(SUPABASE_BUCKET).move(from, to);
        if (error) continue;
      }
      await admin.from("task_attachments").update({ file_path: to }).eq("id", f.id);
      moved++;
    } catch {
      // Leave this file where it is; it still opens from its old place.
    }
  }
  return moved;
}

/** Server-side upload (small files / Supabase fallback). */
export async function putFile(admin: SupabaseClient, path: string, file: File): Promise<{ store: FileStore; error?: string }> {
  const contentType = file.type || "application/octet-stream";
  if (r2Enabled()) {
    try {
      await r2().send(new PutObjectCommand({ Bucket: env().bucket, Key: path, Body: Buffer.from(await file.arrayBuffer()), ContentType: contentType }));
      return { store: "r2" };
    } catch (e) {
      return { store: "r2", error: e instanceof Error ? e.message : "Upload to Cloudflare failed" };
    }
  }
  const { error } = await admin.storage.from(SUPABASE_BUCKET).upload(path, file, { contentType });
  return { store: "supabase", error: error?.message };
}

/** Short-lived URL the browser PUTs the file to directly (R2 only; large files never pass through the app server). */
export async function presignUpload(path: string, contentType: string): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: env().bucket, Key: path, ContentType: contentType }), { expiresIn: 900 });
}

/** Size of an uploaded R2 object, or null when it does not exist. */
export async function r2ObjectSize(path: string): Promise<number | null> {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: env().bucket, Key: path }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

interface StoredFile { file_path: string | null; storage: FileStore; file_name?: string | null }

/** 1-hour download URLs, keyed by file_path. */
export async function signedUrls(admin: SupabaseClient, files: StoredFile[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const supa = files.filter((f) => f.file_path && f.storage !== "r2").map((f) => f.file_path!);
  if (supa.length) {
    const { data } = await admin.storage.from(SUPABASE_BUCKET).createSignedUrls(supa, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  }
  const r2Files = files.filter((f) => f.file_path && f.storage === "r2");
  if (r2Files.length && r2Enabled()) {
    await Promise.all(r2Files.map(async (f) => {
      try {
        out.set(f.file_path!, await getSignedUrl(r2(), new GetObjectCommand({ Bucket: env().bucket, Key: f.file_path! }), { expiresIn: 3600 }));
      } catch {}
    }));
  }
  return out;
}

/** 1-hour links that make the browser save the file under its original name, keyed by file_path. */
export async function downloadUrls(admin: SupabaseClient, files: StoredFile[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(files.filter((f) => f.file_path).map(async (f) => {
    const name = (f.file_name || "file").replace(/["\\\r\n]/g, "_");
    try {
      if (f.storage === "r2") {
        if (!r2Enabled()) return;
        const disposition = `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;
        out.set(f.file_path!, await getSignedUrl(r2(), new GetObjectCommand({ Bucket: env().bucket, Key: f.file_path!, ResponseContentDisposition: disposition }), { expiresIn: 3600 }));
      } else {
        const { data } = await admin.storage.from(SUPABASE_BUCKET).createSignedUrl(f.file_path!, 3600, { download: name });
        if (data?.signedUrl) out.set(f.file_path!, data.signedUrl);
      }
    } catch {}
  }));
  return out;
}

export async function removeFiles(admin: SupabaseClient, files: StoredFile[]): Promise<void> {
  const supa = files.filter((f) => f.file_path && f.storage !== "r2").map((f) => f.file_path!);
  if (supa.length) await admin.storage.from(SUPABASE_BUCKET).remove(supa);
  const keys = files.filter((f) => f.file_path && f.storage === "r2").map((f) => ({ Key: f.file_path! }));
  if (keys.length && r2Enabled()) {
    for (let i = 0; i < keys.length; i += 1000) {
      await r2().send(new DeleteObjectsCommand({ Bucket: env().bucket, Delete: { Objects: keys.slice(i, i + 1000), Quiet: true } }));
    }
  }
}

let keepCol: boolean | null = null, keepCheckedAt = 0;
/** Whether task_attachments.keep exists (migration 50); cached per server for a minute. */
export async function keepReady(admin: SupabaseClient): Promise<boolean> {
  if (keepCol === true) return true;
  if (keepCol === false && Date.now() - keepCheckedAt < 60_000) return false;
  const { error } = await admin.from("task_attachments").select("keep").limit(1);
  keepCol = !error; keepCheckedAt = Date.now();
  return keepCol;
}

/** Reference files and chat media of tasks completed at least `days` ago that have a main file. */
async function purgeable(admin: SupabaseClient, workspaceId: string, days: number) {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  let q = admin.from("task_attachments")
    .select("id, task_id, file_path, storage, size_bytes, task:tasks!inner(status, completed_at)")
    .eq("workspace_id", workspaceId).in("kind", ["reference", "chat"]).is("purged_at", null).not("file_path", "is", null)
    .eq("task.status", "done").lte("task.completed_at", cutoff);
  if (await keepReady(admin)) q = q.eq("keep", false);
  const { data: rows } = await q.limit(1000);
  if (!rows?.length) return [];

  const taskIds = [...new Set(rows.map((r) => r.task_id))];
  const { data: mains } = await admin.from("task_attachments").select("task_id")
    .in("task_id", taskIds).eq("kind", "main").is("purged_at", null);
  const withMain = new Set((mains ?? []).map((m) => m.task_id));
  return rows.filter((r) => withMain.has(r.task_id));
}

/** What a cleanup with this waiting period would remove right now. */
export async function countPurgeable(admin: SupabaseClient, workspaceId: string, days: number): Promise<{ files: number; bytes: number }> {
  const rows = await purgeable(admin, workspaceId, days);
  return { files: rows.length, bytes: rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0) };
}

/**
 * Retention: once a task has been done for `days` and has its main file, its
 * reference files and chat media are deleted from storage. The rows stay
 * (marked purged) so chats and logs still show what was shared.
 * Brief files, main files and all text are never touched.
 */
export async function purgeExpiredFiles(admin: SupabaseClient, workspaceId: string, days: number): Promise<number> {
  const expired = await purgeable(admin, workspaceId, days);
  if (!expired.length) return 0;

  await removeFiles(admin, expired as StoredFile[]);
  await admin.from("task_attachments").update({ purged_at: new Date().toISOString(), file_path: null }).in("id", expired.map((r) => r.id));
  return expired.length;
}

// ── Storage browser (CEO) ─────────────────────────────────────────────────

export interface R2Object { key: string; size: number; modified: string }

/** Every object under a prefix, up to `cap`. `truncated` is true when there were more. */
export async function listR2(prefix: string, cap = 20000, opts: { markers?: boolean } = {}): Promise<{ objects: R2Object[]; truncated: boolean }> {
  const objects: R2Object[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(new ListObjectsV2Command({ Bucket: env().bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of page.Contents ?? []) {
      if (!o.Key || (o.Key.endsWith("/") && !opts.markers)) continue;
      objects.push({ key: o.Key, size: o.Size ?? 0, modified: (o.LastModified ?? new Date()).toISOString() });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && objects.length < cap);
  return { objects: objects.slice(0, cap), truncated: !!token || objects.length > cap };
}

export async function r2Exists(key: string): Promise<boolean> {
  return (await r2ObjectSize(key)) !== null;
}

/** An empty "folder/" marker, so a new folder shows before anything is in it. */
export async function putFolderMarker(key: string): Promise<void> {
  await r2().send(new PutObjectCommand({ Bucket: env().bucket, Key: key.endsWith("/") ? key : `${key}/`, Body: "", ContentType: "application/x-directory" }));
}

/** Short-lived URL for uploading straight from the browser into any key (Storage page uploads). */
export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: env().bucket, Key: key, ContentType: contentType }), { expiresIn: 900 });
}

/** Copies then deletes: R2 has no rename. */
export async function moveR2(from: string, to: string): Promise<void> {
  const bucket = env().bucket!;
  await r2().send(new CopyObjectCommand({ Bucket: bucket, Key: to, CopySource: `${bucket}/${from.split("/").map(encodeURIComponent).join("/")}` }));
  await r2().send(new DeleteObjectCommand({ Bucket: bucket, Key: from }));
}

/** Deletes keys in batches of 1000. Returns the keys R2 reported as not deleted. */
export async function deleteR2(keys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await r2().send(new DeleteObjectsCommand({ Bucket: env().bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    for (const e of res.Errors ?? []) if (e.Key) failed.push(e.Key);
  }
  return failed;
}

/** 10-minute link to view (inline) or download (under `name`) one object. */
export async function presignR2(key: string, download?: string): Promise<string> {
  const name = download?.replace(/["\\\r\n]/g, "_");
  return getSignedUrl(r2(), new GetObjectCommand({
    Bucket: env().bucket, Key: key,
    ResponseContentDisposition: name ? `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}` : undefined,
  }), { expiresIn: 600 });
}
