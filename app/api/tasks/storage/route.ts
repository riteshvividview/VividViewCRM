import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, getAuthContext, syncWorkspace, type AuthContext } from "../_lib/helpers";
import { clean, deleteR2, listR2, moveR2, presignR2, r2Enabled, r2Exists, type R2Object } from "../_lib/files";

/**
 * Cloudflare R2 browser for the CEO. Paths in and out are relative to the
 * workspace folder ("Brand/Team/2026-11/…"); the workspace id is never exposed
 * and nothing outside it can be reached.
 *
 * Every change keeps the task records in step: moved or renamed files keep
 * opening from their tasks, deleted ones stay listed on the task as removed.
 */

const MAX_LISTED = 20000;    // objects read per request
const MAX_RETURNED = 500;    // files sent back in one response
const MAX_CHANGED = 5000;    // objects one rename / move / delete may touch
const CONCURRENCY = 8;

const SECTION_OF: Record<string, string> = { brief: "brief", refs: "reference", "main-files": "main", chat: "chat" };

type FileType = "image" | "video" | "audio" | "pdf" | "document" | "design" | "archive" | "other";
const TYPE_EXT: Record<Exclude<FileType, "other">, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif", "bmp", "tif", "tiff", "avif"],
  video: ["mp4", "mov", "m4v", "webm", "avi", "mkv", "wmv"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "flac"],
  pdf: ["pdf"],
  document: ["doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "rtf", "odt", "ods", "odp", "md", "pages", "numbers", "key"],
  design: ["psd", "ai", "eps", "indd", "fig", "sketch", "xd", "aep", "prproj", "cdr", "afdesign", "afphoto"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
};
const typeOf = (name: string): FileType => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  for (const [t, list] of Object.entries(TYPE_EXT)) if (list.includes(ext)) return t as FileType;
  return "other";
};
/** Stored names start with 8 random characters so two uploads never clash; people never see them. */
const displayName = (fileName: string) => fileName.replace(/^[0-9a-f]{8}-/i, "");

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function ceo(): Promise<{ ctx: AuthContext; admin: SupabaseClient } | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) return err("Unauthorized", 401);
  if (ctx.role !== "super_admin") return err("Only the CEO can open storage", 403);
  if (!r2Enabled()) return err("Cloudflare R2 is not connected", 503);
  return { ctx, admin: adminClient() };
}

/** "a/b/" style folder path, validated. Empty string is the top. */
function folderPath(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw !== "string") return null;
  const parts = raw.split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === ".." || p.includes("\\"))) return null;
  return parts.length ? `${parts.join("/")}/` : "";
}
/** "a/b/file.ext", validated. */
function filePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.endsWith("/")) return null;
  const parts = raw.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) return null;
  return parts.join("/");
}

async function inPool<T>(items: T[], fn: (item: T) => Promise<void>): Promise<number> {
  let failed = 0, i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { await fn(item); } catch { failed++; }
    }
  }));
  return failed;
}

interface Linked { id: string; task_id: string; kind: string; file_name: string | null; mime_type: string | null; uploaded_by: string | null; created_at: string }

/** Task records for the given full keys. */
async function attachmentsFor(admin: SupabaseClient, ws: string, keys: string[]) {
  const map = new Map<string, Linked>();
  for (let i = 0; i < keys.length; i += 150) {
    const { data } = await admin.from("task_attachments")
      .select("id, task_id, kind, file_name, mime_type, uploaded_by, created_at, file_path")
      .eq("workspace_id", ws).eq("storage", "r2").in("file_path", keys.slice(i, i + 150));
    for (const a of data ?? []) map.set(a.file_path as string, a as Linked);
  }
  return map;
}

