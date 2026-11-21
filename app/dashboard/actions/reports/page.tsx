"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartColumn, faLock, faSpinner, faArrowsRotate, faCirclePause, faTriangleExclamation, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { cn } from "@/lib/utils";

interface Brand { id: string; name: string; color: string | null; open: number; overdue: number; on_hold: number; done: number }
interface Person { id: string; name: string; avatar_url: string | null; open: number; in_progress: number; overdue: number; on_hold: number; done: number; done_today: number; on_time_rate: number | null }
interface Ref { id: string; title: string; code: string | null; brand: { name: string; color: string | null } | null }
interface Report {
  days: number; today: string; teams: { id: string; name: string }[];
  kpis: { open: number; in_progress: number; overdue: number; on_hold: number; done_today: number; done_week: number; done_range: number; created_range: number; due_today: number; on_time_rate: number | null };
  trend: { day: string; created: number; completed: number }[];
  status: { status: string; count: number }[];
  brands: Brand[]; team: Person[];
  overdue: (Ref & { due_date: string; people: string[] })[];
  on_hold: (Ref & { hold_at: string; reason: string | null; held_by: string | null })[];
  done_today: (Ref & { people: string[] })[];
}

// Validated categorical slots 1-3 (blue, orange, aqua), each stepped for light and dark; used in this fixed order.
const VIZ_CSS = `
.viz { --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --grid:rgba(120,120,120,.18); --axis:#8a8a86; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .viz { --s1:#3987e5; --s2:#d95926; --s3:#199e70; } }
.dark .viz, :root[data-theme="dark"] .viz { --s1:#3987e5; --s2:#d95926; --s3:#199e70; }
`;
const STATUS_LABEL: Record<string, string> = { todo: "To do", in_progress: "In progress", waiting: "Waiting" };
const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", tone === "bad" && "text-red-600 dark:text-red-400", tone === "warn" && "text-amber-600 dark:text-amber-400", tone === "good" && "text-emerald-600 dark:text-emerald-400")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const tip = { contentStyle: { borderRadius: 10, border: "1px solid rgba(120,120,120,.25)", fontSize: 12, background: "var(--background, #fff)" }, cursor: { stroke: "var(--axis)", strokeWidth: 1 } };

/** Reports (CEO only): pending work, brands, how everyone is doing, on hold and today, on one page. */
export default function ReportsPage() {
  const isCeo = useShellProfile()?.role === "super_admin";
  const [days, setDays] = useState("30");
  const [team, setTeam] = useState("all");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/tasks/reports?days=${days}${team !== "all" ? `&team=${team}` : ""}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not load the reports"); return; }
      setData(json);
    } finally { setLoading(false); }
  }, [days, team]);
  useEffect(() => { if (isCeo) void load(); }, [isCeo, load]);

  if (!isCeo) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <FontAwesomeIcon icon={faLock} className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-medium">You don't have access to this page</p>
      </div>
    );
  }

  const k = data?.kpis;
  const maxDone = Math.max(1, ...(data?.team ?? []).map((p) => p.done));
  return (
    <div className="viz mx-auto flex max-w-7xl flex-col gap-4 pb-10">
      <style>{VIZ_CSS}</style>
      {/* Title and filters in one row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><FontAwesomeIcon icon={faChartColumn} className="h-4 w-4 text-primary" />Reports</h1>
          <p className="text-sm text-muted-foreground">Pending work, brands and how everyone is doing. Days are in India time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {(data?.teams ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={load} disabled={loading} aria-label="Refresh">
            <FontAwesomeIcon icon={faArrowsRotate} className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {!data ? (
        <div className="py-24 text-center text-muted-foreground"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Done today" value={k!.done_today} hint={`${k!.done_week} this week`} tone="good" />
            <Tile label="Open tasks" value={k!.open} hint={`${k!.in_progress} in progress · ${k!.due_today} due today`} />
            <Tile label="Overdue" value={k!.overdue} hint="Open and past the deadline" tone={k!.overdue ? "bad" : undefined} />
            <Tile label="On hold" value={k!.on_hold} hint="Waiting to be resumed" tone={k!.on_hold ? "warn" : undefined} />
            <Tile label={`Done, last ${data.days} days`} value={k!.done_range} hint={`${k!.created_range} created`} />
            <Tile label="On time" value={k!.on_time_rate === null ? "-" : `${k!.on_time_rate}%`} hint={`Of tasks done in ${data.days} days`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={`Created and completed, last ${data.days} days`} className="lg:col-span-2">
              <div className="h-64" role="img" aria-label="Tasks created and completed per day">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={short} tick={{ fontSize: 11, fill: "var(--axis)" }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--axis)" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tip} labelFormatter={(d) => short(String(d))} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
                    <Line type="monotone" dataKey="created" name="Created" stroke="var(--s1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--s2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Open work by stage">
              <div className="flex flex-col gap-3">
                {data.status.map((s) => {
                  const total = Math.max(1, data.status.reduce((a, b) => a + b.count, 0));
                  return (
                    <div key={s.status}>
                      <div className="flex justify-between text-sm"><span>{STATUS_LABEL[s.status] ?? s.status}</span><span className="font-semibold tabular-nums">{s.count}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(s.count / total) * 100}%`, background: "var(--s1)" }} /></div>
                    </div>
                  );
                })}
                <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3 text-red-500" />Overdue</span><span className="text-right font-semibold tabular-nums">{k!.overdue}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><FontAwesomeIcon icon={faCirclePause} className="h-3 w-3 text-amber-500" />On hold</span><span className="text-right font-semibold tabular-nums">{k!.on_hold}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Pending work by brand">
            {data.brands.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No brand has pending work.</p> : (
              <div style={{ height: Math.max(160, data.brands.length * 34 + 50) }} role="img" aria-label="Open, overdue and on-hold tasks per brand">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.brands} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={8}>
                    <CartesianGrid stroke="var(--grid)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--axis)" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "currentColor" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tip} cursor={{ fill: "rgba(120,120,120,.08)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
                    <Bar dataKey="open" name="Open" stackId="a" fill="var(--s1)" stroke="var(--card, #fff)" strokeWidth={2} />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="var(--s2)" stroke="var(--card, #fff)" strokeWidth={2} />
                    <Bar dataKey="on_hold" name="On hold" stackId="a" fill="var(--s3)" stroke="var(--card, #fff)" strokeWidth={2} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Overdue tasks are also counted in Open. Bars stack Open, then Overdue, then On hold.</p>
          </Card>

          <Card title="How everyone is doing">
            {data.team.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No assigned tasks yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="px-3 py-2 font-medium">Done in {data.days} days</th>
                      <th className="px-3 py-2 text-right font-medium">Today</th>
                      <th className="px-3 py-2 text-right font-medium">Open</th>
                      <th className="px-3 py-2 text-right font-medium">In progress</th>
                      <th className="px-3 py-2 text-right font-medium">Overdue</th>
                      <th className="px-3 py-2 text-right font-medium">On hold</th>
                      <th className="py-2 pl-3 text-right font-medium">On time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{p.name}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(p.done / maxDone) * 100}%`, background: "var(--s1)" }} /></div>
                            <span className="tabular-nums">{p.done}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.done_today || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.open}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.in_progress}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", p.overdue && "font-semibold text-red-600 dark:text-red-400")}>{p.overdue}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", p.on_hold && "text-amber-600 dark:text-amber-400")}>{p.on_hold}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{p.on_time_rate === null ? "-" : `${p.on_time_rate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Overdue">
              <TaskList empty="Nothing is overdue." items={data.overdue.map((t) => ({ ...t, sub: `Due ${short(t.due_date)}${t.people.length ? ` · ${t.people.join(", ")}` : ""}`, tone: "bad" as const }))} />
            </Card>
            <Card title="On hold">
              <TaskList empty="No tasks are on hold." items={data.on_hold.map((t) => ({ ...t, sub: `${t.held_by ?? "Someone"}: ${t.reason ?? ""}`, tone: "warn" as const }))} />
              {data.on_hold.length > 0 && <a href="/dashboard/actions/on-hold" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">See all and resume</a>}
            </Card>
            <Card title="Done today">
              <TaskList empty="Nothing completed yet today." items={data.done_today.map((t) => ({ ...t, sub: t.people.join(", "), tone: "good" as const }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TaskList({ items, empty }: { items: (Ref & { sub: string; tone: "bad" | "warn" | "good" })[]; empty: string }) {
  if (!items.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  const icon = { bad: faTriangleExclamation, warn: faCirclePause, good: faCircleCheck };
  const color = { bad: "text-red-500", warn: "text-amber-500", good: "text-emerald-500" };
  return (
    <ul className="flex flex-col gap-2">
      {items.map((t) => (
        <li key={t.id}>
          <a href={`/dashboard/actions/tasks?task=${t.id}`} className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-muted">
            <FontAwesomeIcon icon={icon[t.tone]} className={cn("mt-0.5 h-3 w-3 shrink-0", color[t.tone])} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.code ? `${t.code} ` : ""}{t.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.brand ? `${t.brand.name} · ` : ""}{t.sub}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
