# HRMS — Excel Import, Payroll Integration & Attendance Notifications

Implements the **third and final group of Claude Prompt 7** (Face Recognition
+ Enterprise Attendance Polish) from the GEON biometric roadmap
(`attendance-system-chatgpt-convo`): features **#3 Excel Attendance Import**,
**#11 Monthly Attendance Processing**, **#12 Payroll Integration Readiness**,
and **#13 Attendance Notifications**.

Combined with doc 31 (Corrections/Approvals/Audit, 3/12) and doc 32
(Analytics/Dashboards/Export, 5/12), this group's 4 remaining sub-features
bring **Prompt 7 to 12/12 = 100%** of its buildable scope. Features #1 (Face
Recognition Attendance) and #2 (Attendance Selfie Verification) remain
permanently out of scope per prior user direction.

---

## 1. SQL Migration (run manually in Supabase SQL Editor)

### `hr_attendance_monthly_closures` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_attendance_monthly_closures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  summary         JSONB,
  processed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  reopened_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_monthly_closures_workspace ON public.hr_attendance_monthly_closures(workspace_id, year, month);

ALTER TABLE public.hr_attendance_monthly_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_attendance_monthly_closures_isolation" ON public.hr_attendance_monthly_closures
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Field meanings
- `status` — `open | closed`. `closed` locks the month: new attendance
  correction requests and approvals for any date in that month are rejected
  with `409 Conflict` until reopened.
- `summary` — a JSON snapshot of the workspace's monthly attendance totals at
  the moment the month was closed (see `buildSummary()` in
  `monthly-process/route.ts`): `employee_count`, `total_present`,
  `total_late`, `total_half_day`, `total_absent`, `total_on_leave`,
  `total_unpaid_leave`, `total_work_from_home`, `total_overtime_minutes`,
  `total_late_minutes`, `avg_attendance_percentage`. Preserved for audit even
  if later attendance edits would change the live numbers.
- `processed_by` / `processed_at` — who closed the month and when.
- `reopened_by` / `reopened_at` — who last reopened it and when (cleared back
  to `NULL` on the next close).

#### Indexes
- `idx_hr_attendance_monthly_closures_workspace` on `(workspace_id, year, month)`
- `UNIQUE(workspace_id, year, month)` — one closure record per
  workspace/month, used as the `upsert` conflict target.

