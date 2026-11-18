import { NextResponse } from "next/server";
import { adminClient, forbidden, getCeo } from "./_lib/access";
import { devOwner } from "@/lib/dev/server";

/** The people of the CEO's workspace (never other workspaces). */
export async function GET() {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const admin = adminClient();

    const { data: profiles, error } = await admin.from("profiles")
      .select("user_id, full_name, role, disabled, avatar_url, created_at").eq("workspace_id", ceo.workspaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const emails = new Map<string, { email: string; created_at: string; name?: string; last_sign_in_at: string | null; pending: boolean; must_change: boolean; two_factor: boolean; google: boolean }>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) emails.set(u.id, {
        email: u.email ?? "", created_at: u.created_at, name: u.user_metadata?.full_name as string | undefined,
        last_sign_in_at: u.last_sign_in_at ?? null, pending: !!u.app_metadata?.invite_pending, must_change: !!u.app_metadata?.must_change_password,
        two_factor: !!u.factors?.some((f) => f.status === "verified"), google: !!u.identities?.some((i) => i.provider === "google"),
      });
      if ((data?.users?.length ?? 0) < 1000) break;
    }

    const owner = await devOwner(admin);
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
        last_sign_in_at: a?.last_sign_in_at ?? null,
        // "invited": waiting for the setup link; "temp_password": must replace the CEO-set password.
        setup: a?.pending ? "invited" : a?.must_change ? "temp_password" : "done",
        two_factor: a?.two_factor ?? false,
        google: a?.google ?? false,
        // Manages the developer console: can't be deactivated or removed until it's moved.
        console_owner: p.user_id === owner,
      };
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
