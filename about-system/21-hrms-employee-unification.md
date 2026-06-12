# HRMS — Employee Unification, Department Detail & Profile Embed Fix

## 1. SQL Migration (run manually in Supabase SQL Editor)

### Purpose
PostgREST nested embeds such as `hr_employees.select("*, profiles(full_name, avatar_url)")` were
silently failing across the HRMS module because no foreign key existed between
`hr_employees.user_id` and `public.profiles`. This migration adds that FK so the existing
embeds (already present in the employee list, employee detail, department list/detail,
attendance, leaves, and HR dashboard pages) start returning employee names/avatars.

### Affected tables
- `public.profiles` (new unique index on `user_id`)
- `public.hr_employees` (new foreign key on `user_id`)

### Migration SQL
```sql
-- 1. Required so hr_employees.user_id can reference profiles.user_id
--    (idempotent — safe even if a unique constraint with a different name already exists,
--    but will FAIL if duplicate profiles.user_id values currently exist; if so, de-duplicate
--    profiles first with: SELECT user_id, COUNT(*) FROM profiles GROUP BY user_id HAVING COUNT(*) > 1;)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id);

-- 2. Second FK on hr_employees.user_id (in addition to the existing auth.users(id) FK).
--    A column may have multiple FK constraints to different tables; this is safe because
--    every auth.users row has a corresponding profiles row with the same user_id.
ALTER TABLE public.hr_employees
  ADD CONSTRAINT hr_employees_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
```

### Indexes
- Adds `profiles_user_id_key` (UNIQUE) on `profiles(user_id)`.

### Foreign keys
- Adds `hr_employees_user_id_profiles_fkey`: `hr_employees.user_id -> profiles.user_id`,
  `ON DELETE SET NULL`. Existing `hr_employees.user_id -> auth.users(id)` FK is unaffected.

### RLS impact
None. No policies reference this column relationship; both tables keep their existing
`workspace_id`-scoped `FOR ALL` isolation policies.

### Rollback
```sql
ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_user_id_profiles_fkey;
```
Do NOT drop `profiles_user_id_key` — confirmed (2026-06-10) that this UNIQUE constraint
already existed on `profiles.user_id` before this migration. Step 1's
`CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key` was a no-op for that reason.
Dropping it would break a pre-existing constraint unrelated to this change.

