import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("task_labels")
    .select("id, name, color")
    .eq("workspace_id", ctx.workspaceId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ labels: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("task_labels")
    .insert({ workspace_id: ctx.workspaceId, name, color: body.color ?? "#6366f1", created_by: ctx.userId })
    .select("id, name, color")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ label: data });
}
