# User Management — Employee Sync Fix

## Issue
Two separate "add a person" flows existed and behaved inconsistently:
- HRMS → Employees → "Add Employee" creates `auth.users` + `profiles` (with `workspace_id`) +
  `hr_employees` — fully usable (shows in employee lists, can apply for leave, etc).
- Settings → User Management → "Invite User" only created `auth.users` + a `profiles` row, and
  that `profiles` insert ran *after* the `on_auth_user_created` trigger had already inserted a
  `profiles` row for the new user (with `workspace_id = NULL`, default `role`). The app's
  `.insert()` then silently failed (duplicate key on `profiles.user_id`), leaving
  `workspace_id = NULL` and the wrong role. Result:
  - The user saw "Workspace not configured" on Leave Management.
  - No `hr_employees` row was created, so the user never appeared in any HRMS employee picker
    and could not apply for leave.

## Code fix (already applied)
`app/api/users/invite/route.ts`:
- `profiles` insert changed to `.upsert(..., { onConflict: "user_id" })` so it correctly
  overwrites the trigger-created row with the right `workspace_id` and `role` (same fix as the
  HRMS employee-creation routes).
- After the profile is set, an `hr_employees` row is now also created for the new user
  (`employee_code` auto-generated as `EMP-XXX`, `designation: ""`, `employment_type:
  "full_time"`, `date_of_joining`: today, `status: "active"`), so every user invited via User
  Management "counts" as an employee exactly like HRMS "Add Employee" — regardless of role.
- Both the auth user and profile are rolled back if the `hr_employees` insert fails.

No further code changes are needed; new invites from User Management will now work end-to-end.

---

## One-time SQL migration (run manually in Supabase SQL Editor)

### Purpose
Repair accounts that were already created via the old "Invite User" flow before this fix
(e.g. "Surya Ganesh") — their `profiles.workspace_id` is `NULL` and they have no `hr_employees`
row.

### Affected tables
- `public.profiles` (fixes `workspace_id` for any row where it is `NULL`)
- `public.hr_employees` (inserts a row for any `profiles` row that doesn't have one)

### Migration SQL
```sql
-- 1. Link any orphaned profiles (workspace_id IS NULL) to the workspace.
--    Safe for single-workspace setups; if you ever run multiple workspaces, replace the
--    subquery with the correct workspace id for each affected user instead.
UPDATE public.profiles
SET workspace_id = (SELECT id FROM public.workspaces ORDER BY created_at ASC LIMIT 1)
WHERE workspace_id IS NULL;

-- 2. Create hr_employees records for any profiles that don't have one yet.
WITH next_codes AS (
  SELECT
    p.user_id,
    p.workspace_id,
    'EMP-' || LPAD(
      (
        COALESCE((
          SELECT MAX(CAST(SUBSTRING(he.employee_code FROM 'EMP-(\d+)') AS INTEGER))
          FROM public.hr_employees he
          WHERE he.workspace_id = p.workspace_id AND he.employee_code ~ '^EMP-\d+$'
        ), 0)
        + ROW_NUMBER() OVER (PARTITION BY p.workspace_id ORDER BY p.created_at)
      )::text, 3, '0'
    ) AS employee_code
  FROM public.profiles p
  LEFT JOIN public.hr_employees he ON he.user_id = p.user_id
  WHERE he.id IS NULL
)
INSERT INTO public.hr_employees (workspace_id, user_id, employee_code, designation, employment_type, date_of_joining, status)
SELECT workspace_id, user_id, employee_code, '', 'full_time', CURRENT_DATE, 'active'
FROM next_codes;
```

### Indexes / Foreign keys
None added — uses existing `hr_employees` columns and the existing
`UNIQUE(workspace_id, employee_code)` constraint (the generated `EMP-XXX` codes continue the
existing numbering per workspace).

### RLS impact
None — both statements run as the `postgres` role in the SQL editor, bypassing RLS as usual for
admin migrations. No policy changes.

### Rollback
```sql
-- Remove the hr_employees rows created by step 2 (only safe immediately after running it,
-- before any further employee data has been edited):
DELETE FROM public.hr_employees
WHERE designation = '' AND employee_code ~ '^EMP-\d+$' AND created_at > now() - interval '10 minutes';

-- Step 1 cannot be cleanly rolled back (original NULL values are not recoverable);
-- if needed, manually set workspace_id back to NULL for the specific affected user_id values.
```

### After running
Refresh the affected users' Leave Management / Apply Leave pages — "Workspace not configured"
should be gone, and they should appear in HRMS employee lists and pickers.

---

## Files modified
- `app/api/users/invite/route.ts`