// ── GET: one folder, or a search through a folder and everything below it ──
export async function GET(request: NextRequest) {
  const r = await ceo();
  if (r instanceof NextResponse) return r;
  const { ctx, admin } = r;
  const sp = request.nextUrl.searchParams;
  const prefix = folderPath(sp.get("prefix"));
  if (prefix === null) return err("Invalid folder");
  const root = `${ctx.workspaceId}/`;

  let listing: { objects: R2Object[]; truncated: boolean };
  try {
    listing = await listR2(root + prefix, MAX_LISTED);
  } catch (e) {
    return err(`Could not read Cloudflare: ${e instanceof Error ? e.message : "unknown error"}`, 502);
  }

  // Every folder path below the workspace (for "Move to"), only when asked.
  if (sp.get("folders") === "1") {
    const all = await listR2(root, MAX_LISTED).catch(() => ({ objects: [] as R2Object[], truncated: false }));
    const set = new Set<string>();
    for (const o of all.objects) {
      const parts = o.key.slice(root.length).split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/") + "/");
    }
    return NextResponse.json({ folders: [...set].sort((a, b) => a.localeCompare(b)) });
  }

  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const type = sp.get("type") ?? "";
  const section = sp.get("section") ?? "";
  const linkedFilter = sp.get("linked") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const minSize = Number(sp.get("min_size") ?? 0) || 0;
  const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? sp.get("month")! : "";
  const sort = sp.get("sort") ?? "name";
  const searching = !!(q || type || section || linkedFilter || from || to || minSize || month);

  const rel = (key: string) => key.slice(root.length);
  const totalBytes = listing.objects.reduce((s, o) => s + o.size, 0);

  // Immediate subfolders with what they hold.
  const folders = new Map<string, { name: string; path: string; files: number; bytes: number; modified: string }>();
  const here: R2Object[] = [];
  for (const o of listing.objects) {
    const rest = rel(o.key).slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) { here.push(o); continue; }
    const name = rest.slice(0, slash);
    const f = folders.get(name) ?? { name, path: `${prefix}${name}/`, files: 0, bytes: 0, modified: o.modified };
    f.files++; f.bytes += o.size; if (o.modified > f.modified) f.modified = o.modified;
    folders.set(name, f);
  }

  // Files to show: this folder's own, or everything below when searching/filtering.
  let candidates = searching ? listing.objects : here;
  candidates = candidates.filter((o) => {
    const path = rel(o.key);
    const name = displayName(path.split("/").pop() ?? "");
    if (q && !name.toLowerCase().includes(q) && !path.toLowerCase().includes(q)) return false;
    if (type && typeOf(name) !== type) return false;
    if (section && SECTION_OF[path.split("/").slice(-2, -1)[0] ?? ""] !== section) return false;
    if (from && o.modified < from) return false;
    if (to && o.modified > `${to}T23:59:59.999Z`) return false;
    if (minSize && o.size < minSize) return false;
    if (month && !path.split("/").includes(month)) return false;
    return true;
  });

  // Linked / not linked needs the task records, so look them up for all candidates (in chunks).
  let links = new Map<string, Linked>();
  if (linkedFilter) {
    links = await attachmentsFor(admin, ctx.workspaceId, candidates.map((o) => o.key));
    candidates = candidates.filter((o) => (linkedFilter === "yes") === links.has(o.key));
  }

  const sorters: Record<string, (a: R2Object, b: R2Object) => number> = {
    name: (a, b) => displayName(a.key.split("/").pop()!).localeCompare(displayName(b.key.split("/").pop()!)),
    newest: (a, b) => b.modified.localeCompare(a.modified),
    oldest: (a, b) => a.modified.localeCompare(b.modified),
    largest: (a, b) => b.size - a.size,
    smallest: (a, b) => a.size - b.size,
  };
  candidates.sort(sorters[sort] ?? sorters.name);
  const matched = { files: candidates.length, bytes: candidates.reduce((s, o) => s + o.size, 0) };
  const page = candidates.slice(0, MAX_RETURNED);

  if (!linkedFilter) links = await attachmentsFor(admin, ctx.workspaceId, page.map((o) => o.key));
  const taskIds = [...new Set([...links.values()].map((a) => a.task_id))];
  const people = [...new Set([...links.values()].map((a) => a.uploaded_by).filter(Boolean))] as string[];
  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    taskIds.length ? admin.from("tasks").select("id, title, number, status, project:task_projects!project_id(key)").in("id", taskIds) : Promise.resolve({ data: [] }),
    people.length ? admin.from("profiles").select("user_id, full_name").in("user_id", people) : Promise.resolve({ data: [] }),
  ]);
  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  const files = page.map((o) => {
    const path = rel(o.key);
    const a = links.get(o.key);
    const t = a ? taskById.get(a.task_id) : undefined;
    const project = t ? (Array.isArray(t.project) ? t.project[0] : t.project) as { key?: string | null } | null : null;
    const name = a?.file_name || displayName(path.split("/").pop() ?? "");
    return {
      path, name, size: o.size, modified: o.modified, type: typeOf(name),
      folder: path.split("/").slice(0, -1).join("/"),
      section: SECTION_OF[path.split("/").slice(-2, -1)[0] ?? ""] ?? null,
      linked: a ? {
        attachment_id: a.id, kind: a.kind, mime_type: a.mime_type,
        uploaded_by: a.uploaded_by ? nameById.get(a.uploaded_by) ?? null : null,
        task: t ? { id: t.id, title: t.title, status: t.status, code: t.number ? `${project?.key ?? "TASK"}-${t.number}` : null } : null,
      } : null,
    };
  });

  const folderSort: Record<string, (a: { name: string; bytes: number; modified: string }, b: { name: string; bytes: number; modified: string }) => number> = {
    newest: (a, b) => b.modified.localeCompare(a.modified), oldest: (a, b) => a.modified.localeCompare(b.modified),
    largest: (a, b) => b.bytes - a.bytes, smallest: (a, b) => a.bytes - b.bytes,
  };
  const folderList = searching
    ? (q ? [...folders.values()].filter((f) => f.name.toLowerCase().includes(q)) : [])
    : [...folders.values()];
  folderList.sort(folderSort[sort] ?? ((a, b) => a.name.localeCompare(b.name)));

  // Top-level folders (brands) and months, for the filter menus.
  const brands = new Set<string>(), months = new Set<string>();
  for (const o of listing.objects) {
    const parts = rel(o.key).split("/");
    if (parts.length > 1) brands.add(parts[0]);
    const m = parts.find((p) => /^\d{4}-\d{2}$/.test(p));
    if (m) months.add(m);
  }

  return NextResponse.json({
    prefix, searching,
    folder: { files: listing.objects.length, bytes: totalBytes, truncated: listing.truncated },
    matched, shown: files.length,
    folders: folderList, files,
    brands: prefix ? [] : [...brands].sort(), months: [...months].sort().reverse(),
  });
}

