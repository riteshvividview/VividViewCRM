"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Cake, PartyPopper, Plane, CalendarDays, Megaphone, UserPlus, Users, LogIn, LogOut,
  ArrowRight, Loader2, Receipt, LifeBuoy, CalendarPlus, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbtack } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Person { id: string; name: string; avatar_url: string | null; designation: string | null; department: string | null }
interface HomeData {
  today: string;
  is_hr: boolean;
  me: (Person & { employee_code: string; manager: Person | null }) | null;
  team: (Person & { on_leave: boolean; is_manager: boolean })[];
  on_leave_today: (Person & { leave_type: string; half_day: boolean; until: string; in_my_team: boolean })[];
  birthdays: (Person & { date: string; in_days: number })[];
  anniversaries: (Person & { date: string; in_days: number; years: number })[];
  new_joiners: (Person & { joined: string })[];
  holidays: { name: string; date: string; holiday_type: string }[];
  announcements: { id: string; title: string; body: string; category: string; pinned: boolean; created_at: string }[];
  leave_balances: { leave_type_id: string; name: string; code: string; total: number; used: number; pending: number; available: number }[];
  my_leaves: { id: string; from_date: string; to_date: string; days_count: number; status: string; hr_leave_types: { name: string } | null }[];
  pending_approvals: number;
  stats: null | { headcount: number; present_today: number; on_leave_today: number; new_this_month: number; open_tickets: number; pending_expenses: number; pending_exits: number };
}
interface Punch { attendance: { check_in: string | null; check_out: string | null; status: string } | null }

// ── Small Notion-style building blocks ────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ p, size = 28 }: { p: { name: string; avatar_url: string | null }; size?: number }) {
  return p.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-medium shrink-0" style={{ width: size, height: size }}>
      {initials(p.name)}
    </span>
  );
}

