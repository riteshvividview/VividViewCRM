import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isValidDateString } from "../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  let query = admin
    .from("hr_holidays")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("date", { ascending: true });

  if (from && isValidDateString(from)) query = query.gte("date", from);
  if (to && isValidDateString(to)) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ holidays: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name: string = body.name?.trim() ?? "";
  const date: string = body.date ?? "";
  if (!name) return NextResponse.json({ error: "Holiday name is required" }, { status: 400 });
  if (!isValidDateString(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const holidayType = ["national", "regional", "company", "optional"].includes(body.holiday_type)
    ? body.holiday_type
    : "company";

  const admin = adminClient();
  const { data, error } = await admin
    .from("hr_holidays")
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      date,
      holiday_type: holidayType,
      department_ids: Array.isArray(body.department_ids) && body.department_ids.length ? body.department_ids : null,
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ holiday: data });
}
