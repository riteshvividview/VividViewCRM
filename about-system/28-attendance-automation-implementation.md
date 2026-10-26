# HRMS — Attendance Automation (Rules, Auto-Calculation, Auto Shift Detection, Exceptions, Reprocessing)

Implements **Claude Prompt 4 (Attendance Automation)** from the GEON biometric
roadmap (`attendance-system-chatgpt-convo`), executed ahead of **Prompt 3
(GEON Integration)** at the user's request — Prompt 4 operates entirely on
shift configuration + punch/attendance data from **Prompt 1 (Attendance
Foundation)** and has no dependency on a biometric device. Prompt 3 remains
blocked at 0% pending GEON device details (see
`about-system/27-biometric-foundation-implementation.md` §3 and the
"GEON Integration — information needed" note delivered alongside this report).

All new/changed tables follow the existing convention: accessed via Supabase
client + RLS only (no Prisma/NestJS at runtime).

---

## 1. SQL Migration (run manually in Supabase SQL Editor, in order)

### Block A — `hr_attendance` new columns

#### Purpose
Marks rows created by the automation engine (vs. real punches) and records
when a row was last processed/reprocessed, so reprocessing can safely update
auto-generated rows (e.g. when a holiday/leave is added after the fact)
without touching real punch-derived rows.

#### Affected tables
- `public.hr_attendance` (existing table — new columns)

```sql
ALTER TABLE public.hr_attendance ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.hr_attendance ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
```

`is_auto_generated = true` for rows the engine created for a no-punch day
(absent / holiday / weekend / on_leave). Rows with a real `check_in` are
never auto-generated, but `processed_at` is still updated on them whenever
Attendance Reprocessing recomputes their late/overtime/early-leave/status.

#### Indexes
None needed — these columns are not queried independently of
`(workspace_id, employee_id, date)`, which is already covered by existing
indexes from Prompt 1.

#### Foreign keys
None (new columns on an existing table).

#### RLS impact
None — existing `hr_attendance` RLS policy already covers all columns.

#### Rollback
```sql
ALTER TABLE public.hr_attendance DROP COLUMN IF EXISTS is_auto_generated;
ALTER TABLE public.hr_attendance DROP COLUMN IF EXISTS processed_at;
```

---

### Block B — `hr_attendance_exceptions`

#### Purpose
Attendance Exception Handling: a queue of issues raised by the automation
engine for HR review — currently `missing_checkout` (a punched day with no
check-out) and `auto_marked_absent` (a day computed as `absent` with no
punch). HR resolves or ignores each exception with an optional note.

