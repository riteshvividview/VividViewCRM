# HRMS — Attendance Analytics, Dashboards & Export

Implements the **second group of Claude Prompt 7** (Face Recognition +
Enterprise Attendance Polish) from the GEON biometric roadmap
(`attendance-system-chatgpt-convo`): features **#7 Attendance Analytics**,
**#8 Team Attendance Dashboard**, **#9 HR Attendance Dashboard**,
**#10 Attendance Export**, and **#14 Attendance Compliance Reports**.

Per explicit user direction (see `about-system/31-attendance-corrections-implementation.md`),
features #1 (Face Recognition Attendance) and #2 (Attendance Selfie
Verification) remain permanently out of scope.

---

## 1. SQL Migration

**None.** This group is purely read/aggregation/export on top of existing
`hr_attendance`, `hr_employees`, `hr_departments`, `hr_holidays`,
`hr_leave_applications`, `hr_shift_assignments` and the `is_regularized` /
`regularization_reason` columns added in doc 31. No new tables, columns, or
RLS policies.

---

## 2. Application Architecture

### `app/api/hrms/attendance/_lib/reports.ts` (new shared module)
Extracted the per-employee monthly attendance computation that previously
lived inline in `reports/route.ts` into `computeMonthlyReports(admin,
workspaceId, year, month, { departmentId?, employeeIds? })`. It resolves each
employee's shift assignment, holidays, approved leave, and `hr_attendance`
rows for the month and returns, per employee:

- `counts` — per-status day counts (`present | late | half_day | absent |
  on_leave | holiday | weekend | work_from_home`)
- `daily` — a map of `date -> { status, late_minutes, is_regularized }` for
  every day up to today (current month) or the full month (past months)
- `working_days`, `present_days`, `attendance_percentage`
- `total_work_minutes`, `total_overtime_minutes`, `total_late_minutes`

This is now the single source of truth for both `/reports` and the new
`/analytics` endpoint, avoiding ~80 lines of duplicated shift/holiday/leave
resolution logic.

#### Bug fix: future days no longer counted as absent
For the **current, in-progress month**, the day-iteration loop is now capped
at `lastDay = isCurrentMonth ? <today's day-of-month (IST)> : daysInMonth`.
Previously, days *after today* in the current month were resolved via
`noPunchStatus(...)` and counted as `absent`, inflating absence counts and
deflating `attendance_percentage` for everyone mid-month. `attendance_percentage`
now reflects only elapsed working days — analogous to the `is_regularized`
fix documented in doc 31.

### `app/api/hrms/attendance/reports/route.ts` (refactored, same response shape)
Now a thin wrapper: `GET` (HR/super_admin only) reads `year`, `month`,
`department_id`, `employee_id` query params and returns
`{ year, month, reports }` via `computeMonthlyReports()`. Each
`report.employee.department` now additionally includes `id` (additive,
existing consumers unaffected).

### `app/api/hrms/attendance/analytics/route.ts` (new route)
`GET` — role-aware monthly analytics, shared by the HR Dashboard, the
team_lead "Team Monthly Summary", and the Reports tab's compliance view.

- **HR / super_admin** → `scope: "workspace"`, optional `department_id`
  filter.
- **team_lead** → `scope: "team"`, automatically scoped to self + direct
  reports (`hr_employees.reporting_manager_id = ctx.employeeId`), mirroring
  the pattern in `corrections/route.ts`.
- All other roles → `403 Forbidden`.

Response shape:

```ts
{
  year: number;
  month: number;
  scope: "workspace" | "team";
  summary: {
    employee_count, avg_attendance_percentage,
    total_present, total_late, total_half_day, total_absent,
    total_on_leave, total_work_from_home,
    total_late_minutes, total_overtime_minutes
  };
  daily_trend: Array<{
    date: string;
    present, late, half_day, absent, on_leave, work_from_home, holiday, weekend
  }>;
  department_breakdown: Array<{   // [] for team scope
    department_id: string | null; department_name: string;
    employee_count: number; attendance_percentage: number;
  }>;
  top_latecomers: Array<{          // top 10 by total_late_minutes desc
    employee; late_count; total_late_minutes
  }>;
  reports: Array<{ employee; counts; working_days; present_days;
    attendance_percentage; total_work_minutes; total_overtime_minutes;
    total_late_minutes }>;          // per-employee summary, no `daily` map
  compliance_records: Array<{       // late/half_day/absent days, newest first, capped at 1000
    employee; date; status; late_minutes; is_regularized
  }>;
}
```

`daily_trend` sums per-status day counts across all in-scope employees for
each date. `department_breakdown` groups by employee department (`workspace`
scope only), with `attendance_percentage = Σpresent_days / Σworking_days ×
100` (1 decimal). `compliance_records` flattens every employee-day where
`status ∈ {late, half_day, absent}` for the compliance/export view.

