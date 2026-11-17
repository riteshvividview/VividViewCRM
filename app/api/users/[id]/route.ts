import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";
import { adminClient, forbidden, getCeo, notFound, setAccountActive, targetProfile } from "../_lib/access";

const VALID_ROLES: UserRole[] = ["super_admin", "hr", "team_lead", "employee"];

/** PATCH { role?, disabled? } — change someone's role or switch their access off / on. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const { id } = await params;
    const admin = adminClient();
    const target = await targetProfile(admin, ceo, id);
    if (!target) return notFound();
    const body = await request.json().catch(() => ({}));

    if (body.role === undefined && body.disabled === undefined) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    // The CEO could otherwise lock themselves out of User Management.
    if (id === ceo.userId) {
      return NextResponse.json({ error: "You cannot change your own role or deactivate your own account" }, { status: 400 });
    }

    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      const { error } = await admin.from("profiles").update({ role: body.role }).eq("user_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (body.disabled !== undefined) {
      const err = await setAccountActive(admin, id, !body.disabled);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/users/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — deactivate (switches the login off; the account and its work are kept). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ceo = await getCeo();
    if (!ceo) return forbidden();
    const { id } = await params;
    if (id === ceo.userId) return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    const admin = adminClient();
    if (!(await targetProfile(admin, ceo, id))) return notFound();
    const err = await setAccountActive(admin, id, false);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