#### RLS impact
New table, new workspace-isolation policy (same convention as
`hr_attendance_corrections` / `hr_office_locations`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_attendance_monthly_closures;
```

---

### `notifications` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  read         BOOLEAN     NOT NULL DEFAULT false,
  entity_type  TEXT,
  entity_id    UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid());
```

#### Field meanings
- `type` — one of the `NotificationType` values in
  `modules/notifications/types.ts`. This group adds
  `attendance_correction_request`, `attendance_correction_decision`, and
  `attendance_monthly_processed` to the existing union (additive — no enum
  migration needed since `type` is plain `TEXT`).
- `entity_type` / `entity_id` — polymorphic pointer back to the source record
  (e.g. `attendance_correction` / correction id, `attendance_monthly_processing`
  / closure id) for future "click to view" deep-linking.
- `read` — toggled by the notification bell UI (`markRead` / `markAllRead`).

#### RLS impact
New table. Unlike most HRMS tables this is **not** workspace-isolated by
`profiles.workspace_id` — it's isolated per-recipient via `user_id =
auth.uid()`, since a notification is private to the user it was sent to (the
inserting `workspace_id` column is kept for query convenience/cleanup, not
for RLS). Inserts always go through the service-role `adminClient()`
(`notifyUsers` / `notifyHR`), so the `auth.uid()` policy only governs what a
logged-in user can read/update for themselves.

#### Rollback
```sql
DROP TABLE IF EXISTS public.notifications;
```

---

### `hr_attendance.source` — no migration needed
`source TEXT NOT NULL DEFAULT 'web'` already exists with no `CHECK`
constraint (see doc 31, which added the `manual` value for HR-approved
corrections). This group adds another documented value, **`import`**, for
rows created via the Excel/CSV bulk importer. Documented value set is now:
`web | mobile | kiosk | biometric | manual | import`. No `ALTER` required.

---

## 2. Application Architecture

### `_lib/reports.ts` (extended — shared by reports, analytics, payroll-export, monthly-process)
`computeMonthlyReports()` now also resolves each approved leave's
`hr_leave_types.is_paid` flag. For each employee:
- `DayRecord.is_unpaid_leave: boolean` — true for `on_leave` days that fall
  within an approved leave application whose leave type has `is_paid =
  false`.
- `EmployeeMonthlyReport.unpaid_leave_days: number` — count of such days in
  the month.

This is purely additive — existing consumers (`/reports`, `/analytics`)
ignore the new field; it powers the payroll LOP (loss-of-pay) calculation
below.

### `_lib/helpers.ts` — `isMonthClosed(admin, workspaceId, dateStr)`
Looks up `hr_attendance_monthly_closures` for the `(year, month)` derived
from `dateStr` and returns `true` if `status === "closed"`. Used to gate
correction requests/approvals once a month is locked for payroll.

### `_lib/notifications.ts` (new module)
- `notifyUsers(admin, workspaceId, userIds, { type, title, body, entity_type?, entity_id? })`
  — de-dupes and filters `null`/`undefined` ids, then bulk-inserts rows into
  `notifications`. No-op if the resulting id list is empty.
- `notifyHR(admin, workspaceId, params)` — looks up all `profiles` with role
  `super_admin` or `hr` in the workspace and calls `notifyUsers` for them.

### `notifications` infrastructure (additive)
- `modules/notifications/types.ts` — `NotificationType` union extended with
  `attendance_correction_request | attendance_correction_decision |
  attendance_monthly_processed`.
- `components/layout/notification-bell.tsx` — `TYPE_CONFIG` extended:
  `attendance_correction_request` (amber `FileEdit`),
  `attendance_correction_decision` (emerald `CheckCheck`),
  `attendance_monthly_processed` (blue `CalendarCheck`).
- `modules/notifications/hooks/use-notifications.ts` — `markRead` and
  `markAllRead` now persist to the `notifications` table (`UPDATE ... SET
  read = true`) in addition to updating local state, so read-state survives a
  page reload.

### `corrections/route.ts` (extended)
- **Month-closed gate**: `POST` (new correction request) now calls
  `isMonthClosed()` for the request's `date` and returns `409` if the month
  is closed for payroll.
- **Notify HR**: after a correction request is created, `notifyHR()` sends an
  `attendance_correction_request` notification naming the requester and the
  field/date being corrected.

### `corrections/[id]/route.ts` (extended)
- **Month-closed gate**: the `approve` action now calls `isMonthClosed()` for
  `correction.date` and returns `409` if the month is closed (an employee can
  still be notified of a `reject`, which has no effect on attendance data).
- **Notify requester**: both `reject` and `approve` actions call
  `notifyUsers()` to send the requester an `attendance_correction_decision`
  notification (rejection includes the HR review note, if any).

### `monthly-process/route.ts` (new route — #11 Monthly Attendance Processing)
HR/super_admin only.

- **`GET ?year=&month=`** — returns `{ year, month, is_elapsed, closure,
  preview }` where `preview` is a live `buildSummary()` aggregate (same shape
  as the stored `summary` snapshot) computed via `computeMonthlyReports()`,
  and `closure` is the existing `hr_attendance_monthly_closures` row (or
  `null` if never processed). `is_elapsed = monthEnd < istToday()`.
- **`POST { year, month, action: "close" | "reopen" }`**:
  - `close` — rejects if already closed or if the month hasn't fully elapsed
    (`end >= today`). Runs `runAttendanceProcessing()` for the full month
    (final pass over any unprocessed days), computes the summary snapshot,
    `upsert`s the closure row (`onConflict: "workspace_id,year,month"`,
    clearing any prior `reopened_*`), writes an `attendance_monthly_processing`
    / `closed` audit log, and notifies HR (`attendance_monthly_processed`).
  - `reopen` — rejects if not currently closed. Sets `status = "open"`,
    records `reopened_by`/`reopened_at`, writes an
    `attendance_monthly_processing` / `reopened` audit log. Does **not**
    re-notify HR (a manual administrative action, not an automated event).

### `import/route.ts` (new route — #3 Excel Attendance Import)
HR/super_admin only.

- **`GET`** — returns a downloadable `.xlsx` template
  (`attendance_import_template.xlsx`) with headers `Employee Code | Date |
  Check In | Check Out | Status | Work Mode` and two example rows (a punch
  row and a leave-status row).
- **`POST`** (multipart `file`, `.xlsx`/`.xls`/`.csv`, max 2000 data rows):
  1. Parses the sheet via `XLSX.read`/`sheet_to_json`, normalizing header
     names (case/space/punctuation-insensitive).
  2. Per row, validates: employee code resolves to an **active** employee in
     the workspace; date is present, valid, and not in the future; Check
     In/Out (if given) match `HH:MM`; `Status` (if given) is one of the
     `hr_attendance.status` values; `Work Mode` (if given) is `office` or
     `work_from_home`; at least one of Check In/Out/Status is present.
  3. Rows for months already in `hr_attendance_monthly_closures` (`status =
     'closed'`), or for `(employee, date)` rows already locked by
     `is_regularized = true`, are **skipped** (not erroed) — payroll-locked
     and HR-approved data is never overwritten by an import.
  4. Valid rows are deduplicated by `(employee_id, date)` (last row in the
     file wins) and `upsert`ed into `hr_attendance` with `onConflict:
     "employee_id,date"`, `source: "import"`, `is_auto_generated: false`.
     Check-in/out times are converted from IST `HH:MM` + the row's date to
     UTC via `istDateTimeToISO`.
  5. For every employee with an imported punch, `runAttendanceProcessing()`
     re-runs over that employee's affected date range (chunked to the
     existing 31-day `MAX_PROCESS_DAYS` limit) so late/overtime/status are
     recalculated under current shift rules — identical to a manual
     "Run Processing" pass, but scoped to only the imported employee+dates.
  6. Writes an `attendance_import` audit log with the file name and
     imported/skipped/error counts.
  - Response: `{ summary: { total_rows, imported, skipped, errors },
    results: [{ row, employee_code, date, status: "imported"|"skipped"|"error", message? }] }`.

### `payroll-export/route.ts` (new route — #12 Payroll Integration Readiness)
HR/super_admin only. `GET ?year=&month=&department_id=` — runs
`computeMonthlyReports()` and, per employee, derives a payroll-ready
breakdown:

```
paid_leave_days = on_leave_days − unpaid_leave_days
lop_days        = absent_days + unpaid_leave_days + half_day_count × 0.5   (loss of pay)
payable_days    = working_days − lop_days
overtime_hours  = overtime_minutes / 60
```

Response: `{ year, month, closure_status, processed_at, rows: [{ employee,
working_days, present_days, paid_leave_days, unpaid_leave_days,
half_day_count, late_count, lop_days, payable_days, overtime_hours,
attendance_percentage }] }`. `closure_status` is read from
`hr_attendance_monthly_closures` (`"not_processed" | "open" | "closed"`) so
the UI can flag whether the figures are a live preview or a locked snapshot.
This endpoint is the integration point for any external payroll system —
each row maps directly to a payable-days / LOP / overtime input for salary
computation.

---

## 3. New UI

### Automation page (`app/dashboard/hrms/attendance/automation/page.tsx`)
Two new tabs added to the existing Run Processing / Exceptions / Audit Trail
tabs:

- **"Excel Import"** — download-template button, file picker
  (`.xlsx/.xls/.csv`), upload & import button. After import, shows summary
  cards (Total Rows / Imported / Skipped / Errors) and a table of every
  non-imported row with its reason (e.g. "Month is closed for processing",
  "Record is locked by an HR-approved correction", "Invalid status").
- **"Monthly Processing"** — month navigator (◀ Month Year ▶), an
  Open/Closed-for-Payroll badge, and a live preview grid (employees, present,
  late, half day, absent, on leave, unpaid leave days, WFH, avg attendance %,
  total overtime, total late time). Shows **"Close Month for Payroll"**
  (disabled until the month has fully elapsed) or **"Reopen Month"**
  depending on current status, each behind a confirmation dialog explaining
  the consequences (locks/unlocks corrections for that month).

The audit trail's entity-type filter and labels were extended with `Excel
Import` (`attendance_import`) and `Monthly Processing`
(`attendance_monthly_processing`), and action badges for `closed` (green) and
`reopened` (amber).

### Reports tab (`app/dashboard/hrms/attendance/page.tsx`)
The Summary / Late & Absence Detail segmented toggle gained a third option,
**"Payroll"** (#12 surfaced for HR), which:
- Shows a banner indicating whether the month is closed for payroll (green)
  or still a live preview (amber), with a link to the Automation page's
  Monthly Processing tab.
- Renders a per-employee table: Working Days, Present, Paid Leave, Unpaid
  Leave, Half Days, LOP Days, Payable Days, OT Hrs.
- **Export CSV** now has a payroll branch (`attendance-payroll-YYYY-MM.csv`)
  with the same columns plus employee name/code/department.

### Notification bell (`components/layout/notification-bell.tsx`)
Now renders three new notification kinds end-to-end: an employee sees
`attendance_correction_decision` when their correction is approved/rejected;
HR sees `attendance_correction_request` for new requests and
`attendance_monthly_processed` when a month is closed. Marking
read/all-read now persists across reloads.

---

## 4. Known limitations
- **In-app notifications only** — no email (Brevo) integration for any of the
  new notification types. Adding email delivery is a future enhancement and
  was explicitly scoped out to keep this group additive and low-risk.
- **No cron / scheduler** — "Close Month for Payroll" and "Run Processing"
  are both manual HR actions; there is no automatic end-of-month close.
- **Import cap** — 2000 data rows per file (`MAX_ROWS`), matching the
  existing `MAX_PROCESS_DAYS = 31` chunking used for reprocessing.
- **`payroll-export` is read-only** — it produces a breakdown for an external
  payroll system to consume (via CSV export); it does not push data to any
  specific payroll provider.

---

## 5. Completion percentage methodology

This group completes the final 4 of Prompt 7's 12 buildable sub-features
(#3, #11, #12, #13), bringing **Prompt 7 to 12/12 = 100%** (previously 8/12 ≈
66.7% after doc 32).

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (migration executed) |
| 3 | GEON Device Integration | 15% | 0% (blocked — pending device details) |
| 4 | Attendance Automation | 15% | 100% (migration executed) |
| 5 | GPS Attendance | 10% | 100% (migration executed) |
| 6 | Geo-Fencing | 10% | 100% (migration executed) |
| 7 | Face Recognition + Enterprise Polish (12 buildable / 14) | 20% | **100%** (12/12) — Corrections/Approvals/Audit (doc 31) + Analytics/Dashboards/Export (doc 32) + Excel Import/Payroll/Notifications (this doc) |

**Overall Attendance System completion ≈ 84%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0.10×1.00 + 0.10×1.00 + 0.20×1.00).

The only remaining gap is **Prompt 3 (GEON Device Integration, 15% weight)**,
on hold pending GEON device details, and the residual ~5% on Prompt 1.
