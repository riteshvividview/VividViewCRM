import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/modules/notifications/types";

interface NotifyParams {
  type: NotificationType;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
}

/**
 * Sends a Realtime broadcast from the server (no socket needed). The messages are
 * only "something changed" pings; receivers re-read their data through the API,
 * so nothing private travels over the channel.
 */
export async function broadcast(messages: { topic: string; event: string }[]): Promise<void> {
  if (!messages.length) return;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ messages: messages.map((m) => ({ topic: m.topic, event: m.event, payload: {} })) }),
  }).catch(() => {});
}

/** Channel a signed-in user listens on for "you have a new notification". */
export const userChannel = (userId: string) => `user-notify:${userId}`;

/** Inserts an in-app notification row for each given user (service-role, bypasses RLS) and pings them live. */
export async function notifyUsers(
  admin: SupabaseClient,
  workspaceId: string,
  userIds: (string | null | undefined)[],
  params: NotifyParams
) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  const { error } = await admin.from("notifications").insert(
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
  if (!error) await broadcast(ids.map((id) => ({ topic: userChannel(id), event: "new" })));
}