function Section({ title, icon: Icon, action, children, className }: {
  title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <header className="flex items-center justify-between px-4 h-11 border-b">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{title}</h2>
        {action}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

function PersonRow({ p, meta, right }: { p: Person; meta?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{p.name}</p>
        <p className="text-xs text-muted-foreground truncate">{meta ?? [p.designation, p.department].filter(Boolean).join(" · ")}</p>
      </div>
      {right && <span className="text-xs text-muted-foreground shrink-0">{right}</span>}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-2 py-6 text-center text-sm text-muted-foreground">{children}</p>;

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtWeekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const whenLabel = (n: number) => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ── Clock-in card ─────────────────────────────────────────────────────────────
function ClockCard() {
  const [punch, setPunch] = useState<Punch | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/hrms/attendance/punch");
    setPunch(res.ok ? await res.json() : { attendance: null });
  }, []);

  useEffect(() => {
    load();
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: "check_in" | "check_out") {
    setBusy(true);
    const location = await new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => resolve(null), { timeout: 5000 },
      );
    });
    const res = await fetch("/api/hrms/attendance/punch", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, location }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    toast.success(action === "check_in" ? "Clocked in" : "Clocked out");
    load();
  }

  const a = punch?.attendance;
  return (
    <section className="rounded-lg border bg-card p-4 flex flex-col justify-between gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Time today</p>
        <p className="text-2xl font-semibold tabular-nums mt-1" suppressHydrationWarning>
          {now ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          In {fmtTime(a?.check_in ?? null)} · Out {fmtTime(a?.check_out ?? null)}
        </p>
      </div>
      {punch === null ? (
        <Button size="sm" variant="outline" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>
      ) : !a?.check_in ? (
        <Button size="sm" onClick={() => act("check_in")} disabled={busy}><LogIn className="h-4 w-4 mr-1.5" />Clock in</Button>
      ) : !a.check_out ? (
        <Button size="sm" variant="outline" onClick={() => act("check_out")} disabled={busy}><LogOut className="h-4 w-4 mr-1.5" />Clock out</Button>
      ) : (
        <Button size="sm" variant="outline" disabled>Done for today</Button>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HrmsHomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hrms/home").then(async (r) => {
      const json = await r.json();
      if (!r.ok) setError(json.error ?? "Failed to load");
      else setData(json);
    });
  }, []);

  if (error) return <p className="text-sm text-muted-foreground py-12 text-center">{error}</p>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const firstName = data.me?.name.split(" ")[0] ?? "there";
  const teamOff = data.on_leave_today.filter((p) => p.in_my_team);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{fmtWeekday(data.today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5" suppressHydrationWarning>{greeting()}, {firstName}</h1>
          {data.me && (
            <p className="text-sm text-muted-foreground mt-1">
              {[data.me.designation, data.me.department].filter(Boolean).join(" · ")}
              {data.me.manager && <> · Reports to {data.me.manager.name}</>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild><Link href="/dashboard/hrms/leaves/apply"><CalendarPlus className="h-4 w-4 mr-1.5" />Apply leave</Link></Button>
          <Button size="sm" variant="outline" asChild><Link href="/dashboard/hrms/expenses"><Receipt className="h-4 w-4 mr-1.5" />Claim expense</Link></Button>
          <Button size="sm" variant="outline" asChild><Link href="/dashboard/hrms/helpdesk"><LifeBuoy className="h-4 w-4 mr-1.5" />Raise ticket</Link></Button>
        </div>
      </div>

      {!data.me && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Your login isn&apos;t linked to an employee record yet, so attendance and leave are unavailable.
          {data.is_hr ? " Add yourself under Employees." : " Please ask HR to add you."}
        </div>
      )}

      {/* HR overview */}
      {data.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 rounded-lg border bg-card divide-x divide-y md:divide-y-0">
          {[
            ["Headcount", data.stats.headcount, "/dashboard/hrms/employees"],
            ["Present today", data.stats.present_today, "/dashboard/hrms/attendance"],
            ["On leave", data.stats.on_leave_today, "/dashboard/hrms/leaves"],
            ["Joined this month", data.stats.new_this_month, "/dashboard/hrms/employees"],
            ["Leave approvals", data.pending_approvals, "/dashboard/hrms/leaves"],
            ["Expense claims", data.stats.pending_expenses, "/dashboard/hrms/expenses"],
            ["Open tickets", data.stats.open_tickets, "/dashboard/hrms/helpdesk"],
          ].map(([label, value, href]) => (
            <Link key={label as string} href={href as string} className="p-4 hover:bg-muted/50 transition-colors">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
            </Link>
          ))}
        </div>
      )}

      {!data.stats && data.pending_approvals > 0 && (
        <Link href="/dashboard/hrms/leaves" className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm hover:bg-muted/50">
          <span className="flex items-center gap-2"><Inbox className="h-4 w-4 text-muted-foreground" />{data.pending_approvals} leave request(s) from your team need your approval</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          {data.me && (
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <ClockCard />
              <section className="rounded-lg border bg-card">
                <header className="flex items-center justify-between px-4 h-11 border-b">
                  <h2 className="text-sm font-medium">Leave balance</h2>
                  <Link href="/dashboard/hrms/leaves" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
                </header>
                {data.leave_balances.length === 0 ? (
                  <Empty>No leave allocated yet.</Empty>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x">
                    {data.leave_balances.slice(0, 3).map((b) => (
                      <div key={b.leave_type_id} className="p-4">
                        <p className="text-xs text-muted-foreground truncate">{b.name}</p>
                        <p className="text-xl font-semibold tabular-nums mt-1">{b.available}<span className="text-sm text-muted-foreground font-normal"> / {b.total}</span></p>
                        {b.pending > 0 && <p className="text-xs text-muted-foreground mt-0.5">{b.pending} pending</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          <Section title="Announcements" icon={Megaphone}
            action={<Link href="/dashboard/hrms/announcements" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>}>
            {data.announcements.length === 0 ? <Empty>No announcements.</Empty> : data.announcements.map((a) => (
              <article key={a.id} className="px-2 py-2.5 border-b last:border-0">
                <p className="text-sm font-medium">{a.pinned && <FontAwesomeIcon icon={faThumbtack} className="mr-1.5 h-3 w-3 text-muted-foreground" />}{a.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{a.category} · {fmtDay(a.created_at.slice(0, 10))}</p>
              </article>
            ))}
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title={`Off today · ${data.on_leave_today.length}`} icon={Plane}>
              {data.on_leave_today.length === 0 ? <Empty>Everyone&apos;s in today.</Empty> : data.on_leave_today.map((p) => (
                <PersonRow key={p.id} p={p}
                  meta={`${p.leave_type}${p.half_day ? " · half day" : ""}${p.until !== data.today ? ` · back after ${fmtDay(p.until)}` : ""}`}
                  right={p.in_my_team ? "Team" : undefined} />
              ))}
            </Section>

            <Section title="My team" icon={Users}>
              {data.team.length === 0 ? <Empty>No team members linked yet.</Empty> : data.team.map((p) => (
                <PersonRow key={p.id} p={p} right={p.on_leave ? "On leave" : p.is_manager ? "Manager" : undefined} />
              ))}
              {teamOff.length > 0 && <p className="px-2 pt-2 text-xs text-muted-foreground">{teamOff.length} of your team are off today</p>}
            </Section>
          </div>

          {data.my_leaves.length > 0 && (
            <Section title="My recent leave" icon={CalendarDays}>
              {data.my_leaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-2 py-2 text-sm border-b last:border-0">
                  <span>{l.hr_leave_types?.name ?? "Leave"} <span className="text-muted-foreground">· {fmtDay(l.from_date)}{l.to_date !== l.from_date && ` – ${fmtDay(l.to_date)}`} · {Number(l.days_count)}d</span></span>
                  <span className="text-xs text-muted-foreground capitalize">{l.status.replace(/_l\d/, "").replace("_", " ")}</span>
                </div>
              ))}
            </Section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Section title="Birthdays" icon={Cake}>
            {data.birthdays.length === 0 ? <Empty>No birthdays this week.</Empty> : data.birthdays.map((p) => (
              <PersonRow key={p.id} p={p} right={whenLabel(p.in_days)} />
            ))}
          </Section>

          <Section title="Work anniversaries" icon={PartyPopper}>
            {data.anniversaries.length === 0 ? <Empty>None this week.</Empty> : data.anniversaries.map((p) => (
              <PersonRow key={p.id} p={p} meta={`${p.years} year${p.years > 1 ? "s" : ""} at the company`} right={whenLabel(p.in_days)} />
            ))}
          </Section>

          <Section title="New joiners" icon={UserPlus}>
            {data.new_joiners.length === 0 ? <Empty>No one joined in the last 30 days.</Empty> : data.new_joiners.map((p) => (
              <PersonRow key={p.id} p={p} right={fmtDay(p.joined)} />
            ))}
          </Section>

          <Section title="Upcoming holidays" icon={CalendarDays}>
            {data.holidays.length === 0 ? <Empty>No upcoming holidays.</Empty> : data.holidays.map((h) => (
              <div key={h.date + h.name} className="flex items-center justify-between px-2 py-1.5 text-sm">
                <span>{h.name}</span>
                <span className="text-xs text-muted-foreground">{fmtWeekday(h.date)}</span>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
