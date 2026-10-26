import { NextResponse } from "next/server";
import { adminClient, getAuthContext, isHR, istToday } from "../attendance/_lib/helpers";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Days from `today` until the next occurrence of month/day of `date` (0 = today). */
function daysUntilAnniversary(date: string, today: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [, m, d] = date.split("-").map(Number);
  const base = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, m - 1, d);
  if (next < base) next = Date.UTC(ty + 1, m - 1, d);
  return Math.round((next - base) / 86400000);
}

/**
 * Keka-style home feed for any workspace member: who's off today, birthdays,
 * work anniversaries, new joiners, holidays, announcements, my team and my leave.
 * HR additionally gets workspace-level counters.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  const today = istToday();
  const year = Number(today.slice(0, 4));
  const hr = isHR(ctx.role);
  const ws = ctx.workspaceId;

  const [employeesRes, leavesTodayRes, holidaysRes, announcementsRes, balancesRes, myLeavesRes] = await Promise.all([
    admin.from("hr_employees")
      .select("id, user_id, employee_code, designation, department_id, reporting_manager_id, date_of_joining, date_of_birth, status, hr_departments!department_id(name), profiles(full_name, avatar_url)")
      .eq("workspace_id", ws).in("status", ["active", "on_notice"]),
    admin.from("hr_leave_applications")
      .select("employee_id, from_date, to_date, is_half_day, hr_leave_types(name)")
      .eq("workspace_id", ws).eq("status", "approved").lte("from_date", today).gte("to_date", today),
    admin.from("hr_holidays").select("name, date, holiday_type").eq("workspace_id", ws).gte("date", today).order("date").limit(5),
    admin.from("hr_announcements").select("id, title, body, category, pinned, created_at, expires_on")
      .eq("workspace_id", ws).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    ctx.employeeId
      ? admin.from("hr_leave_balances").select("total_days, used_days, pending_days, carried_forward_days, hr_leave_types(id, name, code)")
          .eq("employee_id", ctx.employeeId).eq("year", year)
      : Promise.resolve({ data: [] }),
    ctx.employeeId
      ? admin.from("hr_leave_applications").select("id, from_date, to_date, days_count, status, hr_leave_types(name)")
          .eq("employee_id", ctx.employeeId).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  type Emp = {
    id: string; user_id: string | null; employee_code: string; designation: string | null; department_id: string | null;
    reporting_manager_id: string | null; date_of_joining: string | null; date_of_birth: string | null;
    hr_departments: unknown; profiles: unknown;
  };
  let employeeRows = employeesRes.data;
  if (employeesRes.error) {
    // Fallback for databases without the personal-fields migration (no date_of_birth yet).
    const retry = await admin.from("hr_employees")
      .select("id, user_id, employee_code, designation, department_id, reporting_manager_id, date_of_joining, status, hr_departments!department_id(name), profiles(full_name, avatar_url)")
      .eq("workspace_id", ws).in("status", ["active", "on_notice"]);
    employeeRows = (retry.data ?? []).map((e) => ({ ...e, date_of_birth: null }));
  }
  const employees = (employeeRows ?? []) as Emp[];
  const person = (e: Emp) => ({
    id: e.id,
    name: one(e.profiles as { full_name: string } | null)?.full_name ?? e.employee_code,
    avatar_url: one(e.profiles as { avatar_url: string | null } | null)?.avatar_url ?? null,
    designation: e.designation,
    department: one(e.hr_departments as { name: string } | null)?.name ?? null,
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  const me = ctx.employeeId ? byId.get(ctx.employeeId) ?? null : null;

  // My team = same manager (peers) + my direct reports + my manager
  const teamIds = new Set<string>();
  if (me) {
    for (const e of employees) {
      if (e.id === me.id) continue;
      if ((me.reporting_manager_id && e.reporting_manager_id === me.reporting_manager_id) || e.reporting_manager_id === me.id || e.id === me.reporting_manager_id) {
        teamIds.add(e.id);
      }
    }
  }

  const onLeaveToday = (leavesTodayRes.data ?? []).flatMap((l) => {
    const e = byId.get(l.employee_id);
    if (!e) return [];
    return [{ ...person(e), leave_type: one(l.hr_leave_types as unknown as { name: string } | null)?.name ?? "Leave", half_day: l.is_half_day, until: l.to_date, in_my_team: teamIds.has(e.id) }];
  }).sort((a, b) => Number(b.in_my_team) - Number(a.in_my_team));

  const upcoming = (field: "date_of_birth" | "date_of_joining", windowDays: number, minYears = 0) =>
    employees.flatMap((e) => {
      const d = e[field];
      if (!d) return [];
      const inDays = daysUntilAnniversary(d, today);
      const occursIn = d.slice(5) >= today.slice(5) ? year : year + 1;
      const years = occursIn - Number(d.slice(0, 4));
      if (inDays > windowDays || years < minYears) return [];
      return [{ ...person(e), date: d.slice(5), in_days: inDays, years }];
    }).sort((a, b) => a.in_days - b.in_days);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const newJoiners = employees
    .filter((e) => e.date_of_joining && e.date_of_joining >= thirtyDaysAgo && e.date_of_joining <= today)
    .sort((a, b) => String(b.date_of_joining).localeCompare(String(a.date_of_joining)))
    .map((e) => ({ ...person(e), joined: e.date_of_joining }));

  const announcements = (announcementsRes.data ?? []).filter((a) => !a.expires_on || a.expires_on >= today).slice(0, 3);

  // Pending approvals the viewer can act on
  let pendingApprovals = 0;
  const directReportIds = me ? employees.filter((e) => e.reporting_manager_id === me.id).map((e) => e.id) : [];
  if (hr || directReportIds.length) {
    let q = admin.from("hr_leave_applications").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws).in("status", ["pending", "pending_l1", "pending_l2"]);
    if (!hr) q = q.in("employee_id", directReportIds);
    pendingApprovals = (await q).count ?? 0;
  }

  let stats = null;
  if (hr) {
    const [present, tickets, expenses, exits] = await Promise.all([
      admin.from("hr_attendance").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("date", today).in("status", ["present", "late", "half_day", "work_from_home"]),
      admin.from("hr_tickets").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("status", ["open", "in_progress"]),
      admin.from("hr_expense_claims").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "pending"),
      admin.from("hr_exits").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "requested"),
    ]);
    stats = {
      headcount: employees.length,
      present_today: present.count ?? 0,
      on_leave_today: onLeaveToday.length,
      new_this_month: employees.filter((e) => e.date_of_joining && e.date_of_joining.slice(0, 7) === today.slice(0, 7)).length,
      open_tickets: tickets.count ?? 0,
      pending_expenses: expenses.count ?? 0,
      pending_exits: exits.count ?? 0,
    };
  }

  return NextResponse.json({
    today,
    is_hr: hr,
    me: me ? {
      ...person(me),
      employee_code: me.employee_code,
      manager: me.reporting_manager_id && byId.get(me.reporting_manager_id) ? person(byId.get(me.reporting_manager_id)!) : null,
    } : null,
    team: Array.from(teamIds).map((id) => ({ ...person(byId.get(id)!), on_leave: onLeaveToday.some((l) => l.id === id), is_manager: id === me?.reporting_manager_id })),
    on_leave_today: onLeaveToday,
    birthdays: upcoming("date_of_birth", 7),
    anniversaries: upcoming("date_of_joining", 7, 1),
    new_joiners: newJoiners,
    holidays: holidaysRes.data ?? [],
    announcements,
    leave_balances: (balancesRes.data ?? []).map((b) => {
      const lt = one(b.hr_leave_types as unknown as { id: string; name: string; code: string } | null);
      const total = Number(b.total_days ?? 0) + Number(b.carried_forward_days ?? 0);
      return { leave_type_id: lt?.id, name: lt?.name ?? "Leave", code: lt?.code ?? "", total, used: Number(b.used_days ?? 0), pending: Number(b.pending_days ?? 0), available: total - Number(b.used_days ?? 0) - Number(b.pending_days ?? 0) };
    }),
    my_leaves: myLeavesRes.data ?? [],
    pending_approvals: pendingApprovals,
    stats,
  });
}
