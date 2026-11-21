import { NextResponse, type NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { workspacePeople } from "../_lib/serialize";

/*
 * Mentions: every chat message where the caller was @mentioned and hasn't ticked it off yet.
 * The CEO uses this as an inbox on the Tasks page; ticking one (or all) clears it from the list.
 */

/** GET: open mentions of me, newest first. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  const [{ data, error }, people] = await Promise.all([
    admin.from("task_mentions")
      .select("id, created_at, comment:task_comments!comment_id(body, author_id, created_at, deleted_at), task:tasks!task_id(id, title, number, status, hold_at, deleted_at, project:task_projects!project_id(name, color, key))")
      .eq("workspace_id", ctx.workspaceId).eq("mentioned_user_id", ctx.userId).is("cleared_at", null)
      .order("created_at", { ascending: false }).limit(300),
    workspacePeople(admin, ctx.workspaceId),
  ]);
  if (error) return NextResponse.json({ error: "Run RUN-ME-58-mentions-cleared.sql in Supabase first." }, { status: 400 });
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const items = (data ?? []).flatMap((m) => {
    const c = one(m.comment) as { body: string; author_id: string; created_at: string; deleted_at: string | null } | null;
    const t = one(m.task) as { id: string; title: string; number: number | null; status: string; hold_at: string | null; deleted_at: string | null; project: unknown } | null;
    if (!t || t.deleted_at || !c || c.deleted_at) return []; // task in the trash or message deleted
    const p = one(t.project as { name: string; color: string | null; key: string | null } | null);
    return [{
      id: m.id, at: c.created_at ?? m.created_at, text: c.body,
      by: people.get(c.author_id) ?? null,
      task: { id: t.id, title: t.title, code: p?.key && t.number ? `${p.key}-${t.number}` : null, status: t.status, on_hold: !!t.hold_at, brand: p ? { name: p.name, color: p.color } : null },
    }];
  });
  return NextResponse.json({ items });
}

/** POST { ids: string[] } or { all: true }: tick mentions off (they leave the list; nothing else is deleted). */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const admin = adminClient();
  let q = admin.from("task_mentions").update({ cleared_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId).eq("mentioned_user_id", ctx.userId).is("cleared_at", null);
  if (body.all !== true) {
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 500) : [];
    if (!ids.length) return NextResponse.json({ error: "Nothing to clear" }, { status: 400 });
    q = q.in("id", ids);
  }
  const { error } = await q;
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
