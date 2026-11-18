import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/app/api/tasks/_lib/helpers";
import { hasFeature } from "@/lib/dev/server";
import { announceGame } from "@/lib/game/announce";
import { caller } from "../../dev/_lib";

// One "a game is starting" popup per workspace every 2 minutes (per server instance), so nobody gets spammed.
const last = new Map<string, number>();
const GAP_MS = 120_000;

/** POST { players: string[] }: the host tells everyone a game is starting. Nothing is stored. */
export async function POST(request: NextRequest) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  if (!(await hasFeature(admin, me.userId, "draw_guess"))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const players = Array.isArray(b.players) ? b.players.filter((p: unknown): p is string => typeof p === "string").slice(0, 30).map((p: string) => p.slice(0, 60)) : [];
  if (players.length < 2) return NextResponse.json({ ok: true, sent: 0 });
  const now = Date.now();
  if (now - (last.get(me.workspaceId) ?? 0) < GAP_MS) return NextResponse.json({ ok: true, sent: 0 });
  last.set(me.workspaceId, now);
  const sent = await announceGame(admin, me.workspaceId, { kind: "starting", by: me.name ?? "Someone", players }, me.userId);
  return NextResponse.json({ ok: true, sent });
}
