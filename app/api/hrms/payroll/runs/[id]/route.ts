import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../../attendance/_lib/helpers";
import { approveRun, processRun } from "../../_lib/engine";

type Params = { params: Promise<{ id: string }> };

/** POST { action: "process", use_attendance?: boolean } | { action: "approve" } */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const { data: run } = await admin.from("hr_payroll_runs").select("*")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "process") {
      if (run.status === "approved") return NextResponse.json({ error: "Approved runs are locked" }, { status: 409 });
      const result = await processRun(admin, ctx.workspaceId, run, body.use_attendance !== false);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "approve") {
      if (run.status !== "completed") return NextResponse.json({ error: "Process the run before approving" }, { status: 409 });
      await approveRun(admin, ctx.workspaceId, run.id, ctx.userId, run.processed_at);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const { data: run } = await admin.from("hr_payroll_runs").select("status")
    .eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.status === "approved") return NextResponse.json({ error: "Approved runs cannot be deleted" }, { status: 409 });

  await admin.from("hr_payslips").delete().eq("payroll_run_id", id);
  await admin.from("hr_payroll_runs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
