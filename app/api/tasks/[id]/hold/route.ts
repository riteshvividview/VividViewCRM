import { NextResponse, type NextRequest } from "next/server";
import { adminClient, getAuthContext, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import { hideTrashed, trashReady } from "../../_lib/trash";
import { canAccessTask } from "../../_lib/teams";
import { notifyUsers } from "../../_lib/notify";
import { ceoIds, linkedPeople } from "../../_lib/hold";

async function load(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (ctx.readOnly) return { error: readOnlyResponse() };
  const admin = adminClient();
  const { data: task, error } = await hideTrashed(admin.from("tasks").select("id, title, status, hold_at, hold_by, hold_reason, workspace_id"), await trashReady(admin))
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Run RUN-ME-57-task-on-hold.sql in Supabase first." }, { status: 400 }) };
  if (!task || !(await canAccessTask(admin, ctx, id))) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  return { ctx, admin, task };
}

const nameOf = async (admin: ReturnType<typeof adminClient>, userId: string) =>
  (await admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle()).data?.full_name || "Someone";

/** POST { reason }: put the task on hold. Anyone linked to the task (or a lead) may; a reason is required. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { ctx, admin, task } = r;
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3) return NextResponse.json({ error: "Please give a reason for putting this task on hold" }, { status: 400 });
  if (reason.length > 500) return NextResponse.json({ error: "Please keep the reason under 500 characters" }, { status: 400 });
  if (task.status === "done") return NextResponse.json({ error: "A completed task can't be put on hold" }, { status: 400 });
  if (task.hold_at) return NextResponse.json({ error: "This task is already on hold" }, { status: 409 });

  const linked = await linkedPeople(admin, id);
  const lead = ctx.role === "super_admin" || ctx.role === "team_lead";
  if (!lead && !linked.has(ctx.userId)) return NextResponse.json({ error: "Only people working on this task can put it on hold" }, { status: 403 });

  const { error } = await admin.from("tasks").update({ hold_at: new Date().toISOString(), hold_by: ctx.userId, hold_reason: reason }).eq("id", id).is("hold_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  syncWorkspace(ctx.workspaceId, { tasks: [id] });
  await admin.from("task_activity_log").insert({ task_id: id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "updated", new_value: { on_hold: reason } }).then(() => {}, () => {});

  // The CEOs hear about it straight away (not the one who did it).
  const who = await nameOf(admin, ctx.userId);
  await notifyUsers(admin, ctx.workspaceId, (await ceoIds(admin, ctx.workspaceId)).filter((u) => u !== ctx.userId), {
    type: "task_on_hold", title: `${who} put a task on hold`, body: `${task.title}: ${reason}`, entity_type: "task", entity_id: id,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE: resume the task. Only a CEO can; everyone on the task is told. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const { ctx, admin, task } = r;
  if (ctx.role !== "super_admin") return NextResponse.json({ error: "You can't resume this task" }, { status: 403 });
  if (!task.hold_at) return NextResponse.json({ error: "This task isn't on hold" }, { status: 409 });

  const linked = await linkedPeople(admin, id); // read before clearing, so the person who held it is included
  const { error } = await admin.from("tasks").update({ hold_at: null, hold_by: null, hold_reason: null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  syncWorkspace(ctx.workspaceId, { tasks: [id] });
  await admin.from("task_activity_log").insert({ task_id: id, workspace_id: ctx.workspaceId, actor_id: ctx.userId, action: "updated", new_value: { resumed: true } }).then(() => {}, () => {});

  const who = await nameOf(admin, ctx.userId);
  await notifyUsers(admin, ctx.workspaceId, [...linked].filter((u) => u !== ctx.userId), {
    type: "task_resumed", title: `${who} resumed a task`, body: `${task.title} is back in progress.`, entity_type: "task", entity_id: id,
  });
  return NextResponse.json({ ok: true });
}
