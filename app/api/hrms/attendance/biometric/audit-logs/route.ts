import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const entityType = request.nextUrl.searchParams.get("entity_type");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);

  let query = admin
    .from("hr_audit_logs")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const logs = data ?? [];
  const userIds = [...new Set(logs.map((l) => l.performed_by).filter(Boolean))];

  let profilesById = new Map<string, { full_name: string; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
    profilesById = new Map((profiles ?? []).map((p) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
  }

  const audit_logs = logs.map((l) => ({ ...l, performed_by_profile: l.performed_by ? profilesById.get(l.performed_by) ?? null : null }));

  return NextResponse.json({ audit_logs });
}
