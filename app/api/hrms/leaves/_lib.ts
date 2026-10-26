import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_STATUSES = ["pending", "pending_l1", "pending_l2"];

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const isWeekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Leave days a request actually consumes, honouring the leave type's
 * weekends_counted / holidays_counted settings. Half days count as 0.5.
 */
export async function countLeaveDays(
  admin: SupabaseClient,
  workspaceId: string,
  leaveType: { weekends_counted?: boolean | null; holidays_counted?: boolean | null },
  from: string,
  to: string,
  isHalfDay: boolean,
): Promise<{ days: number; dates: string[] }> {
  let dates = datesBetween(from, to);
  if (!leaveType.weekends_counted) dates = dates.filter((d) => !isWeekend(d));
  if (!leaveType.holidays_counted && dates.length) {
    const { data } = await admin.from("hr_holidays").select("date")
      .eq("workspace_id", workspaceId).gte("date", from).lte("date", to);
    const holidays = new Set((data ?? []).map((h) => String(h.date).slice(0, 10)));
    dates = dates.filter((d) => !holidays.has(d));
  }
  if (isHalfDay) return { days: dates.length ? 0.5 : 0, dates: dates.slice(0, 1) };
  return { days: dates.length, dates };
}

/** Adds the given deltas to an employee's balance row for the leave's year (no-op if none allocated). */
export async function adjustBalance(
  admin: SupabaseClient,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  delta: { pending?: number; used?: number },
) {
  const { data: bal } = await admin.from("hr_leave_balances").select("id, pending_days, used_days")
    .eq("employee_id", employeeId).eq("leave_type_id", leaveTypeId).eq("year", year).maybeSingle();
  if (!bal) return;
  await admin.from("hr_leave_balances").update({
    pending_days: Math.max(0, Number(bal.pending_days ?? 0) + (delta.pending ?? 0)),
    used_days: Math.max(0, Number(bal.used_days ?? 0) + (delta.used ?? 0)),
    updated_at: new Date().toISOString(),
  }).eq("id", bal.id);
}

/** Marks approved leave days in attendance so dashboards and payroll LOP see them. */
export async function markAttendanceOnLeave(admin: SupabaseClient, workspaceId: string, employeeId: string, dates: string[]) {
  if (!dates.length) return;
  await admin.from("hr_attendance").upsert(
    dates.map((date) => ({ workspace_id: workspaceId, employee_id: employeeId, date, status: "on_leave" })),
    { onConflict: "employee_id,date", ignoreDuplicates: false },
  );
}

export async function clearAttendanceOnLeave(admin: SupabaseClient, employeeId: string, from: string, to: string) {
  await admin.from("hr_attendance").delete()
    .eq("employee_id", employeeId).eq("status", "on_leave").gte("date", from).lte("date", to);
}
