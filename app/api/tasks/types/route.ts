import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";

const SELECT = "id, name, color, position";

// Bordio-style starter types (card colour = type colour). Editable per workspace.
const DEFAULT_TYPES = [
  { name: "General", color: "#5b6472" },
  { name: "Social Media", color: "#8a6a45" },
  { name: "Design", color: "#0e7490" },
  { name: "Branding", color: "#15803d" },
  { name: "Video", color: "#6d28d9" },
  { name: "Website", color: "#1d4ed8" },
];

/** Lists task types, creating the starter set the first time a workspace uses them. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  let { data, error } = await admin.from("task_types").select(SELECT).eq("workspace_id", ctx.workspaceId).order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) {
    const seeded = await admin.from("task_types").upsert(
      DEFAULT_TYPES.map((t, i) => ({ ...t, position: i, workspace_id: ctx.workspaceId })),
      { onConflict: "workspace_id,name", ignoreDuplicates: true },
    ).select(SELECT);
    data = (seeded.data ?? []).sort((a, b) => a.position - b.position);
  }
  return NextResponse.json({ types: data ?? [] });
}

/** POST { name, color } — HR/admins and team leads manage types. */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role) && ctx.role !== "team_lead") return NextResponse.json({ error: "Only admins and team leads can manage task types" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const admin = adminClient();
  const { count } = await admin.from("task_types").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId);
  const { data, error } = await admin.from("task_types").insert({
    workspace_id: ctx.workspaceId, name, color: body.color ?? "#5b6472", position: count ?? 0,
  }).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message.includes("duplicate") ? "A type with this name exists" : error.message }, { status: 400 });
  return NextResponse.json({ type: data });
}

/** PATCH { id, name?, color? } */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role) && ctx.role !== "team_lead") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.color === "string") update.color = body.color;
  const { data, error } = await adminClient().from("task_types").update(update)
    .eq("id", body.id ?? "").eq("workspace_id", ctx.workspaceId).select(SELECT).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Type not found" }, { status: 404 });
  return NextResponse.json({ type: data });
}

/** DELETE ?id= — tasks of this type become untyped. */
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role) && ctx.role !== "team_lead") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await adminClient().from("task_types").delete()
    .eq("id", request.nextUrl.searchParams.get("id") ?? "").eq("workspace_id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