// ── POST: url / rename / move / delete ──────────────────────────────────────
export async function POST(request: NextRequest) {
  const r = await ceo();
  if (r instanceof NextResponse) return r;
  const { ctx, admin } = r;
  const root = `${ctx.workspaceId}/`;
  const body = await request.json().catch(() => ({}));

  if (body.action === "url") {
    const path = filePath(body.path);
    if (!path) return err("Invalid file");
    if (!(await r2Exists(root + path))) return err("This file no longer exists", 404);
    const name = typeof body.name === "string" && body.name ? body.name : displayName(path.split("/").pop()!);
    return NextResponse.json({ url: await presignR2(root + path, body.download ? name : undefined) });
  }

  if (body.action === "rename") {
    const path = filePath(body.path);
    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!path) return err("Invalid file");
    if (!raw || /[/\\]/.test(raw)) return err("Enter a name without slashes");
    const old = path.split("/").pop()!;
    const ext = old.includes(".") ? old.slice(old.lastIndexOf(".")) : "";
    // Keep the extension when it was left out, so the file still opens.
    const wanted = raw.includes(".") || !ext ? raw : `${raw}${ext}`;
    const stamp = old.match(/^[0-9a-f]{8}-/i)?.[0] ?? "";
    const nextName = `${stamp}${clean(wanted, 120)}`;
    const target = [...path.split("/").slice(0, -1), nextName].join("/");
    if (target === path) return NextResponse.json({ ok: true, path });
    if (!(await r2Exists(root + path))) return err("This file no longer exists", 404);
    // Two files that look the same in one folder would be confusing, whatever their hidden prefix.
    const folder = path.split("/").slice(0, -1).join("/");
    const { objects: siblings } = await listR2(`${root}${folder ? folder + "/" : ""}`, MAX_LISTED);
    const taken = siblings.some((o) => o.key !== root + path && o.key.slice(root.length).split("/").slice(0, -1).join("/") === folder
      && displayName(o.key.split("/").pop()!).toLowerCase() === displayName(nextName).toLowerCase());
    if (taken || (await r2Exists(root + target))) return err("A file with this name already exists in this folder", 409);
    await moveR2(root + path, root + target);
    const display = displayName(nextName);
    const { data: rows } = await admin.from("task_attachments").update({ file_path: root + target, file_name: display })
      .eq("workspace_id", ctx.workspaceId).eq("storage", "r2").eq("file_path", root + path).select("task_id");
    await logOnTasks(admin, ctx, rows ?? [], "storage_renamed", { to: display });
    if (rows?.length) syncWorkspace(ctx.workspaceId);
    return NextResponse.json({ ok: true, path: target });
  }

  if (body.action === "rename_folder") {
    const folder = folderPath(body.path);
    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!folder) return err("Choose a folder");
    if (!raw || /[/\\]/.test(raw)) return err("Enter a name without slashes");
    const parent = folder.split("/").filter(Boolean).slice(0, -1).join("/");
    const target = `${parent ? parent + "/" : ""}${clean(raw, 80)}/`;
    if (target === folder) return NextResponse.json({ ok: true, path: target });
    return relocate(admin, ctx, root, [folder], [], (key) => target + key.slice(root.length + folder.length), target);
  }

  if (body.action === "move") {
    const to = folderPath(body.to);
    if (to === null) return err("Choose a folder to move to");
    const files = (Array.isArray(body.files) ? body.files : []).map(filePath);
    const folders = (Array.isArray(body.folders) ? body.folders : []).map(folderPath);
    if (files.some((f: string | null) => !f) || folders.some((f: string | null) => !f)) return err("Invalid selection");
    if (!files.length && !folders.length) return err("Nothing selected");
    if (folders.some((f: string) => to.startsWith(f))) return err("A folder cannot be moved into itself");
    // A selected folder keeps its name inside the destination; a file keeps its own name.
    const mapKey = (key: string) => {
      const relKey = key.slice(root.length);
      const f = (folders as string[]).find((x) => relKey.startsWith(x));
      if (f) return to + f.split("/").filter(Boolean).pop() + "/" + relKey.slice(f.length);
      return to + relKey.split("/").pop();
    };
    return relocate(admin, ctx, root, folders as string[], files as string[], mapKey, to);
  }

  if (body.action === "delete") {
    const files = (Array.isArray(body.files) ? body.files : []).map(filePath);
    const folders = (Array.isArray(body.folders) ? body.folders : []).map(folderPath);
    if (files.some((f: string | null) => !f) || folders.some((f: string | null) => !f)) return err("Invalid selection");
    if (!files.length && !folders.length) return err("Nothing selected");
    const keys = new Set<string>((files as string[]).map((f) => root + f));
    for (const f of folders as string[]) {
      const { objects, truncated } = await listR2(root + f, MAX_CHANGED + 1);
      if (truncated || objects.length > MAX_CHANGED) return err(`A folder holds more than ${MAX_CHANGED} files. Delete its subfolders one at a time.`);
      objects.forEach((o) => keys.add(o.key));
    }
    if (keys.size > MAX_CHANGED) return err(`At most ${MAX_CHANGED} files can be deleted at once`);
    const failed = new Set(await deleteR2([...keys]));
    const gone = [...keys].filter((k) => !failed.has(k));
    // Task records stay, marked removed, so tasks and chats still show what was there.
    const touched: { task_id: string; file_name: string | null }[] = [];
    for (let i = 0; i < gone.length; i += 150) {
      const { data } = await admin.from("task_attachments").update({ purged_at: new Date().toISOString(), file_path: null })
        .eq("workspace_id", ctx.workspaceId).eq("storage", "r2").in("file_path", gone.slice(i, i + 150)).select("task_id, file_name");
      touched.push(...(data ?? []));
    }
    await logOnTasks(admin, ctx, touched, "storage_removed");
    if (touched.length) syncWorkspace(ctx.workspaceId);
    return NextResponse.json({ ok: true, deleted: gone.length, failed: failed.size, task_files: touched.length });
  }

  return err("Unknown action");
}