---

## 3. New UI (`app/dashboard/hrms/attendance/page.tsx`)

### Shared widgets
- `KpiCard({ label, value, color })` — small stat tile, reused across the
  Dashboard tab and Team Monthly Summary.
- `AttendanceTrendChart({ data })` — stacked `recharts` `BarChart` of
  `daily_trend` (present/late/half_day/work_from_home/on_leave/absent per
  day of month), using the existing dashboard chart styling conventions
  (`stroke="hsl(var(--border))"`, muted-foreground tick fill, no axis lines).
- `DepartmentBreakdownChart({ data })` — horizontal `BarChart`
  (`layout="vertical"`) of `attendance_percentage` per department,
  `domain={[0, 100]}`.
- `downloadCSV(filename, headers, rows)` — client-side CSV export via
  `Blob` + `URL.createObjectURL` + anchor click. No new dependencies.

### New "Dashboard" tab (HR/super_admin only — #7 Analytics + #9 HR Dashboard)
- Month navigator + department filter (`<Select>` from `hr_departments`) +
  **Export CSV** (daily trend).
- 8 KPI cards: Avg Attendance %, Present, Late, Half Day, Absent, On Leave,
  Work From Home, Overtime (via `fmtMinutes`).
- `AttendanceTrendChart` for the selected month.
- Two-column row: `DepartmentBreakdownChart` (workspace-wide attendance % by
  department) + a "Top Latecomers" leaderboard (avatar, name, late-day count,
  total late time) from `top_latecomers`.

### "Team" tab — new "Team Monthly Summary" section (team_lead only — #8)
Appended below the existing daily team-records table, **visible only when
`isTeamLead`** (HR already has the full Dashboard tab, so no duplication):
- Month navigator + **Export CSV** (per-member monthly summary).
- 4 KPI cards: Avg Attendance %, Late Instances, Absences, WFH Days.
- `AttendanceTrendChart` for the team's `daily_trend`.
- Per-member table: avatar/name, Present, Late, Absent, attendance %
  progress bar — sourced from `/analytics` with `scope: "team"`.

### "Reports" tab — export + compliance view (#10 Export + #14 Compliance Reports)
- New **Summary / Late & Absence Detail** segmented toggle.
- **Summary** (existing per-employee monthly table) now has an
  **Export CSV** button (employee, code, department, per-status counts,
  overtime minutes, attendance %, present/working days).
- **Late & Absence Detail** (new) fetches `/analytics` and renders
  `compliance_records` as a flat table: date, employee, status badge (reusing
  `STATUS_CONFIG`), late-by duration, and a regularized check/cross icon —
  also exportable via **Export CSV** (date, employee, code, status, late
  minutes, regularized yes/no).

---

## 4. Known limitations
- `compliance_records` is capped at 1000 rows server-side
  (`MAX_COMPLIANCE_RECORDS`); for very large workspaces with a long
  current-month, the oldest in-range records beyond that cap are dropped from
  both the UI table and its CSV export. In practice this only matters for
  workspaces with hundreds of employees and very high late/absence rates.
- `department_breakdown` and `top_latecomers` are computed over the
  `workspace` scope only — for `team_lead` (`scope: "team"`) both are empty
  arrays / `[]`, since a team's department breakdown is usually a single
  department and a 10-row latecomer leaderboard isn't meaningful for small
  teams.

---

## 5. Completion percentage methodology

This group completes 5 more of Prompt 7's 12 buildable sub-features (#7, #8,
#9, #10, #14), bringing Prompt 7 to **8/12 ≈ 66.7%** (previously 3/12 = 25%
after doc 31).

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (migration executed) |
| 3 | GEON Device Integration | 15% | 0% (blocked — pending device details) |
| 4 | Attendance Automation | 15% | 100% (migration executed) |
| 5 | GPS Attendance | 10% | 100% (migration executed) |
| 6 | Geo-Fencing | 10% | 100% (migration executed) |
| 7 | Face Recognition + Enterprise Polish (12 buildable / 14) | 20% | **66.7%** (8/12) — Corrections/Approvals/Audit (doc 31) + Analytics/Dashboards/Export (this doc) done |

**Overall Attendance System completion ≈ 77.3%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0.10×1.00 + 0.10×1.00 + 0.20×(8/12)).

### Remaining Prompt 7 group (not yet started)
- **Excel Import, Payroll & Notifications** — #3 Excel Attendance Import, #11
  Monthly Attendance Processing, #12 Payroll Integration Readiness, #13
  Attendance Notifications. (4/12 remaining)
