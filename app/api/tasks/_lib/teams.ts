import type { SupabaseClient } from "@supabase/supabase-js";
import { isLead, type AuthContext } from "./helpers";

/**
 * Team visibility for tasks. A task can belong to one team; then only that
 * team's members see it, plus the CEO and team leads (who manage teams) and
 * anyone it was created by or assigned to. Tasks without a team are visible
 * to everyone in the workspace.
 */
export interface TeamRef { id: string; name: string; color: string | null }

/**
 * task id → team id. Empty when the tasks.team_id column does not exist yet
 * (migration 45 not run), so the rest of the app keeps working without teams.
 */
export async function teamIdsOfTasks(admin: SupabaseClient, taskIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!taskIds.length) return out;
  const { data, error } = await admin.from("tasks").select("id, team_id").in("id", taskIds).not("team_id", "is", null);
  if (error) return out;
  for (const r of (data ?? []) as { id: string; team_id: string }[]) out.set(r.id, r.team_id);
  return out;
}

export async function teamsById(admin: SupabaseClient, ids: string[]): Promise<Map<string, TeamRef>> {
  const out = new Map<string, TeamRef>();
  if (!ids.length) return out;
  const { data } = await admin.from("teams").select("id, name, color").in("id", ids);
  for (const t of (data ?? []) as TeamRef[]) out.set(t.id, t);
  return out;
}

