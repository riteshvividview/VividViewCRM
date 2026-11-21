import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notify";

/**
 * Tasks on hold: a flag inside the task (hold_at / hold_by / hold_reason), not a status.
 * Anyone linked to the task can put it on hold with a reason; only a CEO can resume it.
 * Nothing in a held task is removed: files, chat and media stay; edits wait until it's resumed.
 */

/** Everyone linked to a task: creator, assignees, watchers, people mentioned in its chat, and whoever held it. */
export async function linkedPeople(admin: SupabaseClient, taskId: string): Promise<Set<string>> {
  const [{ data: t }, { data: a }, { data: w }, { data: m }] = await Promise.all([
    admin.from("tasks").select("created_by, assignee_id, hold_by").eq("id", taskId).maybeSingle(),
    admin.from("task_assignees").select("user_id").eq("task_id", taskId),
    admin.from("task_watchers").select("user_id").eq("task_id", taskId),
    admin.from("task_mentions").select("mentioned_user_id").eq("task_id", taskId),
  ]);
  const ids = new Set<string>();
  for (const v of [t?.created_by, t?.assignee_id, t?.hold_by]) if (v) ids.add(v);
  for (const r of a ?? []) ids.add(r.user_id);
  for (const r of w ?? []) ids.add(r.user_id);
  for (const r of m ?? []) if (r.mentioned_user_id) ids.add(r.mentioned_user_id);
  return ids;
}

/** The CEOs of a workspace (active ones). */
export async function ceoIds(admin: SupabaseClient, workspaceId: string): Promise<string[]> {
  const { data } = await admin.from("profiles").select("user_id").eq("workspace_id", workspaceId).eq("role", "super_admin").eq("disabled", false);
  return (data ?? []).map((p) => p.user_id as string);
}

/** Monday 10:00 in India (IST, UTC+5:30) of the current week, as a UTC instant. */
function thisMondayTenIST(now = new Date()): Date {
  const IST = 330 * 60_000;
  const local = new Date(now.getTime() + IST); // shifted so getUTC* read India time
  const back = (local.getUTCDay() + 6) % 7;     // days since Monday
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back, 10, 0);
  return new Date(monday - IST);
}

/**
 * The weekly "tasks on hold" summary for the CEOs, every Monday from 10:00 IST.
 * Runs whenever someone opens the Tasks app (no scheduler needed) and sends at most once a week.
 */
export async function maybeSendHoldDigest(admin: SupabaseClient, workspaceId: string): Promise<boolean> {
  const due = thisMondayTenIST();
  if (Date.now() < due.getTime()) return false;
  const { data: s, error } = await admin.from("task_settings").select("hold_digest_at").eq("workspace_id", workspaceId).maybeSingle();
  if (error) return false; // migration 57 not run yet
  if (s?.hold_digest_at && new Date(s.hold_digest_at).getTime() >= due.getTime()) return false;
  // Claim the week first so two people opening the app at once can't send it twice.
  const { error: upErr } = await admin.from("task_settings").upsert({ workspace_id: workspaceId, hold_digest_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (upErr) return false;
  const { count } = await admin.from("tasks").select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId).not("hold_at", "is", null).is("deleted_at", null);
  const n = count ?? 0;
  const ceos = await ceoIds(admin, workspaceId);
  await notifyUsers(admin, workspaceId, ceos, {
    type: "hold_digest",
    title: n ? `${n} task${n === 1 ? " is" : "s are"} on hold` : "No tasks are on hold",
    body: n ? "Open Tasks on hold to see who held them and why, and resume them." : "Everything is moving. Nothing is waiting on hold this week.",
    entity_type: "hold_list",
  });
  return true;
}

/**
 * Every route that changes a task calls this first: while a task is on hold nothing about it can change
 * (details, people, labels, files, chat, time, trash) until a CEO resumes it. Returns the refusal, or null.
 */
export async function heldResponse(taskId: string): Promise<Response | null> {
  if (!taskId) return null;
  // The CEO can still do anything on a held task.
  const { getAuthContext } = await import("./helpers");
  if ((await getAuthContext())?.role === "super_admin") return null;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.from("tasks").select("hold_at").eq("id", taskId).maybeSingle();
  if (!data?.hold_at) return null;
  return Response.json({ error: "This task is on hold.", code: "on_hold" }, { status: 423 });
}
