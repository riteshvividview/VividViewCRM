import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { getTaskSettings } from "../_lib/settings";
import { GET as membersGET } from "../members/route";
import { GET as teamsGET } from "../teams/route";
import { GET as projectsGET } from "../projects/route";
import { GET as typesGET } from "../types/route";

/**
 * Everything the Tasks app needs besides the tasks, in one request:
 * members, teams, brands, task types and the two settings every screen uses.
 * (Each part runs the same code as its own endpoint, all at the same time.)
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const read = async (res: Response) => (res.ok ? res.json() : {});
  const [members, teams, projects, types, settings] = await Promise.all([
    membersGET().then(read),
    teamsGET().then(read),
    projectsGET(request).then(read),
    typesGET().then(read),
    getTaskSettings(adminClient(), ctx.workspaceId),
  ]);
  return NextResponse.json({
    members: members.members ?? [],
    teams: teams.teams ?? [],
    can_manage_teams: !!teams.can_manage,
    projects: projects.projects ?? [],
    types: types.types ?? [],
    settings: { read_only: ctx.readOnly, delete_rule: settings.delete_rule },
  });
}
