"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCode, faBug, faToggleOn, faDatabase, faArrowsRotate, faCheck, faRotateLeft, faTrashCan, faSpinner,
  faUserShield, faCircleExclamation, faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Person { id: string; name: string; email: string; role: string; disabled: boolean; game_notify?: { off: boolean; locked: boolean } }
interface Feature { key: string; name: string; description: string | null; enabled: boolean; mode: "all" | "only" | "except"; user_ids: string[] }
interface Report {
  id: string; user_id: string | null; page_path: string; page_title: string | null; message: string;
  status: "open" | "resolved"; created_at: string; resolved_at: string | null; resolution_note: string | null;
}
interface Db {
  error?: string; db_bytes: number; connections: number;
  tables: { name: string; rows: number; week: number | null; bytes: number }[];
  slow_queries: { query: string; calls: number; mean_ms: number; total_ms: number }[];
}
interface Data { me: string; people: Person[]; features: Feature[]; reports: Report[]; db: Db | null }

type Tab = "reports" | "features" | "database" | "console";
const DB_LIMIT = 500 * 1024 * 1024; // Supabase free plan database space
const CONN_LIMIT = 60; // max_connections on the current Supabase plan

const size = (b: number) => b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ROLE: Record<string, string> = { super_admin: "CEO", hr: "HR", team_lead: "Team lead", employee: "Employee" };

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/dev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
}

