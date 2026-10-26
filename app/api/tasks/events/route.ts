import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { notifyUsers } from "../_lib/notify";

const SELECT = "id, title, type, start_time, end_time, all_day, attendees, notes, video_call_link, color_override, created_by";

/** Calendar events visible to the caller: ones they created or are attending. GET ?from&to[&all=1] */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  let q = adminClient().from("calendar_events").select(SELECT).eq("workspace_id", ctx.workspaceId);
  if (sp.get("from")) q = q.gte("end_time", sp.get("from")!);
  if (sp.get("to")) q = q.lte("start_time", sp.get("to")!);
  if (sp.get("all") !== "1") q = q.or(`created_by.eq.${ctx.userId},attendees.cs.{${ctx.userId}}`);
  const { data, error } = await q.order("start_time").limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ events: data ?? [] });
}

async function validate(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "Title is required" };
  const s = new Date(String(body.start_time)), e = new Date(String(body.end_time));
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { error: "Invalid time" };
  if (e < s) return { error: "End must be after start" };
  return { title, start: s.toISOString(), end: e.toISOString() };
}

/** POST { title, start_time, end_time, all_day?, attendees?: userId[], notes?, video_call_link?, color? } */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const v = await validate(body);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const admin = adminClient();
  const requested: string[] = Array.isArray(body.attendees) ? body.attendees : [];
  const { data: valid } = requested.length
    ? await admin.from("profiles").select("user_id").eq("workspace_id", ctx.workspaceId).in("user_id", requested)
    : { data: [] as { user_id: string }[] };
  const attendees = [...new Set([ctx.userId, ...(valid ?? []).map((p) => p.user_id)])];

  const { data, error } = await admin.from("calendar_events").insert({
    workspace_id: ctx.workspaceId, title: v.title, type: "event",
    start_time: v.start, end_time: v.end, all_day: !!body.all_day, attendees,
    notes: body.notes ?? null, video_call_link: body.video_call_link || null,
    color_override: body.color || null, created_by: ctx.userId,
  }).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyUsers(admin, ctx.workspaceId, attendees.filter((a) => a !== ctx.userId), {
    type: "event_reminder", title: "You were invited to an event",
    body: `${v.title} — ${new Date(v.start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
    entity_type: "calendar_event", entity_id: data.id,
  }).catch(() => {});
  return NextResponse.json({ event: data });
}

/** PATCH { id, ...fields } — only the organiser can edit. */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const admin = adminClient();
  const { data: existing } = await admin.from("calendar_events").select("*").eq("id", body.id ?? "").eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (existing.created_by !== ctx.userId) return NextResponse.json({ error: "Only the organiser can edit this event" }, { status: 403 });

  const v = await validate({ ...existing, ...body });
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const update: Record<string, unknown> = { title: v.title, start_time: v.start, end_time: v.end };
  if ("all_day" in body) update.all_day = !!body.all_day;
  if ("notes" in body) update.notes = body.notes || null;
  if ("video_call_link" in body) update.video_call_link = body.video_call_link || null;
  if ("color" in body) update.color_override = body.color || null;
  if (Array.isArray(body.attendees)) {
    const { data: valid } = await admin.from("profiles").select("user_id").eq("workspace_id", ctx.workspaceId).in("user_id", body.attendees);
    update.attendees = [...new Set([ctx.userId, ...(valid ?? []).map((p) => p.user_id)])];
  }
  const { data, error } = await admin.from("calendar_events").update(update).eq("id", existing.id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ event: data });
}

/** DELETE ?id= — organiser only. */
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const admin = adminClient();
  const { data: existing } = await admin.from("calendar_events").select("created_by").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (existing.created_by !== ctx.userId) return NextResponse.json({ error: "Only the organiser can delete this event" }, { status: 403 });
  await admin.from("calendar_events").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
