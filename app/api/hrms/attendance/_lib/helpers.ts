import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: string;
  employeeId: string | null;
  departmentId: string | null;
}

/** Resolves the calling user's workspace, role, and linked hr_employees record. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, workspace_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.workspace_id) return null;

  const { data: employee } = await admin
    .from("hr_employees")
    .select("id, department_id")
    .eq("user_id", user.id)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle();

  return {
    userId: user.id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? "employee",
    employeeId: employee?.id ?? null,
    departmentId: employee?.department_id ?? null,
  };
}

export function isHR(role: string): boolean {
  return role === "super_admin" || role === "hr";
}

// ── Audit log (shared, generic/polymorphic — see hr_audit_logs) ────────────────

export async function writeAuditLog(
  admin: SupabaseClient,
  workspaceId: string,
  params: {
    entity_type: string;
    entity_id?: string | null;
    action: string;
    description?: string | null;
    changes?: Record<string, unknown> | null;
    performed_by?: string | null;
  }
) {
  await admin.from("hr_audit_logs").insert({
    workspace_id: workspaceId,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    action: params.action,
    description: params.description ?? null,
    changes: params.changes ?? null,
    performed_by: params.performed_by ?? null,
  });
}

// ── Date / time helpers (Asia/Kolkata) ─────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function istMinutesNow(): number {
  return tsToISTMinutes(new Date().toISOString());
}

/** Minutes-of-day (IST) for an arbitrary ISO timestamp. */
export function tsToISTMinutes(ts: string): number {
  const parts = new Date(ts).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h, m] = parts.split(":").map(Number);
  return h * 60 + m;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Formats an ISO timestamp as "HH:MM" in IST (24-hour). */
export function isoToISTTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Combines a date (YYYY-MM-DD) and an IST "HH:MM" time into a UTC ISO timestamp. */
export function istDateTimeToISO(dateStr: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = dateStr.split("-").map(Number);
  let utcMinutes = h * 60 + m - 330; // IST = UTC+5:30
  let dayOffset = 0;
  if (utcMinutes < 0) { utcMinutes += 1440; dayOffset = -1; }
  else if (utcMinutes >= 1440) { utcMinutes -= 1440; dayOffset = 1; }
  return new Date(Date.UTC(y, mo - 1, d + dayOffset, Math.floor(utcMinutes / 60), utcMinutes % 60, 0)).toISOString();
}

/** 0 = Sunday ... 6 = Saturday, matching JS Date.getDay() */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ── Shift lookups ───────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  workspace_id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  is_night_shift: boolean;
  is_flexible: boolean;
  flexible_hours_per_day: number | null;
  working_days: number[];
  break_minutes: number;
  grace_period_minutes: number;
  half_day_threshold_minutes: number;
  full_day_threshold_minutes: number;
  overtime_threshold_minutes: number;
  is_default: boolean;
  status: string;
}

