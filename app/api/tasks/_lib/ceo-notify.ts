import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notify";
import { normalizeNotificationPrefs, type NotificationCategory } from "@/modules/notifications/preferences";
import type { NotificationType } from "@/modules/notifications/types";

/**
 * Notifications only the CEOs get (new tasks, completed tasks, the daily overdue summary).
 * Each CEO's own settings are checked first, so a switched-off kind isn't even stored.
 */
export async function notifyCeos(
  admin: SupabaseClient,
  workspaceId: string,
  category: NotificationCategory,
  params: { type: NotificationType; title: string; body: string; entity_type: string; entity_id?: string },
  opts: { except?: (string | null | undefined)[]; only?: string } = {},
) {
  const { data } = await admin.from("profiles").select("user_id").eq("workspace_id", workspaceId).eq("role", "super_admin").eq("disabled", false);
  const skip = new Set((opts.except ?? []).filter(Boolean) as string[]);
  let ids = (data ?? []).map((p) => p.user_id as string).filter((id) => !skip.has(id));
  if (opts.only) ids = ids.filter((id) => id === opts.only);
  const wanted: string[] = [];
  for (const id of ids) {
    const { data: u } = await admin.auth.admin.getUserById(id);
    const prefs = normalizeNotificationPrefs(u.user?.user_metadata?.notification_prefs);
    if (prefs.all && prefs[category]) wanted.push(id);
  }
  if (wanted.length) await notifyUsers(admin, workspaceId, wanted, params);
  return wanted.length;
}