/** Moves every object of the given folders/files to the key `mapKey` gives it. */
async function relocate(
  admin: SupabaseClient, ctx: AuthContext, root: string, folders: string[], files: string[],
  mapKey: (fullKey: string) => string, target: string,
) {
  const keys: string[] = files.map((f) => root + f);
  for (const f of folders) {
    const { objects, truncated } = await listR2(root + f, MAX_CHANGED + 1);
    if (truncated || objects.length > MAX_CHANGED) return err(`A folder holds more than ${MAX_CHANGED} files. Move its subfolders one at a time.`);
    if (!objects.length) return err("This folder is empty or no longer exists", 404);
    keys.push(...objects.map((o) => o.key));
  }
  if (keys.length > MAX_CHANGED) return err(`At most ${MAX_CHANGED} files can be moved at once`);
  const pairs = keys.map((k) => ({ from: k, to: root + mapKey(k) })).filter((p) => p.from !== p.to);
  if (!pairs.length) return NextResponse.json({ ok: true, moved: 0, failed: 0, path: target });

  // Never overwrite: refuse when anything already sits at a destination.
  const clash = (await Promise.all(pairs.slice(0, 200).map(async (p) => (await r2Exists(p.to)) ? p.to : null))).find(Boolean);
  if (clash) return err(`"${clash.slice(root.length)}" already exists. Rename one of them first.`, 409);

  const done: { from: string; to: string }[] = [];
  const failed = await inPool(pairs, async (p) => { await moveR2(p.from, p.to); done.push(p); });

  const touched: { task_id: string; file_name: string | null }[] = [];
  await inPool(done, async (p) => {
    const { data } = await admin.from("task_attachments").update({ file_path: p.to })
      .eq("workspace_id", ctx.workspaceId).eq("storage", "r2").eq("file_path", p.from).select("task_id, file_name");
    touched.push(...(data ?? []));
  });
  await logOnTasks(admin, ctx, touched, "storage_moved", { to: target.replace(/\/$/, "") || "the top folder" });
  if (touched.length) syncWorkspace(ctx.workspaceId);
  return NextResponse.json({ ok: true, moved: done.length, failed, path: target });
}

/** One activity line per task the CEO's change touched. */
async function logOnTasks(
  admin: SupabaseClient, ctx: AuthContext, rows: { task_id: string; file_name?: string | null }[],
  action: "storage_removed" | "storage_renamed" | "storage_moved", extra: Record<string, unknown> = {},
) {
  const byTask = new Map<string, string[]>();
  for (const r of rows) byTask.set(r.task_id, [...(byTask.get(r.task_id) ?? []), r.file_name ?? "a file"]);
  if (!byTask.size) return;
  await admin.from("task_activity_log").insert([...byTask].map(([task_id, files]) => ({
    task_id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action, metadata: { files: files.slice(0, 20), count: files.length, ...extra },
  })));
}
