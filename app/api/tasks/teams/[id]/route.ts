import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isLead, readOnlyResponse, syncWorkspace } from "../../_lib/helpers";
import { hideTrashed, trashReady } from "../../_lib/trash";
import { TEAM_SELECT, serializeTeam, setTeamMembers, type TeamRow } from "../../_lib/teams";

type Params = { params: Promise<{ id: string }> };

/** The team's members with email and role (for the Members tool). Leads and the team's own members. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  const { data: team } = await admin.from("teams").select("id, name, color, team_members(user_id)").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  const ids = ((team?.team_members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (!team || (!isLead(ctx.role) && !ids.includes(ctx.userId))) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, full_name, avatar_url, role").in("user_id", ids)
    : { data: [] as { user_id: string; full_name: string; avatar_url: string | null; role: string }[] };
  // Emails live in auth.users (service role only).
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) if (ids.includes(u.id) && u.email) emails.set(u.id, u.email);
  }
  return NextResponse.json({
    members: (profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url, role: p.role, email: emails.get(p.user_id) ?? null }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
  });
}

async function load(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (ctx.readOnly) return { error: readOnlyResponse() };
  if (!isLead(ctx.role)) return { error: NextResponse.json({ error: "Only the CEO and team leads can manage teams" }, { status: 403 }) };
  const admin = adminClient();
  const { data: team } = await admin.from("teams").select("id, name").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!team) return { error: NextResponse.json({ error: "Team not found" }, { status: 404 }) };
  return { ctx, admin, team };
}

/** PATCH { name?, color?, member_ids? } — member_ids replaces the whole member list. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  syncWorkspace(r.ctx.workspaceId);
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) return NextResponse.json({ error: "Enter a team name (up to 80 characters)" }, { status: 400 });
    const { data: clash } = await r.admin.from("teams").select("id").eq("workspace_id", r.ctx.workspaceId).ilike("name", name).neq("id", id).maybeSingle();
    if (clash) return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.color === "string") patch.color = body.color;
  if (Object.keys(patch).length) {
    const { error } = await r.admin.from("teams").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (Array.isArray(body.member_ids)) await setTeamMembers(r.admin, r.ctx.workspaceId, id, body.member_ids);

  const { data: full } = await r.admin.from("teams").select(TEAM_SELECT).eq("id", id).single();
  return NextResponse.json({ team: serializeTeam(full as TeamRow) });
}

/** Deleting a team keeps its tasks; they simply stop belonging to a team (visible to everyone). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await load(id);
  if ("error" in r) return r.error;
  // Deleting a team would make its private tasks visible to everyone, so open tasks must be moved first.
  const { count } = await hideTrashed(r.admin.from("tasks").select("id", { count: "exact", head: true }).eq("team_id", id).neq("status", "done"), await trashReady(r.admin));
  if (count) {
    return NextResponse.json({ error: `${r.team.name} still has ${count} open task${count === 1 ? "" : "s"}. Move ${count === 1 ? "it" : "them"} to another team or complete ${count === 1 ? "it" : "them"} first.` }, { status: 400 });
  }
  syncWorkspace(r.ctx.workspaceId);
  const { error } = await r.admin.from("teams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
