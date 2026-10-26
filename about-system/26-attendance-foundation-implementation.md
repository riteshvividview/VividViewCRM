# HRMS — Attendance Foundation (Shifts, Punch In/Out, Breaks, Calendar, Holidays)

Implements **Claude Prompt 1 (Attendance Foundation)** from the GEON biometric
roadmap (`attendance-system-chatgpt-convo`). Establishes shift management,
employee shift assignment, punch in/out with break tracking, holiday calendar,
attendance calendar/history, team attendance, and attendance reports — the
foundation that biometric (Prompt 2/3), automation (Prompt 4), GPS (Prompt 5),
geofencing (Prompt 6) and face recognition (Prompt 7) will build on top of.

All new tables follow the existing convention: accessed via Supabase client +
RLS only (no Prisma/NestJS at runtime — `backend/` NestJS attendance module is
legacy and not used by the Next.js app).

---

## 1. SQL Migration (run manually in Supabase SQL Editor, in order)

### Block A — `hr_shifts`

#### Purpose
Stores shift definitions (General, Morning, Evening, Night, Flexible) with
working days, break allowance, grace period, half/full-day thresholds and
overtime threshold. These thresholds are the foundation for the automation
rules in Prompt 4 (late rules, half-day rules, overtime rules).

#### Affected tables
- `public.hr_shifts` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_shifts (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name                        TEXT        NOT NULL,
  code                        TEXT        NOT NULL,
  start_time                  TIME        NOT NULL DEFAULT '09:00',
  end_time                    TIME        NOT NULL DEFAULT '18:00',
  is_night_shift              BOOLEAN     NOT NULL DEFAULT false,
  is_flexible                 BOOLEAN     NOT NULL DEFAULT false,
  flexible_hours_per_day      NUMERIC(4,2),
  working_days                INTEGER[]   NOT NULL DEFAULT '{1,2,3,4,5}',
  break_minutes               INTEGER     NOT NULL DEFAULT 60,
  grace_period_minutes        INTEGER     NOT NULL DEFAULT 10,
  half_day_threshold_minutes  INTEGER     NOT NULL DEFAULT 240,
  full_day_threshold_minutes  INTEGER     NOT NULL DEFAULT 480,
  overtime_threshold_minutes  INTEGER     NOT NULL DEFAULT 480,
  is_default                  BOOLEAN     NOT NULL DEFAULT false,
  status                      TEXT        NOT NULL DEFAULT 'active',
  created_by                  UUID,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_shifts_workspace ON public.hr_shifts(workspace_id);

ALTER TABLE public.hr_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_shifts_isolation" ON public.hr_shifts
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`working_days` uses JS `Date.getDay()` convention: `0=Sun, 1=Mon, ... 6=Sat`.
Default `{1,2,3,4,5}` = Mon–Fri.

#### Indexes
- `idx_hr_shifts_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy (same convention as `hr_employee_education`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_shifts;
```

---

### Block B — `hr_shift_assignments`

#### Purpose
Maps employees to shifts with effective-dated history, so shift changes don't
overwrite the past and attendance computed for prior dates remains correct.

#### Affected tables
- `public.hr_shift_assignments` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_shift_assignments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  shift_id       UUID        NOT NULL REFERENCES public.hr_shifts(id) ON DELETE RESTRICT,
  effective_from DATE        NOT NULL,
  effective_to   DATE,
  created_by     UUID,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_employee  ON public.hr_shift_assignments(employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_workspace ON public.hr_shift_assignments(workspace_id);

ALTER TABLE public.hr_shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_shift_assignments_isolation" ON public.hr_shift_assignments
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Indexes
- `idx_hr_shift_assignments_employee` on `(employee_id, effective_from DESC)`
- `idx_hr_shift_assignments_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `employee_id -> hr_employees(id)` ON DELETE CASCADE
- `shift_id -> hr_shifts(id)` ON DELETE RESTRICT (cannot delete a shift while assigned)

#### RLS impact
New table, new workspace-isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_shift_assignments;
```

---

### Block C — `hr_holidays`

#### Purpose
Company holiday calendar. Drives the `HOLIDAY` attendance status for days with
no punch, per `about-system/04-module-workflows/attendance-workflow.md` §5.

#### Affected tables
- `public.hr_holidays` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_holidays (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  date           DATE        NOT NULL,
  holiday_type   TEXT        NOT NULL DEFAULT 'company',
  department_ids UUID[],
  created_by     UUID,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_holidays_workspace_date ON public.hr_holidays(workspace_id, date);

ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_holidays_isolation" ON public.hr_holidays
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`department_ids = NULL` means the holiday applies to the whole workspace.
`holiday_type` is one of `national | regional | company | optional`.

#### Indexes
- `idx_hr_holidays_workspace_date` on `(workspace_id, date)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_holidays;
```

---

### Block D — `hr_attendance_breaks`

#### Purpose
Tracks break start/end events within a day so total worked hours exclude break
time (lunch, tea, personal).

#### Affected tables
- `public.hr_attendance_breaks` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_attendance_breaks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  attendance_id UUID        NOT NULL REFERENCES public.hr_attendance(id) ON DELETE CASCADE,
  break_start   TIMESTAMPTZ NOT NULL DEFAULT now(),
  break_end     TIMESTAMPTZ,
  break_type    TEXT        NOT NULL DEFAULT 'break',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_breaks_attendance ON public.hr_attendance_breaks(attendance_id);

ALTER TABLE public.hr_attendance_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_attendance_breaks_isolation" ON public.hr_attendance_breaks
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Indexes
- `idx_hr_attendance_breaks_attendance` on `(attendance_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `attendance_id -> hr_attendance(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_attendance_breaks;
```

---

### Block E — extend `hr_attendance`

#### Purpose
Adds shift linkage, work mode (office/WFH), break totals, and late/early-leave
minutes needed for shift-aware status computation.

#### Affected tables
- `public.hr_attendance` (altered)

```sql
ALTER TABLE public.hr_attendance
  ADD COLUMN IF NOT EXISTS shift_id            UUID REFERENCES public.hr_shifts(id),
  ADD COLUMN IF NOT EXISTS work_mode           TEXT NOT NULL DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS total_break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source              TEXT NOT NULL DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_hr_attendance_shift ON public.hr_attendance(shift_id);
```

`work_mode` is `office | work_from_home`. `source` is `web | mobile | kiosk |
biometric` (the latter two used from Prompt 2/3 onward).

New `status` values now produced by the app (column is a free-text string,
no enum change needed): `half_day`, `holiday`, `weekend`, `work_from_home`
— added alongside the existing `present | absent | late | on_leave`.

#### Indexes
- `idx_hr_attendance_shift` on `(shift_id)`

#### Foreign keys
- `shift_id -> hr_shifts(id)`

#### RLS impact
None — covered by existing `hr_attendance` isolation policy.

#### Rollback
```sql
ALTER TABLE public.hr_attendance
  DROP COLUMN IF EXISTS shift_id,
  DROP COLUMN IF EXISTS work_mode,
  DROP COLUMN IF EXISTS total_break_minutes,
  DROP COLUMN IF EXISTS late_minutes,
  DROP COLUMN IF EXISTS early_leave_minutes,
  DROP COLUMN IF EXISTS source;
```

---

### Block F — seed default shifts

#### Purpose
Every workspace gets the 5 standard shifts out of the box so "Employee Shift
Assignment" and the punch flow have a sensible default (`GENERAL` is
`is_default = true`, used as fallback for unassigned employees).

#### Affected tables
- `public.hr_shifts` (data only)

```sql
INSERT INTO public.hr_shifts (workspace_id, name, code, start_time, end_time, is_night_shift, is_flexible, flexible_hours_per_day, working_days, break_minutes, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, overtime_threshold_minutes, is_default, status)
SELECT id, 'General Shift', 'GENERAL', '09:00', '18:00', false, false, NULL, ARRAY[1,2,3,4,5], 60, 10, 240, 480, 480, true, 'active' FROM public.workspaces
ON CONFLICT (workspace_id, code) DO NOTHING;

INSERT INTO public.hr_shifts (workspace_id, name, code, start_time, end_time, is_night_shift, is_flexible, flexible_hours_per_day, working_days, break_minutes, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, overtime_threshold_minutes, is_default, status)
SELECT id, 'Morning Shift', 'MORNING', '06:00', '14:00', false, false, NULL, ARRAY[1,2,3,4,5], 30, 10, 240, 480, 480, false, 'active' FROM public.workspaces
ON CONFLICT (workspace_id, code) DO NOTHING;

INSERT INTO public.hr_shifts (workspace_id, name, code, start_time, end_time, is_night_shift, is_flexible, flexible_hours_per_day, working_days, break_minutes, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, overtime_threshold_minutes, is_default, status)
SELECT id, 'Evening Shift', 'EVENING', '14:00', '22:00', false, false, NULL, ARRAY[1,2,3,4,5], 30, 10, 240, 480, 480, false, 'active' FROM public.workspaces
ON CONFLICT (workspace_id, code) DO NOTHING;

INSERT INTO public.hr_shifts (workspace_id, name, code, start_time, end_time, is_night_shift, is_flexible, flexible_hours_per_day, working_days, break_minutes, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, overtime_threshold_minutes, is_default, status)
SELECT id, 'Night Shift', 'NIGHT', '22:00', '06:00', true, false, NULL, ARRAY[1,2,3,4,5], 30, 10, 240, 480, 480, false, 'active' FROM public.workspaces
ON CONFLICT (workspace_id, code) DO NOTHING;

INSERT INTO public.hr_shifts (workspace_id, name, code, start_time, end_time, is_night_shift, is_flexible, flexible_hours_per_day, working_days, break_minutes, grace_period_minutes, half_day_threshold_minutes, full_day_threshold_minutes, overtime_threshold_minutes, is_default, status)
SELECT id, 'Flexible Shift', 'FLEXIBLE', '00:00', '23:59', false, true, 8, ARRAY[1,2,3,4,5], 60, 10, 240, 480, 480, false, 'active' FROM public.workspaces
ON CONFLICT (workspace_id, code) DO NOTHING;
```

This also needs to run again for any **new workspace** created in future
(or wire into the workspace-creation flow later — out of scope for this prompt).

#### Rollback
```sql
DELETE FROM public.hr_shifts WHERE code IN ('GENERAL','MORNING','EVENING','NIGHT','FLEXIBLE');
```

---

## 2. Application Architecture

### Status computation (shift-aware)

Implemented in `app/api/hrms/attendance/_lib/helpers.ts`. Order of precedence
for a day **without any punch**:

1. `hr_holidays` covers the date (and employee's department, if scoped) → `holiday`
2. Date's weekday not in the assigned shift's `working_days` → `weekend`
3. Approved leave covers the date (existing sync from leave module) → `on_leave`
4. Otherwise → `absent`

For a day **with a punch** (check-in present):
- `late_minutes = max(0, checkInMinutes - (shiftStart + grace_period_minutes))`
  (flexible shifts never compute lateness)
- On check-out: `work_minutes = (checkOut - checkIn) - total_break_minutes`,
  `overtime_minutes = max(0, work_minutes - overtime_threshold_minutes)`,
  `early_leave_minutes = max(0, shiftEndMinutes - checkOutMinutes)`
- Status:
  - `work_minutes < half_day_threshold_minutes` → `half_day`
  - else `work_mode = work_from_home` → `work_from_home`
  - else `late_minutes > 0` → `late`
  - else → `present`

Working on a holiday/weekend still records `present`/`late`/etc. (a punch
always takes precedence over the no-punch defaults).

### New API routes

- `GET/POST /api/hrms/attendance/shifts` — list / create shifts (read: any
  workspace member; write: HR/super_admin)
- `PATCH/DELETE /api/hrms/attendance/shifts/[id]` — update / deactivate shift (HR/super_admin)
- `GET/POST /api/hrms/attendance/shift-assignments` — roster (current
  assignment per employee) / assign shift with effective date (HR/super_admin)
- `GET/POST /api/hrms/attendance/holidays` — list / create holidays (HR/super_admin write)
- `DELETE /api/hrms/attendance/holidays/[id]` — remove holiday (HR/super_admin)
- `POST /api/hrms/attendance/punch` — self check-in / check-out / break-start /
  break-end for the calling user's employee record
- `GET /api/hrms/attendance/calendar` — month view (own data, or any employee for HR)
- `GET /api/hrms/attendance/reports` — monthly per-employee summary (HR/super_admin)

### New / changed pages

- `app/dashboard/hrms/attendance/page.tsx` — rewritten with role-aware tabs:
  - **My Attendance** (all roles): punch in/out + break widget, today's status
  - **Calendar** (all roles): monthly attendance calendar/history for self (HR can view any employee)
  - **Team** (HR/super_admin/team_lead): existing daily table + summary cards
  - **Reports** (HR/super_admin): monthly per-employee summary
- `app/dashboard/hrms/attendance/shifts/page.tsx` — new, HR-only: Shifts CRUD,
  Holiday calendar CRUD, and shift-assignment roster.

---

## 3. Completion percentage methodology

Overall "Attendance System" completion is tracked as a weighted average across
the 7 ChatGPT prompts:

| Prompt | Scope | Weight |
|---|---|---|
| 1 | Attendance Foundation | 20% |
| 2 | Biometric Architecture Foundation | 10% |
| 3 | GEON Device Integration | 15% |
| 4 | Attendance Automation | 15% |
| 5 | GPS Attendance | 10% |
| 6 | Geo-Fencing | 10% |
| 7 | Face Recognition + Enterprise Polish | 20% |

Prompt 3 is blocked until the GEON device model/API/SDK details are known
(per the ChatGPT conversation) — it stays at 0% until then.
