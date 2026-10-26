import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../_lib/helpers";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = adminClient();

  const { data: holiday } = await admin.from("hr_holidays").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!holiday) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });

  const { error } = await admin.from("hr_holidays").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
