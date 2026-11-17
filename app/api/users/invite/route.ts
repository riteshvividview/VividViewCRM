import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";
import { adminClient, forbidden, getCeo } from "../_lib/access";
import { isEmail, normEmail, passwordProblem } from "@/lib/auth/server";

const VALID_ROLES: UserRole[] = ["super_admin", "hr", "team_lead", "employee"];

async function nextEmployeeCode(db: ReturnType<typeof adminClient>, workspaceId: string): Promise<string> {
  const { data } = await db.from("hr_employees").select("employee_code").eq("workspace_id", workspaceId);
  let max = 0;
  for (const row of data ?? []) {
    const m = row.employee_code?.match(/^EMP-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}

/**
 * POST { full_name, email, role, team_ids?, password? } — the CEO adds someone.
 * Nothing is emailed. Without a password they activate the account themselves on the
 * sign-in page (emailed code, on their own device); with one, the CEO shares it and the
 * person must replace it at their first sign-in.
 */
export async function POST(request: NextRequest) {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const db = adminClient();
    const body = await request.json().catch(() => ({}));

    const full_name = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) : "";
    const email = normEmail(body.email);
    const role = body.role as UserRole;
    const password = typeof body.password === "string" && body.password !== "" ? body.password : null;
    const teamIds: string[] = Array.isArray(body.team_ids) ? body.team_ids.filter((t: unknown) => typeof t === "string") : [];

    if (!full_name) return NextResponse.json({ error: "Enter their full name" }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Choose a role" }, { status: 400 });
    if (password) {
      const weak = passwordProblem(password);
      if (weak) return NextResponse.json({ error: `Password: ${weak.toLowerCase()}` }, { status: 400 });
    }
    const { data: existing } = await db.rpc("get_user_id_by_email", { user_email: email });
    if (existing) return NextResponse.json({ error: "Someone with this email already has an account" }, { status: 409 });

    // Only teams of this workspace.
    const { data: teams } = teamIds.length
      ? await db.from("teams").select("id").eq("workspace_id", ceo.workspaceId).in("id", teamIds)
      : { data: [] as { id: string }[] };

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: { full_name },
      app_metadata: password ? { must_change_password: true } : { invite_pending: true },
    });
    if (createError || !created?.user) {
      return NextResponse.json({ error: createError?.message ?? "Could not create the account" }, { status: 400 });
    }
    const userId = created.user.id;
    const undo = async () => {
      await db.from("team_members").delete().eq("user_id", userId);
      await db.from("hr_employees").delete().eq("user_id", userId);
      await db.from("profiles").delete().eq("user_id", userId);
      await db.auth.admin.deleteUser(userId);
    };

    const { error: profileError } = await db.from("profiles").upsert(
      { user_id: userId, full_name, role, workspace_id: ceo.workspaceId }, { onConflict: "user_id" },
    );
    if (profileError) { await undo(); return NextResponse.json({ error: profileError.message }, { status: 400 }); }

    const { error: empError } = await db.from("hr_employees").insert({
      workspace_id: ceo.workspaceId, user_id: userId, employee_code: await nextEmployeeCode(db, ceo.workspaceId),
      designation: "", employment_type: "full_time", date_of_joining: new Date().toISOString().split("T")[0], status: "active",
    });
    if (empError) { await undo(); return NextResponse.json({ error: empError.message }, { status: 400 }); }

    if (teams?.length) {
      const rows = teams.map((t) => ({ team_id: t.id, user_id: userId, role: "member" }));
      const { error } = await db.from("team_members").insert(rows);
      if (error) await db.from("team_members").insert(rows.map((r) => ({ ...r, role: "rep" })));
    }

    return NextResponse.json({ success: true, id: userId, mode: password ? "password" : "activate" });
  } catch (err) {
    console.error("POST /api/users/invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
