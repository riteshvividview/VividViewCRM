import { NextResponse } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { notifyUsers } from "../_lib/notify";
import { purgeExpiredFiles } from "../_lib/files";
import { hideTrashed, purgeExpiredTrash, trashReady } from "../_lib/trash";
import { getTaskSettings, purgeOldNotifications } from "../_lib/settings";
import { maybeSendHoldDigest } from "../_lib/hold";
import { notifyCeos } from "../_lib/ceo-notify";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Called once when the Tasks app opens. Returns the caller's open tasks that are
 * overdue or due today / tomorrow, and saves one bell notification per task per day.
 * Also runs the automatic file cleanup for the workspace (cheap when there is nothing to remove).
 */
export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();

  const now = new Date();
  const today = iso(now);
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const { data: mine } = await admin.from("task_assignees").select("task_id").eq("user_id", ctx.userId);
  const ids = (mine ?? []).map((m) => m.task_id);
  let q = hideTrashed(admin.from("tasks").select("id, title, due_date, priority"), await trashReady(admin))
    .eq("workspace_id", ctx.workspaceId).neq("status", "done").is("hold_at", null).not("due_date", "is", null).lte("due_date", tomorrow);
  q = ids.length ? q.or(`assignee_id.eq.${ctx.userId},id.in.(${ids.join(",")})`) : q.eq("assignee_id", ctx.userId);
  const { data: due } = await q.order("due_date").limit(100);

  const reminders = (due ?? []).map((t) => {
    const days = Math.round((new Date(`${t.due_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400_000);
    return { id: t.id, title: t.title, due_date: t.due_date as string, priority: t.priority, days };
  });

  // One notification per task per day.
  if (reminders.length) {
    const { data: sent } = await admin.from("notifications").select("entity_id")
      .eq("user_id", ctx.userId).eq("type", "task_due").gte("created_at", `${today}T00:00:00`).in("entity_id", reminders.map((r) => r.id));
    const already = new Set((sent ?? []).map((s) => s.entity_id));
    for (const r of reminders.filter((x) => !already.has(x.id))) {
      const title = r.days < 0 ? `Overdue by ${-r.days} day${r.days === -1 ? "" : "s"}` : r.days === 0 ? "Deadline is today" : "Deadline is tomorrow";
      await notifyUsers(admin, ctx.workspaceId, [ctx.userId], { type: "task_due", title, body: r.title, entity_type: "task", entity_id: r.id }).catch(() => {});
    }
  }

  // Automatic cleanup, when the CEO has it switched on.
  const settings = await getTaskSettings(admin, ctx.workspaceId);
  if (settings.retention_enabled) await purgeExpiredFiles(admin, ctx.workspaceId, settings.retention_days).catch(() => 0);
  // Tasks in the trash longer than the CEO's setting are removed for good.
  await purgeExpiredTrash(admin, ctx.workspaceId, settings.trash_days).catch(() => 0);
  await purgeOldNotifications(admin, ctx.workspaceId, settings.notif_read_days, settings.notif_unread_days).catch(() => 0);
  // CEO: once a day, how many tasks across the workspace are past their deadline.
  if (ctx.role === "super_admin") {
    const { count: sentToday } = await admin.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId).eq("entity_type", "ceo_overdue").gte("created_at", `${today}T00:00:00`);
    if (!sentToday) {
      const { count: overdue } = await hideTrashed(admin.from("tasks").select("id", { count: "exact", head: true }), await trashReady(admin))
        .eq("workspace_id", ctx.workspaceId).neq("status", "done").is("hold_at", null).lt("due_date", today);
      if (overdue) {
        await notifyCeos(admin, ctx.workspaceId, "ceo_overdue", {
          type: "task_due", title: `${overdue} task${overdue === 1 ? " is" : "s are"} overdue`, body: "Open Reports to see which ones and who they belong to.", entity_type: "ceo_overdue",
        }, { only: ctx.userId }).catch(() => 0);
      }
    }
  }
  // Monday from 10:00 IST: the CEOs' weekly "tasks on hold" summary (sent once a week).
  await maybeSendHoldDigest(admin, ctx.workspaceId).catch(() => false);
  return NextResponse.json({ reminders });
}