export async function getDefaultShift(admin: SupabaseClient, workspaceId: string): Promise<Shift | null> {
  const { data } = await admin
    .from("hr_shifts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .eq("status", "active")
    .maybeSingle();
  return (data as Shift) ?? null;
}

/** All active shifts in the workspace, used for auto shift detection. */
export async function getActiveShifts(admin: SupabaseClient, workspaceId: string): Promise<Shift[]> {
  const { data } = await admin
    .from("hr_shifts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  return (data as Shift[]) ?? [];
}

export async function getShiftById(admin: SupabaseClient, shiftId: string): Promise<Shift | null> {
  const { data } = await admin.from("hr_shifts").select("*").eq("id", shiftId).maybeSingle();
  return (data as Shift) ?? null;
}

/** Returns the shift from an explicit, effective-dated assignment, if any (no default fallback). */
export async function getAssignedShift(
  admin: SupabaseClient,
  workspaceId: string,
  employeeId: string,
  dateStr: string
): Promise<Shift | null> {
  const { data } = await admin
    .from("hr_shift_assignments")
    .select("shift_id, effective_from, effective_to, hr_shifts(*)")
    .eq("workspace_id", workspaceId)
    .eq("employee_id", employeeId)
    .lte("effective_from", dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shift = (data as any)?.hr_shifts;
  return (shift as Shift) ?? null;
}

/** Returns the shift effective for the employee on the given date, falling back to the workspace default shift. */
export async function getActiveShift(
  admin: SupabaseClient,
  workspaceId: string,
  employeeId: string,
  dateStr: string
): Promise<Shift | null> {
  const assigned = await getAssignedShift(admin, workspaceId, employeeId, dateStr);
  if (assigned) return assigned;
  return getDefaultShift(admin, workspaceId);
}

/** Picks the active shift whose start time is closest (on a 24h clock) to the given minute-of-day. */
export function pickShiftByTime(shifts: Shift[], minutes: number): Shift {
  let best = shifts[0];
  let bestDist = Infinity;
  for (const shift of shifts) {
    const start = timeToMinutes(shift.start_time);
    const diff = Math.abs(minutes - start);
    const dist = Math.min(diff, 1440 - diff);
    if (dist < bestDist) {
      bestDist = dist;
      best = shift;
    }
  }
  return best;
}

/**
 * Resolves the shift to use for a punch: an explicit shift assignment always wins
 * (Employee Shift Assignment). With no assignment, auto-detects the workspace shift
 * whose start time is closest to the punch time (Auto Shift Detection) instead of
 * always falling back to the single default shift.
 */
export async function resolveShiftForCheckIn(
  admin: SupabaseClient,
  workspaceId: string,
  employeeId: string,
  dateStr: string,
  checkInMinutes: number
): Promise<Shift | null> {
  const assigned = await getAssignedShift(admin, workspaceId, employeeId, dateStr);
  if (assigned) return assigned;

  const shifts = await getActiveShifts(admin, workspaceId);
  if (shifts.length === 0) return null;
  if (shifts.length === 1) return shifts[0];
  return pickShiftByTime(shifts, checkInMinutes);
}

// ── Holiday / leave lookups ────────────────────────────────────────────────────

export async function isHoliday(
  admin: SupabaseClient,
  workspaceId: string,
  dateStr: string,
  departmentId: string | null
): Promise<boolean> {
  const { data } = await admin
    .from("hr_holidays")
    .select("department_ids")
    .eq("workspace_id", workspaceId)
    .eq("date", dateStr);

  if (!data || data.length === 0) return false;
  return data.some((h) => {
    const deptIds = h.department_ids as string[] | null;
    return !deptIds || deptIds.length === 0 || (!!departmentId && deptIds.includes(departmentId));
  });
}

/** True if the month containing dateStr (YYYY-MM-DD) has been closed via monthly attendance processing. */
export async function isMonthClosed(
  admin: SupabaseClient,
  workspaceId: string,
  dateStr: string
): Promise<boolean> {
  const [year, month] = dateStr.split("-").map(Number);
  const { data } = await admin
    .from("hr_attendance_monthly_closures")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  return data?.status === "closed";
}

export async function isOnApprovedLeave(
  admin: SupabaseClient,
  workspaceId: string,
  employeeId: string,
  dateStr: string
): Promise<boolean> {
  const { data } = await admin
    .from("hr_leave_applications")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .lte("from_date", dateStr)
    .gte("to_date", dateStr)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ── Status computation ────────────────────────────────────────────────────────

/** Default status for a day with no punch yet. */
export function noPunchStatus(opts: {
  isHoliday: boolean;
  isWeekend: boolean;
  isOnLeave: boolean;
}): "holiday" | "weekend" | "on_leave" | "absent" {
  if (opts.isHoliday) return "holiday";
  if (opts.isWeekend) return "weekend";
  if (opts.isOnLeave) return "on_leave";
  return "absent";
}

export function computeCheckIn(shift: Shift, checkInMinutes: number): { late_minutes: number; status: "present" | "late" } {
  if (shift.is_flexible) return { late_minutes: 0, status: "present" };
  const shiftStart = timeToMinutes(shift.start_time);
  const lateMinutes = Math.max(0, checkInMinutes - (shiftStart + shift.grace_period_minutes));
  return { late_minutes: lateMinutes, status: lateMinutes > 0 ? "late" : "present" };
}

export function computeCheckOut(
  shift: Shift,
  workMinutes: number,
  checkOutMinutes: number,
  workMode: string,
  lateMinutes: number
): { status: string; overtime_minutes: number; early_leave_minutes: number } {
  const overtimeMinutes = Math.max(0, workMinutes - shift.overtime_threshold_minutes);

  let earlyLeaveMinutes = 0;
  if (!shift.is_flexible) {
    let shiftEnd = timeToMinutes(shift.end_time);
    let effectiveCheckOut = checkOutMinutes;
    if (shift.is_night_shift) {
      shiftEnd += 1440;
      if (effectiveCheckOut < timeToMinutes(shift.start_time)) effectiveCheckOut += 1440;
    }
    earlyLeaveMinutes = Math.max(0, shiftEnd - effectiveCheckOut);
  }

  let status: string;
  if (workMinutes < shift.half_day_threshold_minutes) status = "half_day";
  else if (workMode === "work_from_home") status = "work_from_home";
  else if (lateMinutes > 0) status = "late";
  else status = "present";

  return { status, overtime_minutes: overtimeMinutes, early_leave_minutes: earlyLeaveMinutes };
}
