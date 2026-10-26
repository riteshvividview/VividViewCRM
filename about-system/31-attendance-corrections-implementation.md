# HRMS — Attendance Corrections, Approval Workflow & Audit Trail

Implements the **first group of Claude Prompt 7** (Face Recognition +
Enterprise Attendance Polish) from the GEON biometric roadmap
(`attendance-system-chatgpt-convo`): features **#4 Attendance Corrections**,
**#5 Attendance Approval Workflow**, and **#6 Attendance Audit Trail**.

Per explicit user direction, **features #1 (Face Recognition Attendance) and
#2 (Attendance Selfie Verification) are permanently out of scope** and will
not be implemented in any future group.

---

## 1. SQL Migration (run manually in Supabase SQL Editor)

### `hr_attendance_corrections` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_attendance_corrections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id     UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  attendance_id   UUID        REFERENCES public.hr_attendance(id) ON DELETE SET NULL,
  date            DATE        NOT NULL,
  field           TEXT        NOT NULL,
  old_value       TEXT,
  new_value       TEXT        NOT NULL,
  reason          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  requested_by    UUID        NOT NULL REFERENCES auth.users(id),
  reviewed_by     UUID        REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_corrections_workspace ON public.hr_attendance_corrections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_corrections_employee ON public.hr_attendance_corrections(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_corrections_status ON public.hr_attendance_corrections(workspace_id, status);

ALTER TABLE public.hr_attendance_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_attendance_corrections_isolation" ON public.hr_attendance_corrections
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Field meanings
- `field` — one of `check_in | check_out | status | work_mode` (the
  `hr_attendance` column being corrected).
- `old_value` / `new_value` — stored as `TEXT`. For `check_in`/`check_out`
  these are `"HH:MM"` (IST, 24-hour). For `status`/`work_mode` they are the
  raw enum string (e.g. `"present"`, `"work_from_home"`).
- `status` (on **this** table) — `pending | approved | rejected | cancelled`.
  Distinct from `hr_attendance.status`.
- `attendance_id` — the existing `hr_attendance` row for
  `(employee_id, date)`, or `NULL` if no row exists yet for that day.

#### Indexes
- `idx_hr_attendance_corrections_workspace` on `(workspace_id)`
- `idx_hr_attendance_corrections_employee` on `(employee_id, date)`
- `idx_hr_attendance_corrections_status` on `(workspace_id, status)`

#### RLS impact
New table, new workspace-isolation policy (same convention as
`hr_office_locations` / `hr_attendance_exceptions`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_attendance_corrections;
```

### No new columns on `hr_attendance`
`is_regularized BOOLEAN` and `regularization_reason TEXT` already exist (see
`about-system/18-hrms-db-setup.md`, Block 7) and were previously unused — the
approval flow below now populates them.

---

## 2. Application Architecture

### `_lib/helpers.ts` — new date/time helpers
- `isoToISTTime(ts)` — formats an ISO timestamp as `"HH:MM"` in IST.
- `istDateTimeToISO(dateStr, "HH:MM")` — combines a `YYYY-MM-DD` date with an
  IST `"HH:MM"` time into a UTC ISO timestamp, used when writing a corrected
  `check_in`/`check_out`.

### `_lib/automation.ts` — `is_regularized` guard (bug fix)
`runAttendanceProcessing()` previously overwrote `status` (and, for punched
days, `late_minutes`/`overtime_minutes`/`work_minutes`/etc.) on **every**
reprocessing run — which would have silently reverted an approved correction
the next time HR clicked "Run Processing". Two changes:

- **Punched-day branch** (`existing.check_in` truthy): now `continue`s
  immediately if `existing.is_regularized` is true — a regularized record is
  considered locked/finalized and skipped entirely by automated recompute.
- **No-punch-day branch**: the `status` overwrite and the `auto_marked_absent`
  exception are now also gated on `!existing.is_regularized`.
- `AttendanceRow` interface gained `is_regularized: boolean | null` (the
  column was already returned by `select("*")`, just not typed).

The approval flow (below) deliberately runs reprocessing **before** setting
`is_regularized = true`, so a check-in/check-out correction still gets its
status/late/overtime/work-minutes recomputed from the new punch time — only
afterwards is the row locked.

### New API routes

#### `GET / POST /api/hrms/attendance/corrections`
- **POST** — employee self-service request. Body:
  `{ date, field, requested_value, reason }`.
  - `date` must be `<=` today (IST); `field` ∈
    `check_in | check_out | status | work_mode`.
  - `requested_value` is validated per field: `HH:MM` (regex) for punch
    fields, a valid `hr_attendance.status` value for `status`,
    `office | work_from_home` for `work_mode`.
  - `reason` is required (non-empty).
  - Rejects a duplicate pending request for the same
    `(employee, date, field)`, and a no-op request where
    `requested_value === old_value`.
  - Snapshots `old_value` from the current `hr_attendance` row (if any) and
    its `attendance_id` for use on approval.
  - Writes `hr_audit_logs` (`entity_type: "attendance_correction"`,
    `action: "requested"`).
- **GET** — role-aware list. Query params: `status` (default `pending`; `all`
  for every status), `employee_id` (HR only).
  - HR / super_admin: all requests in the workspace.
  - team_lead: own + direct reports (via `hr_employees.reporting_manager_id`).
  - employee: own requests only.

#### `PATCH /api/hrms/attendance/corrections/[id]`
Body: `{ action: "approve" | "reject" | "cancel", review_note? }`.

- `cancel` — the original requester (while `status === "pending"`) or HR.
  Sets `status: "cancelled"`.
- `reject` — HR-only. Sets `status: "rejected"`, `reviewed_by`,
  `reviewed_at`, `review_note`.
- `approve` — HR-only:
  1. If `attendance_id` is set, updates that field on the existing
     `hr_attendance` row (punch fields converted via `istDateTimeToISO`).
  2. If no `hr_attendance` row exists yet for that day, inserts one
     (`status: "absent"`, `work_mode: "office"`, `source: "manual"`,
     `is_auto_generated: false` as defaults, then the corrected field
     overrides its default).
  3. For `check_in`/`check_out` corrections, calls
     `runAttendanceProcessing()` for that single employee + date —
     recomputes shift assignment, late/early-leave/overtime/work minutes and
     `status` from the new punch time.
  4. Sets `is_regularized: true`, `regularization_reason: <reason>` on the
     `hr_attendance` row, locking it from future automated recompute.
  5. Sets `status: "approved"`, `reviewed_by`, `reviewed_at`, `review_note` on
     the correction row.
  6. Writes `hr_audit_logs` (`entity_type: "attendance_correction"`,
     `action: "approved"`), including
     `{ field, old_value, new_value, attendance_id }` in `changes`.

`source` gains a new value `"manual"` (alongside the documented
`web | mobile | kiosk | biometric` — see `about-system/26-attendance-foundation-implementation.md`)
for `hr_attendance` rows created purely from an approved correction.

---

## 3. New UI

### My Attendance tab (`app/dashboard/hrms/attendance/page.tsx`)
New **"My Correction Requests"** card below the punch card:
- **Request Correction** button opens a dialog: date (≤ today), field
  (Check-in Time / Check-out Time / Status / Work Mode), a field-appropriate
  input (`<input type="time">` for punch fields, a status `Select` populated
  from `STATUS_CONFIG` for `status`, Office/Work From Home for `work_mode`),
  and a required reason.
- Lists the employee's own requests — date, field, old → new value, a status
  badge (`pending | approved | rejected | cancelled`), and a **Cancel** action
  while pending (shows the HR review note once decided).

### New "Corrections" tab (`app/dashboard/hrms/attendance/page.tsx`, visible to HR/super_admin and team_lead)
- Status filter (`pending | approved | rejected | cancelled | all`, default
  `pending`).
- Table: date, employee, field, old → new value, reason, status, actions.
- HR sees **Approve** / **Reject** buttons on pending rows (dialog with an
  optional review note). team_lead sees the same table read-only — they can
  monitor their direct reports' requests but cannot decide them (per the
  approved preview: "'Pending Corrections' tab for HR/Team Lead").

### New "Audit Trail" tab (`app/dashboard/hrms/attendance/automation/page.tsx`, HR-only)
- Reuses the existing generic `GET /api/hrms/attendance/biometric/audit-logs`
  route — it already filters `hr_audit_logs` by `workspace_id` and an optional
  `entity_type`, despite living under the `biometric/` path, so no new route
  was needed.
- Entity-type filter: All / Correction / Exception / Processing Run / Office
  Location / Biometric Device.
- Table: when (IST date/time), type, action (color-coded badge), description,
  performed by (avatar + name).

---

## 4. Known limitations
- `istDateTimeToISO` assumes the corrected punch time falls on the same IST
  calendar `date` as the attendance record. A night-shift check-out that
  legitimately rolls into the next calendar day is not handled — HR should
  use the `status`/`work_mode` fields for those edge cases instead of
  correcting `check_out` directly.
- `is_regularized` is a single flag on the whole `hr_attendance` row, not
  per-field. Once set, the row is locked from *automated reprocessing*
  entirely (by design — a regularized record is HR-finalized). A further
  correction can still be approved manually (the approval path writes
  directly and bypasses the lock); only the background "Run Processing" job
  respects it.

---

## 5. Completion percentage methodology

Prompt 7 (Face Recognition + Enterprise Attendance Polish) has 14 sub-features
and carries 20% weight. With features #1 and #2 permanently descoped per user
direction, the buildable scope is 12 features. This group completes 3 of them
(#4 Attendance Corrections, #5 Approval Workflow, #6 Audit Trail) = **25%** of
Prompt 7's buildable scope.

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (migration executed) |
| 3 | GEON Device Integration | 15% | 0% (blocked — pending device details) |
| 4 | Attendance Automation | 15% | 100% (migration executed) |
| 5 | GPS Attendance | 10% | 100% (migration executed) |
| 6 | Geo-Fencing | 10% | 100% (migration executed) |
| 7 | Face Recognition + Enterprise Polish (12 buildable / 14) | 20% | **25%** — Corrections, Approval Workflow, Audit Trail done |

**Overall Attendance System completion ≈ 69%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0.10×1.00 + 0.10×1.00 + 0.20×0.25).

### Remaining Prompt 7 groups (not yet started)
- **Analytics, Dashboards & Export** — #7 Attendance Analytics, #8 Team
  Attendance Dashboard, #9 HR Attendance Dashboard, #10 Attendance Export,
  #14 Attendance Compliance Reports.
- **Excel Import, Payroll & Notifications** — #3 Excel Attendance Import, #11
  Monthly Attendance Processing, #12 Payroll Integration Readiness, #13
  Attendance Notifications.
