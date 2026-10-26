import { NextResponse } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";

/** Workspace members + teams, used to populate assignee pickers (multi-assign, team assign). */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const [profilesRes, teamsRes] = await Promise.all([
    admin.from("profiles").select("user_id, full_name, avatar_url, role").eq("workspace_id", ctx.workspaceId).order("full_name"),
    admin.from("teams").select("id, name, team_members(user_id)").eq("workspace_id", ctx.workspaceId).order("name"),
  ]);

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
  if (teamsRes.error) return NextResponse.json({ error: teamsRes.error.message }, { status: 400 });

  const members = (profilesRes.data ?? []).map((p) => ({
    id: p.user_id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    role: p.role,
  }));

  const teams = (teamsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    member_ids: ((t.team_members ?? []) as { user_id: string }[]).map((m) => m.user_id),
  }));

  return NextResponse.json({ members, teams });
}
