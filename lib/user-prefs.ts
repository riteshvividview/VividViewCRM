/**
 * Personal preferences (Profile settings → Preferences). They are saved on the
 * user's account, so they follow the person to any device, and mirrored in the
 * browser so formatting helpers can read them without waiting.
 */
export interface UserPrefs {
  /** "dmy" = 31 Dec 2026, "mdy" = Dec 31, 2026 */
  dateFormat: "dmy" | "mdy";
  timeFormat: "12" | "24";
  weekStart: "monday" | "sunday";
  /** IANA zone, or "auto" for the device's own. */
  timeZone: string;
}

export const DEFAULT_USER_PREFS: UserPrefs = { dateFormat: "dmy", timeFormat: "24", weekStart: "monday", timeZone: "auto" };

const KEY = "vividview-user-prefs";
export const USER_PREFS_EVENT = "user-prefs:changed";
let cache: UserPrefs | null = null;

export function getUserPrefs(): UserPrefs {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_USER_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_USER_PREFS, ...JSON.parse(raw) } : DEFAULT_USER_PREFS;
  } catch {
    cache = DEFAULT_USER_PREFS;
  }
  return cache!;
}

/** Updates the browser copy (used after loading the account's saved values). */
export function cacheUserPrefs(prefs: Partial<UserPrefs>) {
  cache = { ...DEFAULT_USER_PREFS, ...prefs };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  window.dispatchEvent(new Event(USER_PREFS_EVENT));
}

/** Saves a value on the signed-in account's metadata (no extra database table needed). */
export async function saveAccountMeta(patch: Record<string, unknown>): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/client");
  const { error } = await createClient().auth.updateUser({ data: patch });
  return error?.message ?? null;
}

export async function saveUserPrefs(prefs: UserPrefs): Promise<string | null> {
  cacheUserPrefs(prefs);
  return saveAccountMeta({ prefs });
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** Locale that produces the chosen date order. */
export function dateLocale(): string {
  return getUserPrefs().dateFormat === "mdy" ? "en-US" : "en-GB";
}

/** `{ timeZone }` for timestamps, or nothing when following the device. */
export function tzOption(): { timeZone?: string } {
  const tz = getUserPrefs().timeZone;
  return tz && tz !== "auto" ? { timeZone: tz } : {};
}

/** A clock time such as 21:00 or 9:00 PM, in the chosen time zone. */
export function formatTime(d: Date): string {
  const twelve = getUserPrefs().timeFormat === "12";
  return d.toLocaleTimeString(twelve ? "en-US" : "en-GB", { hour: twelve ? "numeric" : "2-digit", minute: "2-digit", hour12: twelve, ...tzOption() });
}

/** A calendar day (date-only values such as deadlines: no time zone shift). */
export function formatDay(d: Date, opts: { year?: boolean; weekday?: "short" | "long"; month?: "short" | "long" } = {}): string {
  return d.toLocaleDateString(dateLocale(), { day: "numeric", month: opts.month ?? "short", ...(opts.year ? { year: "numeric" } : {}), ...(opts.weekday ? { weekday: opts.weekday } : {}) });
}

/** The day a moment falls on, in the chosen time zone (for chat and activity timestamps). */
export function formatMomentDay(d: Date): string {
  return d.toLocaleDateString(dateLocale(), { day: "numeric", month: "short", ...tzOption() });
}

/** 0 = Sunday, 1 = Monday. */
export function weekStartsOn(): 0 | 1 {
  return getUserPrefs().weekStart === "sunday" ? 0 : 1;
}

export const TIME_ZONES: { value: string; label: string }[] = [
  { value: "auto", label: "Automatic (this device)" },
  { value: "Asia/Kolkata", label: "(GMT+05:30) India Standard Time" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Gulf Standard Time" },
  { value: "Asia/Karachi", label: "(GMT+05:00) Pakistan" },
  { value: "Asia/Dhaka", label: "(GMT+06:00) Bangladesh" },
  { value: "Asia/Kathmandu", label: "(GMT+05:45) Nepal" },
  { value: "Asia/Colombo", label: "(GMT+05:30) Sri Lanka" },
  { value: "Asia/Bangkok", label: "(GMT+07:00) Bangkok, Jakarta" },
  { value: "Asia/Singapore", label: "(GMT+08:00) Singapore, Kuala Lumpur" },
  { value: "Asia/Hong_Kong", label: "(GMT+08:00) Hong Kong, Beijing" },
  { value: "Asia/Tokyo", label: "(GMT+09:00) Tokyo, Seoul" },
  { value: "Australia/Sydney", label: "(GMT+10:00) Sydney" },
  { value: "Pacific/Auckland", label: "(GMT+12:00) Auckland" },
  { value: "Asia/Riyadh", label: "(GMT+03:00) Riyadh, Kuwait" },
  { value: "Europe/Moscow", label: "(GMT+03:00) Moscow" },
  { value: "Africa/Johannesburg", label: "(GMT+02:00) Johannesburg" },
  { value: "Europe/Berlin", label: "(GMT+01:00) Berlin, Paris, Rome" },
  { value: "Europe/London", label: "(GMT+00:00) London, Dublin" },
  { value: "America/Sao_Paulo", label: "(GMT-03:00) Sao Paulo" },
  { value: "America/New_York", label: "(GMT-05:00) New York, Toronto" },
  { value: "America/Chicago", label: "(GMT-06:00) Chicago" },
  { value: "America/Denver", label: "(GMT-07:00) Denver" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Los Angeles" },
];
