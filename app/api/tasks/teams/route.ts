import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isLead, readOnlyResponse, syncWorkspace } from "../_lib/helpers";
import { TEAM_SELECT, myTeamIds, serializeTeam, setTeamMembers, type TeamRow } from "../_lib/teams";

/** Teams the caller can use: every team for the CEO and team leads, otherwise the ones they belong to. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  const { data, error } = await admin.from("teams").select(TEAM_SELECT).eq("workspace_id", ctx.workspaceId).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let rows = (data ?? []) as TeamRow[];
  if (!isLead(ctx.role)) {
    const mine = await myTeamIds(admin, ctx.userId);
    rows = rows.filter((t) => mine.has(t.id));
  }
  return NextResponse.json({ teams: rows.map(serializeTeam), can_manage: isLead(ctx.role) && !ctx.readOnly });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.readOnly) return readOnlyResponse();
  if (!isLead(ctx.role)) return NextResponse.json({ error: "Only the CEO and team leads can create teams" }, { status: 403 });
  syncWorkspace(ctx.workspaceId);

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Team name is too long" }, { status: 400 });

  const admin = adminClient();
  const { data: clash } = await admin.from("teams").select("id").eq("workspace_id", ctx.workspaceId).ilike("name", name).maybeSingle();
  if (clash) return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });

  const { data: team, error } = await admin.from("teams")
    .insert({ workspace_id: ctx.workspaceId, name, color: typeof body.color === "string" ? body.color : "#6366f1", manager_id: ctx.userId })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await setTeamMembers(admin, ctx.workspaceId, team.id, Array.isArray(body.member_ids) ? body.member_ids : []);
  const { data: full } = await admin.from("teams").select(TEAM_SELECT).eq("id", team.id).single();
  return NextResponse.json({ team: serializeTeam(full as TeamRow) });
}
