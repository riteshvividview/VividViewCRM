# HRMS — GPS Attendance (Mobile Location Capture, Office Geofence, Attendance Map)

Implements **Claude Prompt 5 (GPS Attendance)** from the GEON biometric roadmap
(`attendance-system-chatgpt-convo`), executed ahead of **Prompt 3 (GEON
Integration)** at the user's request — Prompt 5 operates entirely on punch
data from **Prompt 1 (Attendance Foundation)** and has no dependency on a
biometric device. Prompt 3 remains blocked at 0% pending GEON device details
(see `about-system/27-biometric-foundation-implementation.md` §3).

All new tables follow the existing convention: accessed via Supabase client +
RLS only (no Prisma/NestJS at runtime).

---

## 1. SQL Migration (run manually in Supabase SQL Editor, in order)

### Block A — `hr_office_locations`

#### Purpose
Stores one or more office locations (name, coordinates, geofence radius) per
workspace. Used to classify each GPS punch as **Office** (within radius of the
nearest configured location) or **Remote Attendance** (outside it). With no
office location configured, GPS is still captured but no zone is assigned —
the feature degrades gracefully and never blocks a punch.

#### Affected tables
- `public.hr_office_locations` (new table)

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

`radius_meters` defaults to 200m (typical campus/building geofence). A
workspace may configure multiple locations (e.g. branch offices); each punch
is matched against the **nearest** one. `is_default` marks the primary
location shown first in the UI — not required for zone matching, which checks
all configured locations.

#### Indexes
- `idx_hr_office_locations_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy (same convention as
`hr_biometric_devices` / `hr_attendance_exceptions`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_office_locations;
```

---

### No changes to `hr_attendance`

`check_in_location` and `check_out_location` are **already `JSONB` columns**
on `hr_attendance` (see `about-system/18-hrms-db-setup.md`, Block 7) and were
previously a pass-through of whatever the client sent (nothing did, until now).
This prompt reuses them — no new columns, no migration needed for this table.

Each is now populated with:

```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracy": 12,
  "address": "Connaught Place, New Delhi, Delhi, India",
  "captured_at": "2026-06-13T09:01:32.000Z",
  "distance_meters": 45,
  "zone": "office"
}
```

`zone` is `"office" | "remote" | null`:
- `"office"` — within `radius_meters` of the nearest configured office location.
- `"remote"` — GPS captured but outside every configured office's radius (**Remote Attendance**, per the prompt requirement — the punch is still allowed).
- `null` — no GPS provided by the client (denied/unsupported), or no office location is configured yet.

---

## 2. Application Architecture

### Geo helpers (`app/api/hrms/attendance/_lib/geo.ts`, new)

- `haversineMeters(lat1, lon1, lat2, lon2)` — great-circle distance in meters.
- `OfficeLocation` type + `getOfficeLocations()` / `getDefaultOfficeLocation()`
  — reads `hr_office_locations` for a workspace.
- `findNearestOffice(offices, lat, lng)` — nearest configured office and the
  distance to it, or `null` if none configured.
- `reverseGeocode(lat, lng)` — calls the free **Nominatim (OpenStreetMap)**
  reverse-geocoding API server-side with a `User-Agent` header and a 4s
  timeout; returns `null` on any error/timeout (never throws, never blocks a
  punch).
- `buildPunchLocation(admin, workspaceId, coords, capturedAtISO)` — orchestrates
  the above into the `PunchLocation` JSONB shape stored on `hr_attendance`.
  Returns `null` if the client supplied no coordinates.

### Punch route (`app/api/hrms/attendance/punch/route.ts`)

- **Check-in** and **check-out** now call `buildPunchLocation(admin,
  ctx.workspaceId, body.location, nowISO)` and store the result in
  `check_in_location` / `check_out_location` respectively (previously a raw
  `body.location ?? null` pass-through that nothing populated).
- `body.location` is an optional `{ latitude, longitude, accuracy }` object
  from the client's `navigator.geolocation`. If absent or malformed, the
  column is set to `null` and the punch proceeds exactly as before — **GPS is
  never required to punch**.

### New API routes

