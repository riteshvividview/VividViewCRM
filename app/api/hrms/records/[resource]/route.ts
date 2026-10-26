import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../attendance/_lib/helpers";
import { RESOURCES } from "../_config";
import { pickFields } from "../_lib";

type Params = { params: Promise<{ resource: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { resource } = await params;
  const cfg = RESOURCES[resource];
  if (!cfg) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hr = isHR(ctx.role);
  if (cfg.read === "hr" && !hr) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = adminClient()
    .from(cfg.table)
    .select(cfg.select)
    .eq("workspace_id", ctx.workspaceId)
    .order(cfg.order.column, { ascending: cfg.order.ascending })
    .limit(500);

  if (cfg.read === "own" && !hr) {
    if (!ctx.employeeId) return NextResponse.json({ records: [] });
    const cols = ["employee_id", ...(cfg.extraOwnerColumns ?? [])];
    query = query.or(cols.map((c) => `${c}.eq.${ctx.employeeId}`).join(","));
  }

  const sp = request.nextUrl.searchParams;
  for (const f of cfg.filters ?? []) {
    const v = sp.get(f);
    if (v) query = query.eq(f, v);
  }
  if (sp.get("mine") === "1" && ctx.employeeId) query = query.eq("employee_id", ctx.employeeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ records: data ?? [], me: { employeeId: ctx.employeeId, isHR: hr } });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { resource } = await params;
  const cfg = RESOURCES[resource];
  if (!cfg) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hr = isHR(ctx.role);
  if (cfg.create === "hr" && !hr) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  // Non-HR can only set owner-editable fields, plus the target for feedback.
  const allowed = hr ? cfg.fields : [...(cfg.ownerFields ?? []), ...(resource === "feedback" ? ["to_employee_id", "kind"] : []), ...(resource === "exits" ? ["exit_type"] : [])];
  const row: Record<string, unknown> = pickFields(body, allowed);
  // New self-service records always start in the table's default (pending/requested) state.
  if (!hr && resource !== "goals") delete row.status;

  if (cfg.fields.includes("employee_id")) {
    // Non-HR always act as themselves; HR may target anyone and defaults to self for self-service records.
    if (!hr || (row.employee_id == null && cfg.create === "any")) {
      if (!ctx.employeeId) return NextResponse.json({ error: "Your account is not linked to an employee record" }, { status: 400 });
      row.employee_id = ctx.employeeId;
    }
  }

  for (const f of cfg.required) {
    if (row[f] === undefined || row[f] === null || row[f] === "") {
      return NextResponse.json({ error: `${f.replace(/_/g, " ")} is required` }, { status: 400 });
    }
  }

  if (resource === "loans" && row.outstanding === undefined) row.outstanding = row.amount;
  if (cfg.stampCreatedBy) row.created_by = ctx.userId;

  const { data, error } = await adminClient()
    .from(cfg.table)
    .insert({ ...row, workspace_id: ctx.workspaceId })
    .select(cfg.select)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ record: data });
}
