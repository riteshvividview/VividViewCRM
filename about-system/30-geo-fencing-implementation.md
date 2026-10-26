# HRMS — Geo-Fencing (Office Radius Config, Zone Classification, HR Reports)

Implements **Claude Prompt 6 (Geo-Fencing)** from the GEON biometric roadmap
(`attendance-system-chatgpt-convo`). Three of the four Prompt 6 requirements
were already delivered by **Prompt 5 (GPS Attendance)**
(`about-system/29-gps-attendance-implementation.md`); this prompt closes the
remaining gap — **HR reporting** on office vs. remote attendance.

No SQL migration is required for this prompt (besides the
`hr_office_locations` migration from Prompt 5, which is still pending — see
below). This is a pure reporting layer over existing data.

---

## 1. Requirements mapping

| Prompt 6 requirement | Status | Where |
|---|---|---|
| HR can define Office Location + Radius (e.g. 100m / 200m / 500m) | ✅ Done in Prompt 5 | `hr_office_locations` table, "Office Locations" tab in `app/dashboard/hrms/attendance/map/page.tsx` — `radius_meters` is a free-form integer input, so any radius (100/200/500/etc.) is supported |
| Inside Radius → Office Attendance | ✅ Done in Prompt 5 | `zone: "office"` computed in `buildPunchLocation()` (`app/api/hrms/attendance/_lib/geo.ts`) |
| Outside Radius → Remote Attendance | ✅ Done in Prompt 5 | `zone: "remote"` computed the same way; punch is never blocked |
| Store distance from office | ✅ Done in Prompt 5 | `distance_meters` stored in `check_in_location` / `check_out_location` JSONB on `hr_attendance` |
| **Provide HR reports** | ✅ **New in this prompt** | New "Geo-Fencing Report" tab + `GET /api/hrms/attendance/geo-report` |

---

## 1.5 SQL Migration (carried over from Prompt 5 — executed)

The `hr_office_locations` table from Prompt 5 has been **executed** (table,
index, and `hr_office_locations_isolation` RLS policy are live in Supabase).
It is required for zone classification (office vs. remote) to produce
anything other than "No GPS" / 0 counts in the new report. For reference, the
migration was:

```sql
CREATE TABLE IF NOT EXISTS public.hr_office_locations (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID             NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT             NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER          NOT NULL DEFAULT 200,
  is_default    BOOLEAN          NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ      DEFAULT now(),
  updated_at    TIMESTAMPTZ      DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_office_locations_workspace ON public.hr_office_locations(workspace_id);

ALTER TABLE public.hr_office_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_office_locations_isolation" ON public.hr_office_locations
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

No other SQL is needed for Prompt 6 — `check_in_location` / `check_out_location`
(JSONB, already present) are read-only inputs to the new report.

---

## 2. New API route

### `GET /api/hrms/attendance/geo-report` (`app/api/hrms/attendance/geo-report/route.ts`, new)

HR-only (`isHR`). Query params:
- `year`, `month` — defaults to the current IST month.
- `department_id` — optional, filters to active employees in that department.
- `employee_id` — optional, single-employee report.

For every active employee in scope, scans `hr_attendance` for the month and,
for each day with a `check_in_location` or `check_out_location`:
- `zone` = check-in zone, falling back to check-out zone.
- `distance_meters` = check-in distance, falling back to check-out distance.

Returns:
```json
{
  "year": 2026, "month": 6,
  "summary": [
    {
      "employee": { "id": "...", "employee_code": "EMP001", "designation": "...", "department": { "name": "..." }, "profile": { "full_name": "...", "avatar_url": null } },
      "gps_days": 20,
      "office_days": 17,
      "remote_days": 3,
      "no_zone_days": 0,
      "remote_percentage": 15.0,
      "avg_distance_meters": 142
    }
  ],
  "remote_records": [
    {
      "attendance_id": "...",
      "date": "2026-06-12",
      "employee": { "...": "as above" },
      "status": "present",
      "check_in": "2026-06-12T03:31:00.000Z",
      "check_out": "2026-06-12T12:05:00.000Z",
      "check_in_zone": "remote",
      "check_out_zone": "remote",
      "distance_meters": 8400,
      "address": "Sector 18, Noida, Uttar Pradesh, India"
    }
  ],
  "totals": { "gps_days": 320, "office_days": 290, "remote_days": 30, "remote_percentage": 9.4 }
}
```

- `remote_percentage` and `avg_distance_meters` are `0`/`null` for employees
  with zero GPS-tagged days (no division by zero).
- `remote_records` is sorted newest-first and only includes days classified
  `"remote"` (i.e. outside every configured office radius).
- `totals` aggregates across all employees in scope, for the summary cards.

---

## 3. New UI — "Geo-Fencing Report" tab

`app/dashboard/hrms/attendance/map/page.tsx` gains a third tab (alongside
"Live Map" and "Office Locations"):

- **Month navigation** (prev/next, disabled on the current month) +
  **department filter**, matching the existing Reports tab pattern in
  `app/dashboard/hrms/attendance/page.tsx`.
- **Summary cards**: GPS-Tagged Days, Office Attendance, Remote Attendance,
  Remote % — workspace totals for the selected month/department.
- **Per-employee summary table**: GPS Days, Office, Remote, Remote %, Avg
  Distance — one row per active employee.
- **Remote Attendance Records table**: date, employee, check-in/check-out
  times with zone badges, distance from office, reverse-geocoded address, and
  attendance status — the detailed audit list HR needs for remote-work policy
  review.

Reuses existing helpers/components from the Live Map tab: `ZoneBadge`,
`STATUS_STYLE`, `fmtTime`, `istToday`/`currentISTMonth`.

---

## 4. Completion percentage methodology

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (pending migration) |
| 3 | GEON Device Integration | 15% | 0% (blocked — see GEON requirements note) |
| 4 | Attendance Automation | 15% | 100% (pending migration) |
| 5 | GPS Attendance | 10% | 100% (migration executed) |
| 6 | Geo-Fencing | 10% | **100%** (migration executed) |
| 7 | Face Recognition + Enterprise Polish | 20% | 0% |

**Overall Attendance System completion ≈ 64%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0.10×1.00 + 0.10×1.00 + 0).
