import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("task_projects")
    .select("id, name, description, status, color, icon, team_id, archived_at")
    .eq("workspace_id", ctx.workspaceId)
    .is("archived_at", null)
    .order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("task_projects")
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      description: body.description ?? null,
      team_id: body.team_id ?? null,
      color: body.color ?? "#6366f1",
      icon: body.icon ?? null,
      owner_id: ctx.userId,
      created_by: ctx.userId,
    })
    .select("id, name, description, status, color, icon, team_id, archived_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ project: data });
}