#### Affected tables
- `public.hr_attendance_exceptions` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_attendance_exceptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  attendance_id   UUID        NOT NULL REFERENCES public.hr_attendance(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  exception_type  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  description     TEXT,
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (attendance_id, exception_type)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_exceptions_workspace ON public.hr_attendance_exceptions(workspace_id, status, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_exceptions_employee  ON public.hr_attendance_exceptions(employee_id, date DESC);

ALTER TABLE public.hr_attendance_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_attendance_exceptions_isolation" ON public.hr_attendance_exceptions
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`exception_type` is currently `missing_checkout | auto_marked_absent` (open
to new types in future prompts without a schema change). `status` is `open |
resolved | ignored`. `UNIQUE (attendance_id, exception_type)` makes
reprocessing idempotent: re-running processing upserts with
`ignoreDuplicates: true`, so the same issue is never queued twice and a
resolved/ignored exception is never silently reopened.

#### Indexes
- `idx_hr_attendance_exceptions_workspace` on `(workspace_id, status, date DESC)`
- `idx_hr_attendance_exceptions_employee` on `(employee_id, date DESC)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `attendance_id -> hr_attendance(id)` ON DELETE CASCADE
- `employee_id -> hr_employees(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy (same convention as
`hr_biometric_devices` / `hr_audit_logs`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_attendance_exceptions;
```

---

## 2. Application Architecture

### Shift resolution chain (`app/api/hrms/attendance/_lib/helpers.ts`)

Extended to support Auto Shift Detection while keeping explicit assignments
authoritative:

- `getActiveShifts(admin, workspaceId)` — all `status = 'active'` shifts in
  the workspace.
- `getShiftById(admin, shiftId)` — single shift lookup.
- `getAssignedShift(admin, workspaceId, employeeId, dateStr)` — the shift
  from an explicit, effective-dated `hr_shift_assignments` row covering
  `dateStr`, if any (no fallback).
- `getActiveShift(admin, workspaceId, employeeId, dateStr)` — assigned shift,
  else the workspace default shift.
- `pickShiftByTime(shifts, minutes)` — picks the shift whose `start_time` is
  closest to `minutes` (minute-of-day), using circular 24h distance so a
  23:50 punch is recognised as close to a 00:00 shift start.
- `resolveShiftForCheckIn(admin, workspaceId, employeeId, dateStr,
  checkInMinutes)` — **Auto Shift Detection**: assigned shift wins; otherwise,
  if the workspace has multiple active shifts, picks the nearest-by-time one
  via `pickShiftByTime`; if only one active shift exists, uses it.
- `writeAuditLog(admin, workspaceId, params)` — moved here from the biometric
  sync service so both biometric and attendance-processing audit entries share
  one helper (`hr_audit_logs`, reused per the project's "reuse first" policy).

### Punch route (`app/api/hrms/attendance/punch/route.ts`)

- **Check-in** now calls `resolveShiftForCheckIn(...)` instead of
  `getActiveShift(...)`, so an employee with no explicit shift assignment is
  auto-assigned the workspace shift whose start time best matches their actual
  check-in time (Auto Shift Detection).
- **Check-out** reuses the shift recorded on the attendance row at check-in
  (`getShiftById(attendance.shift_id)`), falling back to `getActiveShift` only
  if the row has no `shift_id` — avoids inconsistent late/overtime thresholds
  if shift assignments change mid-day.

### Automation engine (`app/api/hrms/attendance/_lib/automation.ts`)

`runAttendanceProcessing(admin, workspaceId, fromDate, toDate, triggeredBy,
employeeId?)` is a single engine covering **Auto Attendance Calculation**,
**Auto Status Calculation**, and **Attendance Reprocessing** — both are the
same per-`(employee, date)` resolution, so they're implemented once. Capped at
`MAX_PROCESS_DAYS = 31` per run (no cron infrastructure exists in this
project; this is a manual, HR-triggered batch action). Dates `>= today` (IST)
are always skipped.

For every `(employee, date)` in range:

- **Punched day** (`hr_attendance.check_in` is set):
  - Resolves the shift via assignment → nearest-by-time among active shifts →
    workspace default (same precedence as live check-in).
  - Recomputes `late_minutes` / check-in `status` via `computeCheckIn`
    (**Late Coming Rules + Grace Period**).
  - If `check_out` is also set: recomputes `work_minutes` (minus breaks),
    `overtime_minutes`, `early_leave_minutes`, and final `status` via
    `computeCheckOut` (**Early Exit Rules, Overtime Rules, Half Day Rules,
    Auto Status Calculation**).
  - If `check_out` is missing: raises a `missing_checkout` exception
    (**Attendance Exception Handling**).
- **No-punch day**: computes `status` via `noPunchStatus` — `holiday` /
  `weekend` / `on_leave` / `absent`, based on `hr_holidays` (department-aware),
  `hr_shift_assignments`-derived working days, and approved
  `hr_leave_applications` (**Auto Status Calculation**). If no `hr_attendance`
  row exists yet, inserts one with `is_auto_generated = true`; if one exists
  and is itself auto-generated, updates it if the computed status changed
  (e.g. a holiday was added later). A computed `absent` raises an
  `auto_marked_absent` exception.

All updates/inserts are applied in batched Supabase calls; exceptions are
written via `.upsert(rows, { onConflict: "attendance_id,exception_type",
ignoreDuplicates: true })` for idempotency. A `ProcessingSummary` (dates
processed, employees processed, records created/updated, exceptions created,
skipped future dates) is returned and logged to `hr_audit_logs`
(`entity_type: "attendance_processing"`, `action: "process"`).

### New API routes

- `POST /api/hrms/attendance/process` — HR-only. Body: `{ from_date, to_date,
  employee_id? }`. Validates dates and the ≤31-day range, then calls
  `runAttendanceProcessing`. Returns `{ summary }`.
- `GET /api/hrms/attendance/exceptions` — HR-only. Filters: `status` (default
  `open`), `employee_id`, `exception_type`, `from_date`, `to_date`. Returns
  exceptions joined with employee profile (`hr_employees -> profiles`) and the
  related `hr_attendance` row.
- `PATCH /api/hrms/attendance/exceptions/[id]` — HR-only. Body: `{ status:
  "resolved" | "ignored", resolution_note? }`. Updates the exception
  (`resolved_by`, `resolved_at`) and writes a `hr_audit_logs` entry
  (`entity_type: "attendance_exception"`, `action: "exception_resolved"` /
  `"exception_ignored"`).

### New page

- `app/dashboard/hrms/attendance/automation/page.tsx` — new, HR-only:
  - **Run Processing** tab: date range (defaults to yesterday, capped to past
    dates) + optional employee filter, "Run Processing" button, and a result
    summary (dates/employees processed, records created/updated, exceptions
    flagged, skipped future dates).
  - **Exceptions** tab: filterable table (status, exception type) with
    Resolve / Ignore actions (optional note), backed by the exceptions API.
- `app/dashboard/hrms/attendance/page.tsx` — added an "Automation" header
  action (HR/super_admin) alongside "Manage Shifts" and "Biometric Devices".

---

## 3. Completion percentage methodology

Per `about-system/26-attendance-foundation-implementation.md` §3, Prompt 4
(Attendance Automation) carries **15% weight** of the overall Attendance
System and is now complete pending the SQL migration above.

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (pending migration) |
| 3 | GEON Device Integration | 15% | 0% (blocked — see GEON requirements note) |
| 4 | Attendance Automation | 15% | 100% (pending migration) |
| 5 | GPS Attendance | 10% | 0% |
| 6 | Geo-Fencing | 10% | 0% |
| 7 | Face Recognition + Enterprise Polish | 20% | 0% |

**Overall Attendance System completion ≈ 44%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0 + 0 + 0).