/** Ids of the teams the user is a member of. */
export async function myTeamIds(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await admin.from("team_members").select("team_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.team_id as string));
}

interface VisibleTask { team_id?: string | null; created_by?: string | null; assignee_id?: string | null; assignees?: { id: string }[] }

export function taskVisible(ctx: AuthContext, mine: Set<string>, task: VisibleTask): boolean {
  if (!task.team_id || isLead(ctx.role)) return true;
  if (mine.has(task.team_id)) return true;
  return task.created_by === ctx.userId || task.assignee_id === ctx.userId || !!task.assignees?.some((a) => a.id === ctx.userId);
}

/** Whether the caller may open this task at all (used by every per-task route). */
export async function canAccessTask(admin: SupabaseClient, ctx: AuthContext, taskId: string): Promise<boolean> {
  if (isLead(ctx.role)) return true;
  const teamId = (await teamIdsOfTasks(admin, [taskId])).get(taskId);
  if (!teamId) return true;
  const [mine, { data: task }, { data: assigned }] = await Promise.all([
    myTeamIds(admin, ctx.userId),
    admin.from("tasks").select("created_by, assignee_id").eq("id", taskId).maybeSingle(),
    admin.from("task_assignees").select("user_id").eq("task_id", taskId).eq("user_id", ctx.userId).maybeSingle(),
  ]);
  return mine.has(teamId) || task?.created_by === ctx.userId || task?.assignee_id === ctx.userId || !!assigned;
}

/** A team the caller may put a task in: any team for leads, otherwise one they belong to. */
export async function canUseTeam(admin: SupabaseClient, ctx: AuthContext, teamId: string): Promise<boolean> {
  const { data: team } = await admin.from("teams").select("id").eq("id", teamId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!team) return false;
  return isLead(ctx.role) || (await myTeamIds(admin, ctx.userId)).has(teamId);
}

export const TEAMS_MIGRATION_HINT = "Teams are not set up in the database yet. Run RUN-ME-45-task-teams.sql in Supabase first.";

export const TEAM_SELECT = "id, name, color, created_at, team_members(user_id)";
export type TeamRow = { id: string; name: string; color: string | null; team_members: { user_id: string }[] | null };
export const serializeTeam = (t: TeamRow) => ({ id: t.id, name: t.name, color: t.color, member_ids: (t.team_members ?? []).map((m) => m.user_id) });

/** Replaces a team's members with the given workspace users. */
export async function setTeamMembers(admin: SupabaseClient, workspaceId: string, teamId: string, userIds: string[]) {
  const { data: valid } = userIds.length
    ? await admin.from("profiles").select("user_id").eq("workspace_id", workspaceId).in("user_id", userIds)
    : { data: [] as { user_id: string }[] };
  const wanted = new Set((valid ?? []).map((v) => v.user_id));
  const { data: current } = await admin.from("team_members").select("user_id").eq("team_id", teamId);
  const have = new Set((current ?? []).map((c) => c.user_id as string));
  const remove = [...have].filter((u) => !wanted.has(u));
  const add = [...wanted].filter((u) => !have.has(u));
  if (remove.length) await admin.from("team_members").delete().eq("team_id", teamId).in("user_id", remove);
  if (add.length) {
    // "member" needs migration 45; fall back to the old default role until it has run.
    const { error } = await admin.from("team_members").insert(add.map((user_id) => ({ team_id: teamId, user_id, role: "member" })));
    if (error) await admin.from("team_members").insert(add.map((user_id) => ({ team_id: teamId, user_id, role: "rep" })));
  }
}

/**
 * Read access: anyone in the workspace may view a task that belongs to a brand
 * (the Brands tab shows every brand task). Changing it still needs canAccessTask.
 */
export async function canReadTask(admin: SupabaseClient, ctx: AuthContext, taskId: string): Promise<boolean> {
  if (await canAccessTask(admin, ctx, taskId)) return true;
  const { data } = await admin.from("tasks").select("project_id").eq("id", taskId).maybeSingle();
  return !!data?.project_id;
}

/** User ids of a team's members. */
export async function teamMemberIds(admin: SupabaseClient, teamId: string): Promise<Set<string>> {
  const { data } = await admin.from("team_members").select("user_id").eq("team_id", teamId);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

/**
 * A team task may only be assigned to that team's members. Returns an error
 * message naming the people who are not in the team, or null when all are.
 */
export async function assigneesOutsideTeam(admin: SupabaseClient, teamId: string, userIds: string[]): Promise<string | null> {
  if (!userIds.length) return null;
  const members = await teamMemberIds(admin, teamId);
  const outside = userIds.filter((u) => !members.has(u));
  if (!outside.length) return null;
  const [{ data: people }, { data: team }] = await Promise.all([
    admin.from("profiles").select("full_name").in("user_id", outside),
    admin.from("teams").select("name").eq("id", teamId).maybeSingle(),
  ]);
  const names = (people ?? []).map((p) => p.full_name).join(", ") || "Some people";
  return `${names} ${outside.length === 1 ? "is" : "are"} not in ${team?.name ?? "this team"}. A team task can only be assigned to the team's members.`;
}

/** Of the given task ids, the ones the caller may see (used where tasks appear inside other lists). */
export async function visibleTaskIds(admin: SupabaseClient, ctx: AuthContext, taskIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(taskIds)];
  if (isLead(ctx.role)) return new Set(ids);
  const teamByTask = await teamIdsOfTasks(admin, ids);
  const teamTasks = ids.filter((id) => teamByTask.has(id));
  if (!teamTasks.length) return new Set(ids);
  const [mine, { data: rows }, { data: assigned }] = await Promise.all([
    myTeamIds(admin, ctx.userId),
    admin.from("tasks").select("id, created_by, assignee_id").in("id", teamTasks),
    admin.from("task_assignees").select("task_id").eq("user_id", ctx.userId).in("task_id", teamTasks),
  ]);
  const mineAssigned = new Set((assigned ?? []).map((a) => a.task_id as string));
  const allowed = new Set(ids.filter((id) => !teamByTask.has(id)));
  for (const r of rows ?? []) {
    if (mine.has(teamByTask.get(r.id)!) || r.created_by === ctx.userId || r.assignee_id === ctx.userId || mineAssigned.has(r.id)) allowed.add(r.id);
  }
  return allowed;
}

/**
 * Who may change a task: its creator, its assignees, team leads and the CEO.
 * Everyone else who can see it (teammates, the Brands tab) may look and, if they
 * have team access, chat, but not change anything.
 */
export function taskEditable(ctx: AuthContext, task: VisibleTask): boolean {
  if (ctx.readOnly) return false;
  if (isLead(ctx.role)) return true;
  return task.created_by === ctx.userId || task.assignee_id === ctx.userId || !!task.assignees?.some((a) => a.id === ctx.userId);
}

export async function canEditTask(admin: SupabaseClient, ctx: AuthContext, taskId: string): Promise<boolean> {
  if (ctx.readOnly) return false;
  if (isLead(ctx.role)) return true;
  const [{ data: t }, { data: a }] = await Promise.all([
    admin.from("tasks").select("created_by, assignee_id").eq("id", taskId).maybeSingle(),
    admin.from("task_assignees").select("user_id").eq("task_id", taskId).eq("user_id", ctx.userId).maybeSingle(),
  ]);
  return !!t && (t.created_by === ctx.userId || t.assignee_id === ctx.userId || !!a);
}

export const NOT_YOURS_MESSAGE = "Only the people working on this task can change it.";
