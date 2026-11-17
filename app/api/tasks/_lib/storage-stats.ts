import type { SupabaseClient } from "@supabase/supabase-js";
import { keepReady, listR2 } from "./files";
import { getTaskSettings } from "./settings";

/**
 * Storage numbers for the CEO, read from Cloudflare itself (so Settings and the
 * Storage page always agree), plus the clean-up schedule worked out from the tasks.
 */

export type Section = "brief" | "reference" | "main" | "chat";
const SECTION_OF: Record<string, Section> = { brief: "brief", refs: "reference", "main-files": "main", chat: "chat" };
/** Section of a file from its folder ("…/refs/file" → reference). */
export const sectionOfKey = (key: string): Section | null => SECTION_OF[key.split("/").slice(-2, -1)[0] ?? ""] ?? null;

/** Files not attached to any task younger than this are left alone (an upload may still be finishing). */
export const UNATTACHED_GRACE_MS = 60 * 60 * 1000;

export interface CleanupItem {
  key: string; name: string; size: number; section: Section; task: { id: string; title: string } | null;
  /** When the automatic clean-up removes it; null = waits until its task is completed with a main file. */
  deletes_on: string | null;
  keep: boolean;
}

/** Reference and chat files, with the date each will be removed (or why it is not scheduled yet). */
export async function cleanupPlan(admin: SupabaseClient, workspaceId: string) {
  const [settings, withKeep] = await Promise.all([getTaskSettings(admin, workspaceId), keepReady(admin)]);
  const { data: rows } = await admin.from("task_attachments")
    .select(`file_path, file_name, size_bytes, kind, task_id${withKeep ? ", keep" : ""}, task:tasks!inner(id, title, status, completed_at)`)
    .eq("workspace_id", workspaceId).eq("storage", "r2").in("kind", ["reference", "chat"]).is("purged_at", null).not("file_path", "is", null)
    .limit(5000);
  const list = (rows ?? []) as unknown as {
    file_path: string; file_name: string | null; size_bytes: number | null; kind: string; task_id: string; keep?: boolean;
    task: { id: string; title: string; status: string; completed_at: string | null } | { id: string; title: string; status: string; completed_at: string | null }[];
  }[];
  const taskIds = [...new Set(list.map((r) => r.task_id))];
  const { data: mains } = taskIds.length
    ? await admin.from("task_attachments").select("task_id").in("task_id", taskIds).eq("kind", "main").is("purged_at", null)
    : { data: [] as { task_id: string }[] };
  const withMain = new Set((mains ?? []).map((m) => m.task_id));

  const items: CleanupItem[] = list.map((r) => {
    const t = Array.isArray(r.task) ? r.task[0] : r.task;
    const due = settings.retention_enabled && t?.status === "done" && t.completed_at && withMain.has(r.task_id)
      ? new Date(new Date(t.completed_at).getTime() + settings.retention_days * 864e5).toISOString()
      : null;
    return {
      key: r.file_path, name: r.file_name ?? r.file_path.split("/").pop()!, size: r.size_bytes ?? 0,
      section: r.kind === "chat" ? "chat" : "reference",
      task: t ? { id: t.id, title: t.title } : null,
      deletes_on: r.keep ? null : due, keep: !!r.keep,
    };
  });
  return { items, retention_enabled: settings.retention_enabled, retention_days: settings.retention_days, keep_available: withKeep };
}

/** Totals from Cloudflare, by section, plus files no task points to, and the allowance. */
export async function storageSummary(admin: SupabaseClient, workspaceId: string) {
  const root = `${workspaceId}/`;
  const [{ objects, truncated }, { data: linked }, settings, plan] = await Promise.all([
    listR2(root, 50000),
    admin.from("task_attachments").select("file_path").eq("workspace_id", workspaceId).eq("storage", "r2").not("file_path", "is", null).limit(50000),
    getTaskSettings(admin, workspaceId),
    cleanupPlan(admin, workspaceId),
  ]);
  const known = new Set((linked ?? []).map((r) => r.file_path as string));
  const empty = () => ({ files: 0, bytes: 0 });
  const by: Record<Section | "other", { files: number; bytes: number }> = { brief: empty(), reference: empty(), main: empty(), chat: empty(), other: empty() };
  const unattached = empty();
  const total = empty();
  for (const o of objects) {
    total.files++; total.bytes += o.size;
    if (!known.has(o.key)) { unattached.files++; unattached.bytes += o.size; continue; }
    const s = sectionOfKey(o.key) ?? "other";
    by[s].files++; by[s].bytes += o.size;
  }
  const now = Date.now();
  const scheduled = plan.items.filter((i) => i.deletes_on).sort((a, b) => a.deletes_on!.localeCompare(b.deletes_on!));
  const within = (days: number) => scheduled.filter((i) => new Date(i.deletes_on!).getTime() <= now + days * 864e5);
  const sum = (l: CleanupItem[]) => ({ files: l.length, bytes: l.reduce((s, i) => s + i.size, 0) });
  return {
    total, by, unattached, truncated,
    limit_bytes: Math.round(settings.storage_limit_gb * 1024 ** 3),
    limit_gb: settings.storage_limit_gb,
    cleanup: {
      enabled: settings.retention_enabled, days: settings.retention_days, keep_available: plan.keep_available,
      next7: sum(within(7)), next30: sum(within(30)),
      waiting: sum(plan.items.filter((i) => !i.deletes_on && !i.keep)),
      kept: sum(plan.items.filter((i) => i.keep)),
      // Paths relative to the workspace folder, like everywhere on the Storage page.
      upcoming: scheduled.slice(0, 100).map((i) => ({ ...i, key: i.key.slice(root.length) })),
    },
  };
}
