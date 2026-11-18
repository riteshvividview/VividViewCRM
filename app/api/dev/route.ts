import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/app/api/tasks/_lib/helpers";
import { notifyUsers } from "@/app/api/tasks/_lib/notify";
import { allFeatures, featureAudience, forgetDev } from "@/lib/dev/server";
import { developer, hidden } from "./_lib";
import { announceGame } from "@/lib/game/announce";
import { readGameNotify, writeGameNotify, type GameNotify } from "@/lib/game/prefs";
import { broadcast, userChannel } from "@/app/api/tasks/_lib/notify";

const MODES = ["all", "only", "except"] as const;

/**
 * After any switch changes, every open app in the workspace re-reads what it may show, so a feature
 * appears or disappears within a second, no reload needed. The ping is neutral ("refresh") and carries nothing.
 */
async function refreshEveryone(admin: ReturnType<typeof adminClient>, workspaceId: string) {
  const { data } = await admin.from("profiles").select("user_id").eq("workspace_id", workspaceId).eq("disabled", false);
  await broadcast((data ?? []).map((p) => ({ topic: userChannel(p.user_id as string), event: "refresh" })));
}

/** GET: everything the console shows (owner, people, features, reports). ?db=1 adds database numbers. */
export async function GET(request: NextRequest) {
  const dev = await developer();
  if (!dev) return hidden();
  const admin = adminClient();
  const [people, features, reports] = await Promise.all([
    admin.from("profiles").select("user_id, full_name, role, disabled").eq("workspace_id", dev.workspaceId).order("full_name"),
    allFeatures(admin),
    admin.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(300),
  ]);
  const { data: au } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((au?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const notifyOf = new Map((au?.users ?? []).map((u) => { const g = (u.app_metadata?.game_notify ?? {}) as Partial<GameNotify>; return [u.id, { off: !!g.off && !g.locked, locked: !!g.locked }]; }));
  let db = null;
  if (request.nextUrl.searchParams.get("db") === "1") {
    const { data, error } = await admin.rpc("dev_task_db_stats");
    db = error ? { error: error.message } : data;
  }
  return NextResponse.json({
    me: dev.userId,
    people: (people.data ?? []).map((p) => ({ id: p.user_id, name: p.full_name || emailOf.get(p.user_id) || "Unknown", email: emailOf.get(p.user_id) ?? "", role: p.role, disabled: !!p.disabled, game_notify: notifyOf.get(p.user_id) ?? { off: false, locked: false } })),
    features,
    reports: reports.data ?? [],
    db,
  });
}

/** POST { action, ... }: feature, resolve, reopen, delete_report, transfer. */
export async function POST(request: NextRequest) {
  const dev = await developer();
  if (!dev) return hidden();
  const admin = adminClient();
  const b = await request.json().catch(() => ({}));
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });

  switch (b.action) {
    case "feature": {
      if (typeof b.key !== "string") return bad("Missing feature");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
      if (b.mode !== undefined) {
        if (!MODES.includes(b.mode)) return bad("Invalid mode");
        patch.mode = b.mode;
      }
      if (b.user_ids !== undefined) {
        if (!Array.isArray(b.user_ids) || b.user_ids.some((x: unknown) => typeof x !== "string")) return bad("Invalid people");
        patch.user_ids = [...new Set(b.user_ids as string[])];
      }
      const before = (await allFeatures(admin)).find((f) => f.key === b.key);
      const { error } = await admin.from("dev_features").update(patch).eq("key", b.key);
      forgetDev();
      if (error) return bad(error.message);
      // Switching the game on: everyone it's for gets the welcome popup right away.
      if (b.key === "draw_guess" && b.enabled === true && !before?.enabled) await announceGame(admin, dev.workspaceId, { kind: "launch" });
      await refreshEveryone(admin, dev.workspaceId);
      return NextResponse.json({ ok: true });
    }
    case "resolve": {
      const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : "";
      const { data: r, error } = await admin.from("bug_reports")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: dev.userId, resolution_note: note || null })
        .eq("id", b.id).eq("status", "open").select("user_id, workspace_id, page_title, page_path").maybeSingle();
      if (error) return bad(error.message);
      if (!r) return bad("Already resolved or not found");
      if (r.user_id && r.workspace_id) {
        await notifyUsers(admin, r.workspace_id, [r.user_id], {
          type: "report_resolved",
          title: "Your reported issue is resolved",
          body: `The problem you reported on ${r.page_title || r.page_path} has been fixed.${note ? ` ${note}` : ""}`,
        });
      }
      return NextResponse.json({ ok: true });
    }
    case "reopen": {
      const { error } = await admin.from("bug_reports").update({ status: "open", resolved_at: null, resolved_by: null }).eq("id", b.id);
      return error ? bad(error.message) : NextResponse.json({ ok: true });
    }
    case "delete_report": {
      const { error } = await admin.from("bug_reports").delete().eq("id", b.id);
      return error ? bad(error.message) : NextResponse.json({ ok: true });
    }
    case "game_sounds": {
      // One switch for every player's game sounds. Stored as the "game_sounds_off" setting row.
      if (typeof b.on !== "boolean") return bad("Missing setting");
      const { error } = await admin.from("dev_features").upsert({ key: "game_sounds_off", name: "Game sounds off", description: "Silences every game sound for everyone.", enabled: !b.on, mode: "all", user_ids: [], updated_at: new Date().toISOString() });
      forgetDev();
      if (error) return bad(error.message);
      await refreshEveryone(admin, dev.workspaceId);
      const ids = await featureAudience(admin, dev.workspaceId, "draw_guess");
      await broadcast(ids.map((id) => ({ topic: userChannel(id), event: "game", payload: { kind: "sound", on: b.on } })));
      return NextResponse.json({ ok: true });
    }
    case "game_notify": {
      // The developer turns someone's game popups back on, and can lock them on.
      if (typeof b.user_id !== "string") return bad("Choose a person");
      const { data: p } = await admin.from("profiles").select("workspace_id").eq("user_id", b.user_id).maybeSingle();
      if (!p || p.workspace_id !== dev.workspaceId) return bad("That person isn't in your workspace");
      const cur = await readGameNotify(admin, b.user_id);
      const next = { off: typeof b.off === "boolean" ? b.off : cur.off, locked: typeof b.locked === "boolean" ? b.locked : cur.locked };
      const err = await writeGameNotify(admin, b.user_id, next);
      if (err) return bad(err);
      // Their open app picks the change up straight away.
      await broadcast([{ topic: userChannel(b.user_id), event: "game", payload: { kind: "prefs" } }]);
      return NextResponse.json({ ok: true });
    }
    case "transfer": {
      if (typeof b.user_id !== "string" || b.user_id === dev.userId) return bad("Choose someone else");
      const { data: p } = await admin.from("profiles").select("workspace_id, disabled").eq("user_id", b.user_id).maybeSingle();
      if (!p || p.workspace_id !== dev.workspaceId || p.disabled) return bad("That person isn't an active member");
      const { error } = await admin.from("dev_console").update({ owner_id: b.user_id, updated_at: new Date().toISOString() }).eq("id", true);
      forgetDev();
      return error ? bad(error.message) : NextResponse.json({ ok: true });
    }
  }
  return bad("Unknown action");
}
