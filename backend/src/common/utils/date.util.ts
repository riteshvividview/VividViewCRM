/**
 * Date utilities used across HRMS (attendance, payroll, leave).
 * All dates are stored as UTC in the database; timezone conversion
 * happens here based on the workspace timezone string.
 */

/**
 * Format a date as YYYY-MM-DD (ISO date, no time component).
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the number of working days in a month given a working-days bitmask.
 * Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
 */
export function workingDaysInMonth(
  year: number,
  month: number, // 1-12
  workingDaysMask: number,
): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const bit = dayOfWeekToBit(dayOfWeek);
    if (workingDaysMask & bit) count++;
  }
  return count;
}

export function isWorkingDay(date: Date, workingDaysMask: number): boolean {
  const bit = dayOfWeekToBit(date.getDay());
  return Boolean(workingDaysMask & bit);
}

function dayOfWeekToBit(jsDay: number): number {
  // JS: 0=Sun,1=Mon,...,6=Sat
  // Bitmask: Mon=1,Tue=2,Wed=4,Thu=8,Fri=16,Sat=32,Sun=64
  const map: Record<number, number> = {
    1: 1,   // Mon
    2: 2,   // Tue
    3: 4,   // Wed
    4: 8,   // Thu
    5: 16,  // Fri
    6: 32,  // Sat
    0: 64,  // Sun
  };
  return map[jsDay] ?? 0;
}

/**
 * Return the number of calendar days between two dates (inclusive of start, exclusive of end).
 */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Format duration in minutes to a human-readable string: "4h 32m"
 */
export function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Relative time string (e.g. "2 hours ago", "3 days ago") */
export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
