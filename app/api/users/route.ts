import { NextResponse } from "next/server";
import { adminClient, forbidden, getCeo } from "./_lib/access";

/** The people of the CEO's workspace (never other workspaces). */
export async function GET() {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const admin = adminClient();

    const { data: profiles, error } = await admin.from("profiles")
      .select("user_id, full_name, role, disabled, avatar_url, created_at").eq("workspace_id", ceo.workspaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const emails = new Map<string, { email: string; created_at: string; name?: string }>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) emails.set(u.id, { email: u.email ?? "", created_at: u.created_at, name: u.user_metadata?.full_name as string | undefined });
      if ((data?.users?.length ?? 0) < 1000) break;
    }

    const users = (profiles ?? []).map((p) => {
      const a = emails.get(p.user_id);
      return {
        id: p.user_id,
        email: a?.email ?? "",
        full_name: p.full_name || a?.name || "",
        role: p.role ?? "employee",
        disabled: p.disabled ?? false,
        avatar_url: p.avatar_url ?? null,
        created_at: a?.created_at ?? p.created_at,
      };
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
