import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/app/api/tasks/_lib/helpers";
import { hasFeature } from "@/lib/dev/server";
import { readGameNotify, writeGameNotify } from "@/lib/game/prefs";
import { caller } from "../../dev/_lib";

async function me() {
  const c = await caller();
  if (!c) return null;
  return (await hasFeature(adminClient(), c.userId, "draw_guess")) ? c : null;
}

/** GET: my game notification setting. */
export async function GET() {
  const c = await me();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await readGameNotify(adminClient(), c.userId));
}

/** PATCH { off }: turn my game popups off or on (refused while the developer has locked them on). */
export async function PATCH(request: NextRequest) {
  const c = await me();
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.off !== "boolean") return NextResponse.json({ error: "Missing setting" }, { status: 400 });
  const admin = adminClient();
  const cur = await readGameNotify(admin, c.userId);
  if (cur.locked && b.off) return NextResponse.json({ error: "Game notifications are kept on for you." }, { status: 403 });
  const err = await writeGameNotify(admin, c.userId, { ...cur, off: b.off });
  return err ? NextResponse.json({ error: err }, { status: 400 }) : NextResponse.json({ off: b.off, locked: cur.locked });
}
