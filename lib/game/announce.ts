import type { SupabaseClient } from "@supabase/supabase-js";
import { broadcast, userChannel } from "@/app/api/tasks/_lib/notify";
import { featureAudience } from "@/lib/dev/server";
import { mutedAmong } from "./prefs";

export type GameAnnouncement =
  | { kind: "launch" }
  | { kind: "starting"; by: string; players: string[] };

/**
 * Pings everyone the game is on for, on their own live channel (the one the notification bell
 * already listens on). Nothing is stored; people who aren't online simply miss it.
 */
export async function announceGame(admin: SupabaseClient, workspaceId: string, msg: GameAnnouncement, except?: string) {
  const all = (await featureAudience(admin, workspaceId, "draw_guess")).filter((id) => id !== except);
  if (!all.length) return 0;
  // People who turned game popups off get nothing.
  const muted = await mutedAmong(admin, all);
  const ids = all.filter((id) => !muted.has(id));
  if (!ids.length) return 0;
  await broadcast(ids.map((id) => ({ topic: userChannel(id), event: "game", payload: msg as unknown as Record<string, unknown> })));
  return ids.length;
}
