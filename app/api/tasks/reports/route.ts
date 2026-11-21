import { NextResponse, type NextRequest } from "next/server";
import { adminClient, getAuthContext } from "../_lib/helpers";
import { workspacePeople } from "../_lib/serialize";

/*
 * The CEO's reports: everything about the workspace's tasks in one answer.
 * Days are counted in India time (IST). "Open" = not done and not on hold.
 */
const IST = 330 * 60_000;
const dayKey = (d: Date | string) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);

interface Row {
  id: string; title: string; number: number | null; status: string; priority: string;
  due_date: string | null; completed_at: string | null; created_at: string; hold_at: string | null; hold_reason: string | null; hold_by: string | null;
  project_id: string | null; team_id: string | null; assignee_id: string | null;
  project: { id: string; name: string; color: string | null; key: string | null } | { id: string; name: string; color: string | null; key: string | null }[] | null;
  assignee_rows: { user_id: string }[] | null;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "super_admin") return NextResponse.json({ error: "Not found" }, { status: 403 });
  const days = Math.min(90, Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 30));
  const teamFilter = request.nextUrl.searchParams.get("team") || null;
  const admin = adminClient();

  let q = admin.from("tasks")
    .select("id, title, number, status, priority, due_date, completed_at, created_at, hold_at, hold_reason, hold_by, project_id, team_id, assignee_id, project:task_projects!project_id(id, name, color, key), assignee_rows:task_assignees(user_id)")
    .eq("workspace_id", ctx.workspaceId).is("deleted_at", null);
  if (teamFilter) q = q.eq("team_id", teamFilter);
  const [{ data, error }, people, { data: teams }] = await Promise.all([
    q.limit(20000),
    workspacePeople(admin, ctx.workspaceId),
    admin.from("teams").select("id, name, color").eq("workspace_id", ctx.workspaceId).order("name"),
  ]);
  if (error) return NextResponse.json({ error: "Run RUN-ME-57-task-on-hold.sql in Supabase first." }, { status: 400 });
  const rows = (data ?? []) as unknown as Row[];

  const now = new Date();
  const today = dayKey(now);
  const local = new Date(now.getTime() + IST);
  const weekStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
  const rangeStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (days - 1))).toISOString().slice(0, 10);
  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const who = (r: Row) => { const ids = new Set((r.assignee_rows ?? []).map((a) => a.user_id)); if (r.assignee_id) ids.add(r.assignee_id); return [...ids]; };

  const held = (r: Row) => !!r.hold_at;
  const done = (r: Row) => r.status === "done";
  const open = (r: Row) => !done(r) && !held(r);
  const overdue = (r: Row) => open(r) && !!r.due_date && r.due_date < today;
  const doneOn = (r: Row) => (r.completed_at ? dayKey(r.completed_at) : null);
  const inRange = (k: string | null) => !!k && k >= rangeStart && k <= today;
  const onTime = (r: Row) => !r.due_date || (!!r.completed_at && dayKey(r.completed_at) <= r.due_date);

  const kpis = {
    open: rows.filter(open).length,
    in_progress: rows.filter((r) => open(r) && r.status === "in_progress").length,
    overdue: rows.filter(overdue).length,
    on_hold: rows.filter(held).length,
    done_today: rows.filter((r) => done(r) && doneOn(r) === today).length,
    done_week: rows.filter((r) => done(r) && (doneOn(r) ?? "") >= weekStart).length,
    done_range: rows.filter((r) => done(r) && inRange(doneOn(r))).length,
    created_range: rows.filter((r) => inRange(dayKey(r.created_at))).length,
    due_today: rows.filter((r) => open(r) && r.due_date === today).length,
  };
  const doneInRange = rows.filter((r) => done(r) && inRange(doneOn(r)));
  const onTimeRate = doneInRange.length ? Math.round((doneInRange.filter(onTime).length / doneInRange.length) * 100) : null;

  // Created vs completed per day.
  const trend: { day: string; created: number; completed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - i)).toISOString().slice(0, 10);
    trend.push({ day: k, created: 0, completed: 0 });
  }
  const tIdx = new Map(trend.map((t, i) => [t.day, i]));
  for (const r of rows) {
    const c = tIdx.get(dayKey(r.created_at)); if (c !== undefined) trend[c].created++;
    const d = r.completed_at && done(r) ? tIdx.get(dayKey(r.completed_at)) : undefined; if (d !== undefined) trend[d].completed++;
  }

  // Open work by status.
  const status = ["todo", "in_progress", "waiting"].map((s) => ({ status: s, count: rows.filter((r) => open(r) && r.status === s).length }));

  // Per brand.
  const brands = new Map<string, { id: string; name: string; color: string | null; open: number; overdue: number; on_hold: number; done: number }>();
  for (const r of rows) {
    const p = one(r.project);
    const id = p?.id ?? "none";
    const b = brands.get(id) ?? { id, name: p?.name ?? "No brand", color: p?.color ?? "#94a3b8", open: 0, overdue: 0, on_hold: 0, done: 0 };
    if (open(r)) b.open++;
    if (overdue(r)) b.overdue++;
    if (held(r)) b.on_hold++;
    if (done(r) && inRange(doneOn(r))) b.done++;
    brands.set(id, b);
  }

  // Per person.
  const ppl = new Map<string, { id: string; name: string; avatar_url: string | null; open: number; in_progress: number; overdue: number; on_hold: number; done: number; done_today: number; on_time: number }>();
  for (const r of rows) {
    for (const u of who(r)) {
      const m = people.get(u);
      if (!m) continue;
      const p = ppl.get(u) ?? { id: u, name: m.full_name || "Someone", avatar_url: m.avatar_url, open: 0, in_progress: 0, overdue: 0, on_hold: 0, done: 0, done_today: 0, on_time: 0 };
      if (open(r)) p.open++;
      if (open(r) && r.status === "in_progress") p.in_progress++;
      if (overdue(r)) p.overdue++;
      if (held(r)) p.on_hold++;
      if (done(r) && inRange(doneOn(r))) { p.done++; if (onTime(r)) p.on_time++; }
      if (done(r) && doneOn(r) === today) p.done_today++;
      ppl.set(u, p);
    }
  }
  const team = [...ppl.values()].map((p) => ({ ...p, on_time_rate: p.done ? Math.round((p.on_time / p.done) * 100) : null }))
    .sort((a, b) => b.done - a.done || b.open - a.open || a.name.localeCompare(b.name));

  const code = (r: Row) => { const p = one(r.project); return p?.key && r.number ? `${p.key}-${r.number}` : null; };
  const brandOf = (r: Row) => { const p = one(r.project); return p ? { name: p.name, color: p.color } : null; };
  const people_of = (r: Row) => who(r).map((u) => people.get(u)?.full_name).filter(Boolean);
  const overdueList = rows.filter(overdue).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 15)
    .map((r) => ({ id: r.id, title: r.title, code: code(r), brand: brandOf(r), due_date: r.due_date, people: people_of(r) }));
  const holdList = rows.filter(held).sort((a, b) => (b.hold_at ?? "").localeCompare(a.hold_at ?? "")).slice(0, 15)
    .map((r) => ({ id: r.id, title: r.title, code: code(r), brand: brandOf(r), hold_at: r.hold_at, reason: r.hold_reason, held_by: r.hold_by ? people.get(r.hold_by)?.full_name ?? null : null }));
  const doneToday = rows.filter((r) => done(r) && doneOn(r) === today).slice(0, 15)
    .map((r) => ({ id: r.id, title: r.title, code: code(r), brand: brandOf(r), people: people_of(r) }));

  return NextResponse.json({
    days, today, team_filter: teamFilter, teams: teams ?? [],
    kpis: { ...kpis, on_time_rate: onTimeRate },
    trend, status,
    brands: [...brands.values()].filter((b) => b.open || b.overdue || b.on_hold || b.done).sort((a, b) => b.open + b.overdue - (a.open + a.overdue)),
    team, overdue: overdueList, on_hold: holdList, done_today: doneToday,
  });
}
