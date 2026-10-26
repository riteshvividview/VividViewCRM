import { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/modules/notifications/types";

interface NotifyParams {
  type: NotificationType;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
}

/** Inserts an in-app notification row for each given user (service-role, bypasses RLS). */
export async function notifyUsers(
  admin: SupabaseClient,
  workspaceId: string,
  userIds: (string | null | undefined)[],
  params: NotifyParams
) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  await admin.from("notifications").insert(
    ids.map((user_id) => ({
      workspace_id: workspaceId,
      user_id,
      type: params.type,
      title: params.title,
      body: params.body,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      read: false,
    }))
  );
}

/** Notifies every HR / super_admin user in the workspace. */
export async function notifyHR(admin: SupabaseClient, workspaceId: string, params: NotifyParams) {
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .in("role", ["super_admin", "hr"]);

  await notifyUsers(admin, workspaceId, (data ?? []).map((p) => p.user_id), params);
}
