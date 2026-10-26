import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, writeAuditLog } from "../../_lib/helpers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (!["resolved", "ignored"].includes(body.status)) {
    return NextResponse.json({ error: "status must be 'resolved' or 'ignored'" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: existing } = await admin
    .from("hr_attendance_exceptions")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Exception not found" }, { status: 404 });

  const nowISO = new Date().toISOString();
  const { data, error } = await admin
    .from("hr_attendance_exceptions")
    .update({
      status: body.status,
      resolution_note: typeof body.resolution_note === "string" ? body.resolution_note.trim() || null : null,
      resolved_by: ctx.userId,
      resolved_at: nowISO,
      updated_at: nowISO,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "attendance_exception",
    entity_id: id,
    action: body.status === "resolved" ? "exception_resolved" : "exception_ignored",
    description: `${body.status === "resolved" ? "Resolved" : "Ignored"} "${existing.exception_type}" exception for ${existing.date}`,
    changes: { before: existing, after: data },
    performed_by: ctx.userId,
  });

  return NextResponse.json({ exception: data });
}