### Status (2026-06-10)
The FK was created successfully, then accidentally dropped again when the rollback's
first line was run by mistake (its second line then failed on `profiles_user_id_key`,
which is why only the FK got removed). The unique index/constraint on `profiles.user_id`
was never affected. Fix: re-run only the `ADD CONSTRAINT` statement from step 2 above
(step 1's `CREATE UNIQUE INDEX` is not needed again since it already exists), then
reload PostgREST's schema cache.

### After running
First, refresh PostgREST's schema cache so the new FK is picked up by the REST API
(without this, embeds like `hr_employees.select("*, profiles(...)")` fail with
`PGRST200: Could not find a relationship between 'hr_employees' and 'profiles'`):
```sql
NOTIFY pgrst, 'reload schema';
```
If that doesn't take effect within ~60s, use Project Settings -> API -> Restart server.

Then:
```bash
cd backend
npx prisma db pull
npx prisma generate
npm run build
```

---

## 2. New unified employee creation flow

### Why
Previously, "Add Employee" in HRMS only inserted a row into `hr_employees` (with a fragile
email-based lookup against `profiles`), creating no login account. Meanwhile User Management's
"Invite User" created a full `auth.users` + `profiles` account with a random password emailed
to the user. The user asked for these to be the same flow.

### What changed
- **New route**: `app/api/hrms/employees/route.ts` (POST). Allowed for `super_admin` and `hr`
  roles (workspace resolved from caller's profile). For each new employee it:
  1. Creates an `auth.users` account via `supabaseAdmin.auth.admin.createUser()` with a
     random 10-character password (same generator as `/api/users/invite`)
  2. Inserts a `profiles` row (`role: "employee"`, scoped to caller's `workspace_id`)
  3. Inserts the linked `hr_employees` row (`user_id` = new auth user id)
  4. Emails login credentials using the existing Brevo invite template
  5. Rolls back the created auth user/profile if the `hr_employees` insert fails
     (e.g. duplicate employee code)
- **Rewrote** `app/dashboard/hrms/employees/new/page.tsx`: removed the email-lookup logic,
  made Email required, and the form now POSTs to `/api/hrms/employees` instead of inserting
  directly into `hr_employees`. Success message confirms credentials were emailed.

### Why three tables (auth.users / profiles / hr_employees) still exist
- `auth.users` — Supabase's authentication identity (login/password) — required by Supabase Auth.
- `profiles` — workspace membership + role (used for RBAC, CRM `assigned_to`, etc.) across the
  whole CRM, not just HR.
- `hr_employees` — HR-specific data (designation, salary, department, attendance/leave/payroll
  links) that doesn't belong on every user (e.g. `super_admin` accounts with no HR record).

The new `/api/hrms/employees` route creates all three in one step, so from the user's
perspective adding an employee from HRMS now behaves exactly like User Management's "Invite
User" — the only difference is it also creates the linked `hr_employees` record.

---

## 3. Department detail page

### New page
`app/dashboard/hrms/departments/[id]/page.tsx` — shows department info (description, parent
department, head/manager), employee count, and a list of employees currently assigned to the
department (name, avatar, code, designation, status). Each employee row has a menu to:
- **Move to another department** (updates `hr_employees.department_id`)
- **Remove from department** (sets `hr_employees.department_id = NULL`)

### Department list
`app/dashboard/hrms/departments/page.tsx` — department cards now link to the detail page above
(dropdown menu for Edit/Delete still works via `stopPropagation`, doesn't trigger navigation).

---

## 4. Employee deletion (cascade)

`app/dashboard/hrms/employees/[id]/page.tsx` — added a "Delete" button with confirmation
dialog. Deletes the `hr_employees` row via the existing `hr_employees_isolation` RLS policy
(`FOR ALL`, no extra API needed). Per the schema in `18-hrms-db-setup.md`, this automatically:
- Cascades (deletes) the employee's `hr_attendance`, `hr_leave_applications`,
  `hr_leave_balances`, `hr_payslips` rows
- Sets `hr_departments.head_employee_id` and any `hr_employees.reporting_manager_id` pointing
  to this employee to `NULL`
- Sets `hr_employees.user_id`'s reverse link to `NULL` is not applicable (the row itself is
  deleted); the employee's `auth.users`/`profiles` login account is **not** deleted — they
  simply lose their HR record (matches "remove from HR but keep platform access" semantics;
  to fully deactivate login access too, deactivate the user from User Management).

---

## 5. HR Dashboard pending approvals fix

`app/dashboard/hrms/page.tsx` — the pending-leaves widget filtered on `status = "pending"`,
which never matches because leave applications use `pending_l1` / `pending_l2`. Changed to
`.in("status", ["pending_l1", "pending_l2"])` so HR now sees pending leave requests to
approve/reject, with employee names resolved via the FK fix in section 1.

---

## 6. PostgREST ambiguous embed fix (hr_employees <-> hr_departments)

### Issue
After the FK migration in section 1 was applied, the Employees list page failed with
`PGRST201: Could not embed because more than one relationship was found for 'hr_employees'
and 'hr_departments'`. Two FKs connect these tables:
- `hr_employees.department_id -> hr_departments.id`
- `hr_departments.head_employee_id -> hr_employees.id`

PostgREST cannot pick one automatically, so any `hr_employees.select("..., hr_departments(...)")`
must disambiguate with `hr_departments!department_id(...)`.

### Fix
- `app/dashboard/hrms/employees/page.tsx` — `hr_departments(name)` -> `hr_departments!department_id(name)`
- `app/dashboard/hrms/employees/[id]/page.tsx` — `hr_departments(id, name)` -> `hr_departments!department_id(id, name)`

No other HRMS embeds were ambiguous (all other `hr_employees`/`profiles`/`hr_departments`
relations have exactly one FK path).

---

## 7. "Create Login" for employees with no linked account

### Issue
Employee records created via the OLD pre-unification "Add Employee" flow (before section 2's
unified API existed) have `hr_employees.user_id = NULL` — no `auth.users`/`profiles` row is
linked. Since the employee's name/avatar come from the `profiles` embed (joined via `user_id`),
these records show "Unknown" / "—" / "?" everywhere in the UI even though their HR data
(designation, department, salary, dates) is intact.

### Fix
- **New route**: `app/api/hrms/employees/[id]/create-login/route.ts` (POST). Allowed for
  `super_admin`/`hr` roles in the employee's own workspace, only when `hr_employees.user_id IS
  NULL`. Given `{ full_name, email }` it:
  1. Creates an `auth.users` account with a random 10-character password
  2. Inserts a `profiles` row (`role: "employee"`, caller's `workspace_id`)
  3. Updates the existing `hr_employees.user_id` to the new account's id
  4. Emails login credentials via the existing Brevo invite template
  5. Rolls back the created auth user/profile if the `hr_employees` update fails
- **`app/dashboard/hrms/employees/[id]/page.tsx`**: when `employee.profiles` is null, shows an
  amber "no login account linked" banner and a **Create Login** button (next to Edit/Delete)
  that opens a dialog for Full Name + Email and calls the new route. On success, the page
  reloads its data so the name/avatar appear immediately. The page's data-loading logic was
  extracted from the mount `useEffect` into a reusable `load()` function for this re-fetch.

### Remediation for the existing orphaned record (EMP-002, Media dept, Graphic Designer)
Use the new **Create Login** button on that employee's profile page to link an account —
no SQL needed. New employees added via section 2's unified flow are unaffected (always
created with `user_id` set).

---

## Files added/modified

**Added**
- `app/api/hrms/employees/route.ts`
- `app/api/hrms/employees/[id]/create-login/route.ts`
- `app/dashboard/hrms/departments/[id]/page.tsx`
- `about-system/21-hrms-employee-unification.md` (this file)

**Modified**
- `app/dashboard/hrms/page.tsx` (pending leave status filter + error logging)
- `app/dashboard/hrms/employees/page.tsx` (error handling/toast on load failure; fixed ambiguous `hr_departments` embed)
- `app/dashboard/hrms/employees/new/page.tsx` (rewritten to use unified API)
- `app/dashboard/hrms/employees/[id]/page.tsx` (added Delete Employee + confirm dialog; fixed ambiguous `hr_departments` embed; added "Create Login" banner/dialog for unlinked employees)
- `app/dashboard/hrms/departments/page.tsx` (cards link to department detail page)
