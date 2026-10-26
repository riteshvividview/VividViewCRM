import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data, error } = await admin
    .from("hr_shifts")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ shifts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name: string = body.name?.trim() ?? "";
  const code: string = body.code?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
  if (!name) return NextResponse.json({ error: "Shift name is required" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Shift code is required" }, { status: 400 });

  const admin = adminClient();

  if (body.is_default) {
    await admin.from("hr_shifts").update({ is_default: false }).eq("workspace_id", ctx.workspaceId).eq("is_default", true);
  }

  const { data, error } = await admin.from("hr_shifts").insert({
    workspace_id: ctx.workspaceId,
    name,
    code,
    start_time: body.start_time ?? "09:00",
    end_time: body.end_time ?? "18:00",
    is_night_shift: !!body.is_night_shift,
    is_flexible: !!body.is_flexible,
    flexible_hours_per_day: body.is_flexible ? Number(body.flexible_hours_per_day) || 8 : null,
    working_days: Array.isArray(body.working_days) && body.working_days.length ? body.working_days : [1, 2, 3, 4, 5],
    break_minutes: Number(body.break_minutes) || 60,
    grace_period_minutes: Number(body.grace_period_minutes) || 10,
    half_day_threshold_minutes: Number(body.half_day_threshold_minutes) || 240,
    full_day_threshold_minutes: Number(body.full_day_threshold_minutes) || 480,
    overtime_threshold_minutes: Number(body.overtime_threshold_minutes) || 480,
    is_default: !!body.is_default,
    status: "active",
    created_by: ctx.userId,
  }).select("*").single();

  if (error) {
    const msg = error.message.includes("duplicate") ? "A shift with this code already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ shift: data });
}
