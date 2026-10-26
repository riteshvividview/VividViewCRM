# Employee Three-Dot Menu & "Remove Employee" (full removal)

## Issue reported
On HRMS → Employees, the "..." icon next to each employee's status badge showed
no options when clicked (it was a plain `Button`, never wired to a
`DropdownMenu`). The user also asked for a "Remove Employee" action that, from
either the Employees list or Settings → User Management, removes that person
"from the entire system, all departments everywhere".

## Design decision (confirmed with user)
"Remove Employee" performs two things together:
1. **Hard-deletes the `hr_employees` row.** Per the existing DB schema this
   cascades to `hr_attendance`, `hr_leave_applications`, `hr_leave_balances`,
   `hr_payslips` for that employee, and nulls any
   `hr_departments.head_employee_id` / `hr_employees.reporting_manager_id`
   references — so the person disappears from every department, attendance
   record, leave list and payroll run.
2. **Disables their login** (`profiles.disabled = true`) if one is linked, so
   they can no longer sign in or appear as active anywhere in the app.

The `auth.users` / `profiles` row itself is **not** hard-deleted. Calling
`auth.admin.deleteUser()` was rejected because `profiles.id` is referenced by
`deals.assigned_to` and `leads.assigned_to` (see
`00-supabase-state/foreign-keys.md`); a hard delete there is irreversible and
could fail or orphan those CRM records. Disabling the login is reversible (an
admin can "Reactivate" from User Management) and keeps ownership history on
deals/leads/tasks intact.

## What changed

### New API routes (service-role/admin client, mirrors `create-login` route)
- **`DELETE /api/hrms/employees/[id]/route.ts`** — caller must be
  `super_admin` or `hr` in the same workspace as the employee. Deletes the
  `hr_employees` row, then if it had a `user_id`, sets
  `profiles.disabled = true` for that user. Blocks removing your own employee
  record.
- **`DELETE /api/users/[id]/remove/route.ts`** — caller must be `super_admin`.
  Takes an `auth.users.id`, finds the matching `hr_employees` row (if any) for
  that user in the caller's workspace and deletes it, then sets
  `profiles.disabled = true`. Blocks removing your own account. Gives the same
  end state as the route above, regardless of entry point.

### `app/dashboard/hrms/employees/page.tsx`
- The per-row "..." button is now a real `DropdownMenu` (desktop table +
  mobile cards) with:
  - **View Profile** → employee detail page
  - **Remove Employee** (red) → confirmation dialog → `DELETE
    /api/hrms/employees/[id]`
- Mobile card layout restructured: the `Link` now wraps only the
  avatar/name/department, with the status badge and the dropdown as siblings
  — avoids the same Link/Portal event-bubbling issue fixed earlier on the
  Departments page.
- Added `user_id` to the employee query/interface so the confirmation dialog
  can mention login disabling only when relevant.

### `app/dashboard/hrms/employees/[id]/page.tsx`
- The existing "Delete" button/dialog is now "Remove", and `handleDelete()`
  calls the new `DELETE /api/hrms/employees/[id]` route instead of deleting
  `hr_employees` directly — so this entry point gets the same login-disable
  behavior as the Employees list.

### `app/dashboard/users/page.tsx` (Settings → User Management)
- Added a "Remove Employee" item (red, below the existing
  Deactivate/Reactivate toggle) to each user's "..." menu, with its own
  confirmation dialog → `DELETE /api/users/[id]/remove`.
- "Deactivate/Reactivate" is unchanged — it only toggles login access without
  touching any `hr_employees` record.

## What you need to do
Nothing in Supabase — no schema changes, no migration. This uses the existing
`profiles.disabled` column and existing cascade FKs documented in
`18-hrms-db-setup.md` / `21-hrms-employee-unification.md`.

To re-enable a removed person's login later: Settings → User Management →
"..." → Reactivate. Their HR employee record will need to be re-created
manually (Employees → Add Employee) since that part is permanently deleted.

## Files added/modified
- `app/api/hrms/employees/[id]/route.ts` (new)
- `app/api/users/[id]/remove/route.ts` (new)
- `app/dashboard/hrms/employees/page.tsx`
- `app/dashboard/hrms/employees/[id]/page.tsx`
- `app/dashboard/users/page.tsx`
