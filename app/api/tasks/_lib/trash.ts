import type { SupabaseClient } from "@supabase/supabase-js";
import { removeFiles, type FileStore } from "./files";

/**
 * Trash: a deleted task is only marked (deleted_at / deleted_by) and kept for a
 * number of days the CEO chooses, so it can be restored. After that it is removed
 * for good, files included.
 *
 * Until migration 49 has run the columns do not exist; deleting then works as it
 * always did (removed at once). The check is cached per server for a minute.
 */
let ready: boolean | null = null;
let checkedAt = 0;

export async function trashReady(admin: SupabaseClient): Promise<boolean> {
  if (ready === true) return true;
  if (ready === false && Date.now() - checkedAt < 60_000) return false;
  const { error } = await admin.from("tasks").select("deleted_at").limit(1);
  ready = !error;
  checkedAt = Date.now();
  return ready;
}

/** Leaves out tasks in the trash (once the trash exists). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hideTrashed<Q extends { is: any }>(q: Q, isReady: boolean): Q {
  return isReady ? q.is("deleted_at", null) : q;
}

/** Removes a task for good: its stored files, its rows, then the task. */
export async function purgeTask(admin: SupabaseClient, id: string): Promise<string | null> {
  const { data: files } = await admin.from("task_attachments").select("file_path, storage").eq("task_id", id);
  if (files?.length) await removeFiles(admin, files as { file_path: string | null; storage: FileStore }[]);
  // Defensive cleanup — some older child tables may not have ON DELETE CASCADE.
  await admin.from("task_mentions").delete().eq("task_id", id);
  await Promise.all([
    admin.from("task_assignees").delete().eq("task_id", id),
    admin.from("task_watchers").delete().eq("task_id", id),
    admin.from("task_label_assignments").delete().eq("task_id", id),
    admin.from("task_comments").delete().eq("task_id", id),
    admin.from("task_activity_log").delete().eq("task_id", id),
    admin.from("task_time_entries").delete().eq("task_id", id),
    admin.from("task_time_blocks").delete().eq("task_id", id),
    admin.from("task_recurrence_rules").delete().eq("task_id", id),
    admin.from("task_attachments").delete().eq("task_id", id),
  ]);
  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) return error.message;
  await admin.from("notifications").delete().eq("entity_id", id);
  return null;
}

/** Removes for good the tasks that have been in the trash longer than `days`. Returns how many. */
export async function purgeExpiredTrash(admin: SupabaseClient, workspaceId: string, days: number): Promise<number> {
  if (!(await trashReady(admin))) return 0;
  const cutoff = new Date(Date.now() - days * 864e5).toISOString();
  const { data } = await admin.from("tasks").select("id").eq("workspace_id", workspaceId)
    .not("deleted_at", "is", null).lt("deleted_at", cutoff).limit(200);
  let removed = 0;
  for (const t of data ?? []) if (!(await purgeTask(admin, t.id))) removed++;
  return removed;
}
