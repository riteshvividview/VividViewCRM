import type { SupabaseClient } from "@supabase/supabase-js";

/** How HR sees the Tasks app: like an employee, read only, or not at all. */
export type HrAccess = "full" | "view" | "hidden";
export type DeleteRule = "creator" | "leads";

export interface TaskSettings {
  retention_enabled: boolean;
  /** Days after completion before reference files and chat media are removed. */
  retention_days: number;
  last_cleanup_at: string | null;
  hr_access: HrAccess;
  delete_rule: DeleteRule;
  /** Days a read notification is kept after it was read. */
  notif_read_days: number;
  /** Days an unread notification is kept. */
  notif_unread_days: number;
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  retention_enabled: true,
  retention_days: 30,
  last_cleanup_at: null,
  hr_access: "hidden",
  delete_rule: "creator",
  notif_read_days: 30,
  notif_unread_days: 90,
};

// "*" rather than a column list, so settings still load before newer columns exist (migration 47).
/** Workspace task settings (managed by the CEO); defaults when nothing was saved yet. */
export async function getTaskSettings(admin: SupabaseClient, workspaceId: string): Promise<TaskSettings> {
  const { data } = await admin.from("task_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return data ? { ...DEFAULT_TASK_SETTINGS, ...(data as Partial<TaskSettings>) } : DEFAULT_TASK_SETTINGS;
}

export async function saveTaskSettings(admin: SupabaseClient, workspaceId: string, userId: string, patch: Partial<TaskSettings>) {
  return admin.from("task_settings")
    .upsert({ workspace_id: workspaceId, ...patch, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" })
    .select("*").single();
}

/**
 * Deletes old notifications of the workspace's people: read ones `readDays` after
 * they were read, unread ones `unreadDays` after they arrived. Returns how many.
 * Before migration 47 (no read_at) a read notification counts from when it arrived.
 */
export async function purgeOldNotifications(admin: SupabaseClient, workspaceId: string, readDays: number, unreadDays: number): Promise<number> {
  const { data: people } = await admin.from("profiles").select("user_id").eq("workspace_id", workspaceId);
  const users = (people ?? []).map((p) => p.user_id as string);
  if (!users.length) return 0;
  const readCutoff = new Date(Date.now() - readDays * 864e5).toISOString();
  const unreadCutoff = new Date(Date.now() - unreadDays * 864e5).toISOString();

  let read = await admin.from("notifications").delete().in("user_id", users).eq("read", true)
    .or(`read_at.lt.${readCutoff},and(read_at.is.null,created_at.lt.${readCutoff})`).select("id");
  if (read.error) {
    read = await admin.from("notifications").delete().in("user_id", users).eq("read", true).lt("created_at", readCutoff).select("id");
  }
  const unread = await admin.from("notifications").delete().in("user_id", users).eq("read", false).lt("created_at", unreadCutoff).select("id");
  return (read.data?.length ?? 0) + (unread.data?.length ?? 0);
}