/** Developer console: problem reports, feature switches, Task Management database health. Owner only. */
export default function DevConsolePage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("reports");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (db = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/dev${db ? "?db=1" : ""}`);
      if (!r.ok) { setData(null); return; }
      const j = await r.json();
      setData((d) => ({ ...j, db: j.db ?? d?.db ?? null }));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "database") load(true); }, [tab, load]);
  // New reports while the console is open.
  useEffect(() => {
    const f = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [load]);

  const open = data?.reports.filter((r) => r.status === "open").length ?? 0;
  const tabs: { id: Tab; label: string; icon: typeof faBug; badge?: number }[] = [
    { id: "reports", label: "Reports", icon: faBug, badge: open },
    { id: "features", label: "Features", icon: faToggleOn },
    { id: "database", label: "Database", icon: faDatabase },
    { id: "console", label: "Console owner", icon: faUserShield },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><FontAwesomeIcon icon={faCode} className="h-4 w-4 text-primary" />Developer console</h1>
          <p className="text-sm text-muted-foreground">Only you can see this page.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => load(tab === "database")} disabled={loading}>
          <FontAwesomeIcon icon={faArrowsRotate} className={cn("mr-1.5 h-3 w-3", loading && "animate-spin")} />Refresh
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <FontAwesomeIcon icon={t.icon} className="h-3.5 w-3.5" />{t.label}
            {!!t.badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="py-20 text-center text-muted-foreground"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /></div>
      ) : tab === "reports" ? (
        <Reports data={data} reload={() => load()} />
      ) : tab === "features" ? (
        <Features data={data} reload={() => load()} />
      ) : tab === "database" ? (
        <Database db={data.db} />
      ) : (
        <Owner data={data} />
      )}
    </div>
  );
}

function Reports({ data, reload }: { data: Data; reload: () => void }) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [resolving, setResolving] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const who = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const list = data.reports.filter((r) => filter === "all" || r.status === filter);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try { await post(body); toast.success(ok); reload(); return true; }
    catch (e) { toast.error((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(["open", "resolved", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 capitalize" onClick={() => setFilter(f)}>
            {f} ({f === "all" ? data.reports.length : data.reports.filter((r) => r.status === f).length})
          </Button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No {filter === "all" ? "" : filter} reports.</p>
      ) : list.map((r) => {
        const p = r.user_id ? who.get(r.user_id) : undefined;
        return (
          <div key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p?.name ?? "Removed user"} <span className="font-normal text-muted-foreground">· {when(r.created_at)}</span></p>
                <Link href={r.page_path} className="inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline">
                  {r.page_title || r.page_path} <span className="text-muted-foreground">{r.page_path}</span>
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-2.5 w-2.5" />
                </Link>
              </div>
              <div className="flex gap-1.5">
                {r.status === "open" ? (
                  <Button size="sm" className="h-7" disabled={busy} onClick={() => { setResolving(r); setNote(""); }}>
                    <FontAwesomeIcon icon={faCheck} className="mr-1.5 h-3 w-3" />Resolve
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => act({ action: "reopen", id: r.id }, "Reopened")}>
                    <FontAwesomeIcon icon={faRotateLeft} className="mr-1.5 h-3 w-3" />Reopen
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-red-600 hover:text-red-600" disabled={busy} aria-label="Delete report"
                  onClick={() => act({ action: "delete_report", id: r.id }, "Report deleted")}>
                  <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
            {r.status === "resolved" && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                <FontAwesomeIcon icon={faCheck} className="mr-1 h-2.5 w-2.5" />Resolved {r.resolved_at ? when(r.resolved_at) : ""}{r.resolution_note ? `: ${r.resolution_note}` : ""}
              </p>
            )}
          </div>
        );
      })}

      <Dialog open={!!resolving} onOpenChange={(v) => !v && !busy && setResolving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>{resolving && (who.get(resolving.user_id ?? "")?.name ?? "They")} will get a notification that it's fixed.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Optional note for them" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)} disabled={busy}>Cancel</Button>
            <Button disabled={busy} onClick={async () => { if (resolving && (await act({ action: "resolve", id: resolving.id, note }, "Resolved, they've been notified"))) setResolving(null); }}>Resolve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Features({ data, reload }: { data: Data; reload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const active = data.people.filter((p) => !p.disabled);

  async function save(key: string, patch: Partial<Feature>) {
    try { await post({ action: "feature", key, ...patch }); toast.success("Saved"); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (!data.features.length) return <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No features yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Choose who sees each feature. Changes reach people the next time a page loads.</p>
      {data.features.filter((f) => f.key !== "game_sounds_off").map((f) => {
        const picked = new Set(f.user_ids);
        const reach = !f.enabled ? 0 : f.mode === "all" ? active.length : f.mode === "only" ? active.filter((p) => picked.has(p.id)).length : active.filter((p) => !picked.has(p.id)).length;
        return (
          <div key={f.key} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{f.name} <span className="ml-1 font-mono text-[11px] text-muted-foreground">{f.key}</span></p>
                {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">Visible to {reach} of {active.length} people</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{f.enabled ? "On" : "Off"}</span>
                <Switch checked={f.enabled} onCheckedChange={(v) => save(f.key, { enabled: v })} aria-label={`Turn ${f.name} ${f.enabled ? "off" : "on"}`} />
              </div>
            </div>
            {f.enabled && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select value={f.mode} onValueChange={(v) => save(f.key, { mode: v as Feature["mode"] })}>
                  <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="except">Everyone except...</SelectItem>
                    <SelectItem value="only">Only these people</SelectItem>
                  </SelectContent>
                </Select>
                {f.mode !== "all" && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(editing === f.key ? null : f.key)}>
                    {f.user_ids.length} {f.mode === "only" ? "allowed" : "hidden from"} · Choose people
                  </Button>
                )}
              </div>
            )}
            {f.key === "draw_guess" && <GameSounds off={!!data.features.find((x) => x.key === "game_sounds_off")?.enabled} reload={reload} />}
            {f.key === "draw_guess" && <GameNotifications people={active.filter((p) => featureOnFor(f, p.id))} reload={reload} />}
            {f.enabled && f.mode !== "all" && editing === f.key && (
              <div className="mt-3 grid gap-1 rounded-lg border p-2 sm:grid-cols-2">
                {active.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={picked.has(p.id)} onCheckedChange={(v) => {
                      const next = new Set(picked); if (v) next.add(p.id); else next.delete(p.id);
                      save(f.key, { user_ids: [...next] });
                    }} />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{ROLE[p.role] ?? p.role}{p.id === data.me ? " · you" : ""}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const featureOnFor = (f: Feature, id: string) => f.enabled && (f.mode === "all" || (f.mode === "only" ? f.user_ids.includes(id) : !f.user_ids.includes(id)));

/** One switch for every player's game sounds (chimes, jingle, in-game effects). */
function GameSounds({ off, reload }: { off: boolean; reload: () => void }) {
  async function set(on: boolean) {
    try { await post({ action: "game_sounds", on }); toast.success(on ? "Game sounds on for everyone" : "Game sounds off for everyone"); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <div>
        <p className="font-medium">Game sounds</p>
        <p className="text-xs text-muted-foreground">Chimes, the jingle and in-game sounds, for everyone. Popups still show when this is off.</p>
      </div>
      <Switch checked={!off} onCheckedChange={set} aria-label="Game sounds for everyone" />
    </div>
  );
}

/** Game popups per person: see who turned them off, turn them back on, lock them on. */
function GameNotifications({ people, reload }: { people: Person[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const off = people.filter((p) => p.game_notify?.off).length;
  async function set(id: string, patch: { off?: boolean; locked?: boolean }) {
    try { await post({ action: "game_notify", user_id: id, ...patch }); toast.success("Saved"); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="mt-3 rounded-lg border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
        <span className="font-medium">Game notifications</span>
        <span className="text-xs text-muted-foreground">{off ? `${off} turned off` : "On for everyone"} · {open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="divide-y border-t">
          {people.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nobody has the game yet.</p>}
          {people.map((p) => {
            const g = p.game_notify ?? { off: false, locked: false };
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className={cn("text-xs", g.off ? "text-amber-600" : "text-muted-foreground")}>{g.off ? "Off (by them)" : g.locked ? "On, locked" : "On"}</span>
                <Switch checked={!g.off} onCheckedChange={(v) => set(p.id, { off: !v })} aria-label={`Game notifications for ${p.name}`} />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={g.locked} onCheckedChange={(v) => set(p.id, { locked: !!v, ...(v ? { off: false } : {}) })} />Lock on
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Database({ db }: { db: Db | null }) {
  if (!db) return <div className="py-20 text-center text-muted-foreground"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /></div>;
  if (db.error) return <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><FontAwesomeIcon icon={faCircleExclamation} className="mr-2" />{db.error}</p>;
  const taskBytes = db.tables.reduce((s, t) => s + t.bytes, 0);
  const pct = Math.min(100, (db.db_bytes / DB_LIMIT) * 100);
  const tables = [...db.tables].sort((a, b) => b.bytes - a.bytes);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Whole database" value={size(db.db_bytes)} hint={`${pct.toFixed(1)}% of the 500 MB free plan`} />
        <Stat label="Task Management tables" value={size(taskBytes)} hint={`${db.tables.length} tables`} />
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Open connections</p>
          <p className="text-lg font-semibold">{db.connections} <span className="text-sm font-normal text-muted-foreground">of {CONN_LIMIT}</span></p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", db.connections / CONN_LIMIT >= 0.9 ? "bg-red-500" : db.connections / CONN_LIMIT >= 0.75 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${Math.min(100, (db.connections / CONN_LIMIT) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Right now · shared by everyone</p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Database space</p>
          <p className="text-sm">
            <b>{size(db.db_bytes)}</b> <span className="text-muted-foreground">used of</span> <b>{size(DB_LIMIT)}</b>
            <span className="text-muted-foreground"> · {size(Math.max(0, DB_LIMIT - db.db_bytes))} free</span>
          </p>
        </div>
        {/* Task Management tables, then the rest of the database, against the full 500 MB. */}
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct.toFixed(1)}% of ${size(DB_LIMIT)} used`}>
          <div className={cn("h-full", pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, (taskBytes / DB_LIMIT) * 100)}%`, minWidth: taskBytes ? 3 : 0 }} />
          <div className={cn("h-full", pct >= 95 ? "bg-red-300" : pct >= 80 ? "bg-amber-300" : "bg-primary/35")} style={{ width: `${Math.min(100, (Math.max(0, db.db_bytes - taskBytes) / DB_LIMIT) * 100)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>0</span><span>{pct.toFixed(1)}% used</span><span>{size(DB_LIMIT)}</span></div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Task Management {size(taskBytes)}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/35" />Everything else (other apps, system) {size(Math.max(0, db.db_bytes - taskBytes))}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Free {size(Math.max(0, DB_LIMIT - db.db_bytes))}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2 font-medium">Table</th><th className="px-3 py-2 text-right font-medium">Rows</th><th className="px-3 py-2 text-right font-medium">New this week</th><th className="px-3 py-2 text-right font-medium">Size</th></tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.name} className="border-t">
                <td className="px-3 py-1.5 font-mono text-xs">{t.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{t.rows.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{t.week == null ? "-" : t.week.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{size(t.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Task Management queries that take the most time</h2>
        {db.slow_queries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet. Queries show here once they have run at least 3 times.</p> : (
          <div className="flex flex-col gap-2">
            {db.slow_queries.map((q, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="mb-1 flex gap-4 text-xs text-muted-foreground">
                  <span><b className="text-foreground">{q.mean_ms} ms</b> average</span><span>{q.calls.toLocaleString()} calls</span><span>{(q.total_ms / 1000).toFixed(1)} s total</span>
                </div>
                <code className="block break-all text-[11px] text-muted-foreground">{q.query}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Owner({ data }: { data: Data }) {
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const others = data.people.filter((p) => !p.disabled && p.id !== data.me);
  const target = others.find((p) => p.id === to);

  async function move() {
    setBusy(true);
    try { await post({ action: "transfer", user_id: to }); window.location.href = "/dashboard/actions"; }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        The console belongs to one account. While you own it, your account can't be removed or switched off by anyone.
        To hand it over, choose the new owner. You'll lose access straight away.
      </p>
      <div className="flex flex-wrap gap-2">
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Choose the new owner" /></SelectTrigger>
          <SelectContent>
            {others.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.email})</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-9" disabled={!to} onClick={() => setConfirm(true)}>Move console</Button>
      </div>
      <Dialog open={confirm} onOpenChange={(v) => !busy && setConfirm(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move the developer console?</DialogTitle>
            <DialogDescription>{target?.name} will own it and you'll no longer see it. Only they can move it back.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>Cancel</Button>
            <Button onClick={move} disabled={busy}>Move to {target?.name}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
