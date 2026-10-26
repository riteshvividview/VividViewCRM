export const RECURRING_PATTERNS = ["daily", "workdays", "weekly", "biweekly", "monthly", "yearly"] as const;
export type RecurringPattern = (typeof RECURRING_PATTERNS)[number];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The next occurrence date (YYYY-MM-DD) after `from` for a repeat pattern. */
export function nextOccurrence(pattern: RecurringPattern, from: string): string {
  const d = new Date(`${from}T00:00:00Z`);
  switch (pattern) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "workdays":
      do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "biweekly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly": {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      // Clamp e.g. Jan 31 → Feb 28/29
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
      break;
    }
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return iso(d);
}

/** Shifts an optional date by the same gap as the anchor moved (keeps due date relative to planned date). */
export function shiftBy(date: string | null, anchorFrom: string, anchorTo: string): string | null {
  if (!date) return null;
  const delta = new Date(`${anchorTo}T00:00:00Z`).getTime() - new Date(`${anchorFrom}T00:00:00Z`).getTime();
  return iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + delta));
}
