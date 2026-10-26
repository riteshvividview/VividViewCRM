# HRMS — Biometric Architecture Foundation (Device Registry, Sync Service, Audit Logs)

Implements **Claude Prompt 2 (Biometric Foundation)** from the GEON biometric
roadmap (`attendance-system-chatgpt-convo`). Establishes the generic biometric
device registry, attendance sync service, sync monitoring/logs, manual sync,
failed-sync tracking, and a reusable audit log — the architecture that
**Prompt 3 (GEON Integration)** will plug a device-specific adapter into.

**No specific device is integrated in this prompt** (per instructions). The
sync service ships with an empty adapter registry, so any "Sync Now" run
completes as `failed` with a clear "no adapter configured" message — this
proves the end-to-end architecture (trigger → log → audit trail → dashboard)
without faking device data.

All new tables follow the existing convention: accessed via Supabase client +
RLS only (no Prisma/NestJS at runtime).

---

## 1. SQL Migration (run manually in Supabase SQL Editor, in order)

### Block A — `hr_biometric_devices`

#### Purpose
Generic device registry. Stores connection details for any biometric device
(fingerprint, face, RFID) regardless of vendor — Device Name, Model, Serial
Number, IP Address, Location, Status, plus sync configuration and last-sync
summary fields used by the monitoring dashboard.

