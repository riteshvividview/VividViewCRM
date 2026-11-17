import { dateLocale, weekStartsOn } from "@/lib/user-prefs";

/** Local-date helpers for the planner (dates as YYYY-MM-DD; the week starts on the day chosen in Preferences). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() - weekStartsOn() + 7) % 7));
  return r;
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const a = start.toLocaleDateString(dateLocale(), { day: "numeric", month: sameMonth ? undefined : "short" });
  const b = end.toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

export function formatMinutes(min: number): string {
  if (!min) return "0m";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
