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
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  retention_enabled: true,
  retention_days: 30,
  last_cleanup_at: null,
  hr_access: "hidden",
  delete_rule: "creator",
};

const COLUMNS = "retention_enabled, retention_days, last_cleanup_at, hr_access, delete_rule";

/** Workspace task settings (managed by the CEO); defaults when nothing was saved yet. */
export async function getTaskSettings(admin: SupabaseClient, workspaceId: string): Promise<TaskSettings> {
  const { data } = await admin.from("task_settings").select(COLUMNS).eq("workspace_id", workspaceId).maybeSingle();
  return data ? { ...DEFAULT_TASK_SETTINGS, ...(data as Partial<TaskSettings>) } : DEFAULT_TASK_SETTINGS;
}

export async function saveTaskSettings(admin: SupabaseClient, workspaceId: string, userId: string, patch: Partial<TaskSettings>) {
  return admin.from("task_settings")
    .upsert({ workspace_id: workspaceId, ...patch, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" })
    .select(COLUMNS).single();
}
