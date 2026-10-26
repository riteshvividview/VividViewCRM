import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../attendance/_lib/helpers";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await adminClient()
    .from("hr_payroll_runs")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const month = Number(body.month);
  const year = Number(body.year);
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: existing } = await admin.from("hr_payroll_runs").select("id")
    .eq("workspace_id", ctx.workspaceId).eq("month", month).eq("year", year).maybeSingle();
  if (existing) return NextResponse.json({ error: "A payroll run for this month already exists" }, { status: 409 });

  const { data, error } = await admin.from("hr_payroll_runs")
    .insert({ workspace_id: ctx.workspaceId, month, year, status: "draft" })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ run: data });
}
