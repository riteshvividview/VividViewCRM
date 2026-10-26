# Leave Management — "On Leave Today" & Attendance Sync Fix

## Issues reported
1. HR Dashboard "On Leave Today" stat showed `0` even though an employee had an
   approved leave covering today.
2. Attendance page "On Leave" summary (and the daily records table) showed `0` /
   no row for an employee on an approved leave day.
3. Employee's "My Leaves" page showed "No leave balance assigned yet. Contact HR."

## Root causes & fixes

### 1. HR Dashboard "On Leave Today" (fixed)
`app/dashboard/hrms/page.tsx` computed this stat from
`hr_employees.status === "on_notice"` — an employment-status field unrelated to
leave. Replaced with a query against `hr_leave_applications`
(`status = 'approved'`, `from_date <= today <= to_date`), counting distinct
`employee_id`. This is correct immediately, no migration needed.

### 2. Attendance "On Leave" count (fixed)
Nothing ever wrote `hr_attendance.status = 'on_leave'` when a leave was approved,
so the Attendance page (which reads `hr_attendance` for the selected date) never
showed leave days.

`app/dashboard/hrms/leaves/page.tsx` → `decide()` now keeps `hr_attendance` in
sync:
- **Approve**: upserts an `hr_attendance` row (`status = 'on_leave'`) for every
  date in `[from_date, to_date]` for that employee (`onConflict: employee_id,date`).
- **Cancel** (of a previously-approved leave): deletes the `on_leave`
  `hr_attendance` rows for that date range.

This applies to leaves approved/cancelled **from now on**. Leaves already
approved before this fix (e.g. the test 11–15 June leave) need the one-time
backfill below.

### 3. "No leave balance assigned yet" — not a bug
This is the existing **Leave Policy** tab on an employee's profile
(`components/hrms/employee-leave-policy-tab.tsx`, wired into
`app/dashboard/hrms/employees/[id]/page.tsx`). No code change needed — see "What
you need to do" below.

---

## One-time SQL migration (run manually in Supabase SQL Editor)

### Purpose
Backfill `hr_attendance` with `on_leave` rows for leave applications that were
already approved before the sync fix above existed (e.g. the test leave from
11–15 June).

### Affected tables
- `public.hr_attendance` (inserts/updates rows for each day of every currently
  `approved` leave application)

### Migration SQL
```sql
INSERT INTO public.hr_attendance (workspace_id, employee_id, date, status)
SELECT
  la.workspace_id,
  la.employee_id,
  gs::date AS date,
  'on_leave'
FROM public.hr_leave_applications la
CROSS JOIN LATERAL generate_series(la.from_date, la.to_date, interval '1 day') AS gs
WHERE la.status = 'approved'
ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave';
```

### Indexes / Foreign keys
None added — relies on the existing `UNIQUE(employee_id, date)` constraint on
`hr_attendance`.

### RLS impact
None — runs as `postgres` in the SQL editor, bypassing RLS as usual for admin
migrations.

### Rollback
```sql
-- Only removes rows this migration created/updated (auto on_leave rows with no
-- check-in/out). If you had manually recorded an on_leave day with no check-in
-- before running this, it would also be removed by this rollback.
DELETE FROM public.hr_attendance
WHERE status = 'on_leave' AND check_in IS NULL AND check_out IS NULL
AND (employee_id, date) IN (
  SELECT la.employee_id, gs::date
  FROM public.hr_leave_applications la
  CROSS JOIN LATERAL generate_series(la.from_date, la.to_date, interval '1 day') AS gs
  WHERE la.status = 'approved'
);
```

### After running
Refresh the HR Dashboard and Attendance page for 12 June — "On Leave Today" /
"On Leave" should show `1` and John Wick should appear in the attendance table
for each day of his 11–15 June leave with the "On Leave" badge.

---

## What you need to do (Issue 3 — assign leave balances)

No code change. To give Surya Ganesh (or any employee) a visible leave balance:

1. Go to **HRMS → Leave Management → Policies** (HR/super_admin only). If no
   policy exists yet, create one and add rules (annual quota per leave type —
   Casual Leave, Sick Leave, etc.).
2. Go to **HRMS → Employees → [the employee] → Leave Policy** tab.
3. Select that policy and click **Assign & Allocate**.

This deactivates any prior assignment, creates `hr_employee_leave_policy`, and
upserts `hr_leave_balances` for the employee for the current year from the
policy's rules — which then appears on their "My Leaves" page.

> If the **Leave Policy** tab itself errors (table not found), the Phase 2 SQL
> migrations (Blocks C–F: `hr_leave_policies`, `hr_leave_policy_rules`,
> `hr_employee_leave_policy`, `hr_leave_balance_history`) from
> `about-system/20-leave-management-implementation.md` haven't been run yet —
> run those first, then retry steps 1–3.

---

## Files modified
- `app/dashboard/hrms/page.tsx` — "On Leave Today" now derived from approved
  `hr_leave_applications` covering today.
- `app/dashboard/hrms/leaves/page.tsx` — `decide()` syncs `hr_attendance` to
  `on_leave` on approve, removes it on cancel; added `dateRange()` helper.