#### Affected tables
- `public.hr_biometric_devices` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_biometric_devices (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  device_name           TEXT        NOT NULL,
  device_model          TEXT,
  serial_number         TEXT,
  ip_address            TEXT,
  port                  INTEGER,
  location              TEXT,
  status                TEXT        NOT NULL DEFAULT 'inactive',
  sync_interval_minutes INTEGER     NOT NULL DEFAULT 30,
  last_sync_at          TIMESTAMPTZ,
  last_sync_status      TEXT,
  notes                 TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_hr_biometric_devices_workspace ON public.hr_biometric_devices(workspace_id);

ALTER TABLE public.hr_biometric_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_biometric_devices_isolation" ON public.hr_biometric_devices
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`status` is one of `active | inactive | maintenance` (admin-controlled).
`last_sync_status` is one of `success | partial | failed | null` (set by the
sync service, independent of `status`). `UNIQUE (workspace_id, serial_number)`
allows multiple devices with NULL serial (Postgres treats NULLs as distinct).

#### Indexes
- `idx_hr_biometric_devices_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy (same convention as `hr_shifts`).

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_biometric_devices;
```

---

### Block B — `hr_biometric_sync_logs`

#### Purpose
Records every sync attempt (manual now, scheduled in future) per device —
counts fetched/created/updated/failed records and any error — powering the
Sync Monitoring Dashboard and Failed Sync Tracking views.

#### Affected tables
- `public.hr_biometric_sync_logs` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_biometric_sync_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  device_id       UUID        NOT NULL REFERENCES public.hr_biometric_devices(id) ON DELETE CASCADE,
  sync_type       TEXT        NOT NULL DEFAULT 'manual',
  status          TEXT        NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  records_fetched INTEGER     NOT NULL DEFAULT 0,
  records_created INTEGER     NOT NULL DEFAULT 0,
  records_updated INTEGER     NOT NULL DEFAULT 0,
  records_failed  INTEGER     NOT NULL DEFAULT 0,
  error_message   TEXT,
  triggered_by    UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_biometric_sync_logs_device    ON public.hr_biometric_sync_logs(device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_biometric_sync_logs_workspace ON public.hr_biometric_sync_logs(workspace_id, started_at DESC);

ALTER TABLE public.hr_biometric_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_biometric_sync_logs_isolation" ON public.hr_biometric_sync_logs
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`sync_type` is `manual | scheduled`. `status` is `running | success | partial
| failed`.

#### Indexes
- `idx_hr_biometric_sync_logs_device` on `(device_id, started_at DESC)`
- `idx_hr_biometric_sync_logs_workspace` on `(workspace_id, started_at DESC)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `device_id -> hr_biometric_devices(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_biometric_sync_logs;
```

---

### Block C — `hr_audit_logs`

#### Purpose
General-purpose audit trail for HRMS actions that need a record of "who did
what, when" beyond simple `created_by`/`updated_at` columns. First consumer is
the biometric device registry (create/update/delete device, sync
triggered/succeeded/failed); **Prompt 7 (Attendance Audit Trail)** will reuse
this same table for attendance corrections/approvals instead of creating a
second audit table.

#### Affected tables
- `public.hr_audit_logs` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type  TEXT        NOT NULL,
  entity_id    UUID,
  action       TEXT        NOT NULL,
  description  TEXT,
  changes      JSONB,
  performed_by UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_workspace_created ON public.hr_audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_entity            ON public.hr_audit_logs(entity_type, entity_id);

ALTER TABLE public.hr_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_audit_logs_isolation" ON public.hr_audit_logs
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

`entity_type` examples: `biometric_device`. `action` examples: `create |
update | delete | sync_triggered | sync_success | sync_partial | sync_failed`.
`changes` stores a JSON snapshot of relevant before/after fields.

#### Indexes
- `idx_hr_audit_logs_workspace_created` on `(workspace_id, created_at DESC)`
- `idx_hr_audit_logs_entity` on `(entity_type, entity_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- (no FK on `entity_id` — it is polymorphic across entity types, and rows must
  remain after a referenced entity is deleted)

#### RLS impact
New table, new workspace-isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_audit_logs;
```

---

## 2. Application Architecture

### Sync service (adapter pattern, no adapters registered yet)

Implemented in `app/api/hrms/attendance/biometric/_lib/sync-service.ts`:

- `runDeviceSync(admin, ctx, device, syncType)`:
  1. Inserts a `hr_biometric_sync_logs` row with `status = 'running'`.
  2. Looks up `device.device_model` in `DEVICE_ADAPTERS` (currently empty —
     Prompt 3 will register a `GEON ...` adapter here).
  3. If no adapter: completes the log as `status = 'failed'`,
     `error_message = 'No integration adapter configured for device model
     "<model>". Device-specific sync arrives with Prompt 3 (GEON Integration).'`
  4. Updates the device's `last_sync_at` / `last_sync_status`.
  5. Writes a `hr_audit_logs` row (`action = 'sync_triggered'` then
     `sync_failed`/`sync_success`/`sync_partial`).
- `writeAuditLog(admin, workspaceId, params)`: shared helper used by the
  device CRUD routes and the sync service.

### New API routes

- `GET/POST /api/hrms/attendance/biometric/devices` — list / register devices
  (HR/super_admin only)
- `PATCH/DELETE /api/hrms/attendance/biometric/devices/[id]` — update / remove
  a device (HR/super_admin)
- `POST /api/hrms/attendance/biometric/devices/[id]/sync` — Manual Sync button
  (HR/super_admin); runs `runDeviceSync(..., "manual")`
- `GET /api/hrms/attendance/biometric/sync-logs` — sync history, filterable by
  `device_id` / `status` (Failed Sync Tracking uses `status=failed`)
- `GET /api/hrms/attendance/biometric/audit-logs` — recent audit trail,
  filterable by `entity_type`

### New page

- `app/dashboard/hrms/attendance/biometric/page.tsx` — new, HR-only:
  - Summary cards: total devices, active devices, devices whose last sync
    failed, most recent sync time across all devices
  - **Devices** tab: registry CRUD (Device Name, Model, Serial, IP, Port,
    Location, Status, sync interval, notes) + per-device **Sync Now** button
    and last-sync status badge
  - **Sync Logs** tab: full sync history table with device/status filters
    (failed runs highlighted — Failed Sync Tracking)
  - **Audit Logs** tab: recent create/update/delete/sync actions with actor
    and timestamp
- `app/dashboard/hrms/attendance/page.tsx` — added a "Biometric Devices"
  header action (HR/super_admin) next to "Manage Shifts"

---

## 3. Completion percentage methodology

Unchanged from `about-system/26-attendance-foundation-implementation.md` §3 —
Prompt 2 carries **10% weight** of the overall Attendance System. With this
prompt's implementation complete (pending the SQL migration above), Prompt 2
contributes its full share once the migration is run.

Prompt 3 (GEON Integration, 15%) remains blocked at 0% until the GEON device
model/API/SDK details are known — at that point a device adapter is registered
in `DEVICE_ADAPTERS` and `hr_biometric_punch_logs` (raw punch storage) is
introduced as part of that prompt.