- `GET/POST /api/hrms/attendance/office-locations` — HR-only. List / create
  office locations (`name`, `latitude`, `longitude`, `radius_meters`,
  `is_default`). Creating/updating a location with `is_default: true` unsets
  the previous default.
- `PATCH/DELETE /api/hrms/attendance/office-locations/[id]` — HR-only.
  Update / remove an office location.
- `GET /api/hrms/attendance/map?date=YYYY-MM-DD` — HR-only. Returns
  `{ date, offices, punches }` — all configured office locations plus every
  `hr_attendance` row for that date that has a `check_in_location` or
  `check_out_location`, joined with employee profile info, for the
  Attendance Map.

All three are audit-logged via the existing `writeAuditLog` helper
(`entity_type: "office_location"`, reusing `hr_audit_logs` from
`about-system/27-biometric-foundation-implementation.md`).

### My Attendance tab (`app/dashboard/hrms/attendance/page.tsx`)

- `getCurrentCoordinates()` — wraps `navigator.geolocation.getCurrentPosition`
  (high accuracy, 8s timeout). Resolves to `null` on denial, timeout, or an
  unsupported browser — **the punch always proceeds** even if location capture
  fails.
- The Check In / Check Out buttons now request the location and send it as
  `{ action, location }` to `POST /api/hrms/attendance/punch`.
- If the resulting `check_in_location`/`check_out_location` has
  `zone === "remote"`, a toast notifies the employee ("Marked as Remote
  Attendance — you're outside the office area") and a **Remote** badge appears
  next to today's status.
- New **"Attendance Map"** header action (HR/super_admin) alongside Manage
  Shifts, Biometric Devices, and Automation.

### New page — Attendance Map (`app/dashboard/hrms/attendance/map/page.tsx`, HR-only)

Built on **Leaflet + react-leaflet** (OpenStreetMap tiles, no API key) via
`app/dashboard/hrms/attendance/map/_components/leaflet-map.tsx`, dynamically
imported with `ssr: false` (Leaflet requires `window`).

- **Live Map** tab: date picker (default today, IST) →
  `GET /api/hrms/attendance/map?date=...`. Renders office geofence circles
  (indigo) and a color-coded marker per employee punch — green = Office, amber
  = Remote, gray = GPS captured but no office configured. A table below lists
  each employee's check-in/check-out times, zone badges, and reverse-geocoded
  address.
- **Office Locations** tab: CRUD for `hr_office_locations` — name, radius, a
  "Use My Location" button (browser geolocation), and a click-to-set Leaflet
  map preview with the geofence circle.

### New dependencies
- `leaflet`, `react-leaflet@^4` (React 18-compatible; v5 requires React 19),
  `@types/leaflet` — installed with `--legacy-peer-deps` due to a pre-existing
  `eslint` / `eslint-config-next` peer conflict in the project (unrelated to
  these packages, not introduced by this change).

---

## 3. Completion percentage methodology

Per `about-system/26-attendance-foundation-implementation.md` §3, Prompt 5
(GPS Attendance) carries **10% weight** of the overall Attendance System and is
now complete. The SQL migration above has been executed (`hr_office_locations`
table, index, and `hr_office_locations_isolation` RLS policy are live).

| Prompt | Scope | Weight | Status |
|---|---|---|---|
| 1 | Attendance Foundation | 20% | ~95% |
| 2 | Biometric Architecture Foundation | 10% | 100% (pending migration) |
| 3 | GEON Device Integration | 15% | 0% (blocked — see GEON requirements note) |
| 4 | Attendance Automation | 15% | 100% (pending migration) |
| 5 | GPS Attendance | 10% | 100% (migration executed) |
| 6 | Geo-Fencing | 10% | 0% |
| 7 | Face Recognition + Enterprise Polish | 20% | 0% |

**Overall Attendance System completion ≈ 54%**
(0.20×0.95 + 0.10×1.00 + 0.15×0 + 0.15×1.00 + 0.10×1.00 + 0 + 0).

Note: **Prompt 6 (Geo-Fencing)** overlaps significantly with what's built
here — `hr_office_locations`, the office/remote zone classification, and the
map view already cover single/multi-location geofencing. Prompt 6 would mainly
add per-location working-hours rules or stricter enforcement (e.g. blocking
punches outside the geofence) if required.
