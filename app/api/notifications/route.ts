import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { broadcast, userChannel } from "@/app/api/tasks/_lib/notify";
import { normalizeNotificationPrefs, notificationAllowed } from "@/modules/notifications/preferences";
import { profileOf, signedIn } from "@/lib/auth/fast";
import { admin as adminClient } from "@/lib/auth/server";

/**
 * The signed-in user's own notifications. Runs as the user, so the database's
 * row rules keep every query to that person's rows only.
 */
async function me() {
  const supabase = await createClient();
  const claims = await signedIn(supabase);
  if (!claims) return null;
  const profile = await profileOf(adminClient(), claims.sub);
  if (!profile || profile.disabled) return null;
  const user = { id: claims.sub, user_metadata: claims.user_metadata ?? {} };
  return { supabase, user };
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
/** Other open tabs and devices of the same person re-read their list. */
const pingMe = (userId: string) => broadcast([{ topic: userChannel(userId), event: "new" }]);

/** PATCH: mark every one of my notifications read (not only the ones on screen). */
export async function PATCH() {
  const r = await me();
  if (!r) return unauthorized();
  const { error } = await r.supabase.from("notifications").update({ read: true }).eq("user_id", r.user.id).eq("read", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await pingMe(r.user.id);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE: "Clear all". Removes all of my notifications, only once everything I
 * can see is read. Kinds I switched off in Settings never show, so they don't block it.
 */
export async function DELETE() {
  const r = await me();
  if (!r) return unauthorized();
  const prefs = normalizeNotificationPrefs(r.user.user_metadata?.notification_prefs as Parameters<typeof normalizeNotificationPrefs>[0]);
  const { data: unread, error: readErr } = await r.supabase
    .from("notifications").select("type, entity_type").eq("user_id", r.user.id).eq("read", false);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if ((unread ?? []).some((n) => notificationAllowed(prefs, n))) {
    return NextResponse.json({ error: "Mark all notifications as read before clearing them.", code: "unread" }, { status: 409 });
  }
  const { data, error } = await r.supabase.from("notifications").delete().eq("user_id", r.user.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await pingMe(r.user.id);
  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
}
