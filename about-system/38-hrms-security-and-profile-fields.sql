-- 38 — HRMS hardening + Keka-style personal fields (safe to re-run)
--
-- 1. Role helpers used by RLS.
-- 2. profiles: users may edit their own name/avatar but NOT role/workspace/disabled.
-- 3. Legacy hr_* tables had a single workspace-wide FOR ALL policy, letting any
--    employee write salaries, payslips, attendance, balances from the browser.
--    Replaced with: workspace read (or own-or-HR for private data) + HR-only writes.
--    Employee self-service writes go through service-role API routes.
-- 4. hr_employees sensitive columns (salary, PAN, Aadhaar, bank, emergency contact)
--    are no longer readable by browser roles at all; HR/self read them via the API.
-- 5. Personal fields for Keka-style profiles, birthdays and anniversaries.

-- ── 1. Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('super_admin','hr'));
$$;

CREATE OR REPLACE FUNCTION public.hr_my_workspace() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.hr_my_employee_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM hr_employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── 2. Profiles privilege-escalation guard ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service role (server API) and SQL editor have no auth.uid(); allow them.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.disabled IS DISTINCT FROM OLD.disabled
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to change role, workspace or account status';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

-- New self-inserted profiles may not grant themselves a role or workspace.
CREATE OR REPLACE FUNCTION public.profiles_guard_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.role := 'employee';
  NEW.workspace_id := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_insert ON public.profiles;
CREATE TRIGGER profiles_guard_insert BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_insert();

-- ── 3. Role-aware RLS for all hr_* tables ────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  p RECORD;
  -- readable by everyone in the workspace (directory, calendars, team leave…)
  ws_read TEXT[] := ARRAY['hr_departments','hr_employees','hr_leave_types','hr_leave_policies','hr_leave_policy_rules',
    'hr_holidays','hr_shifts','hr_shift_assignments','hr_office_locations','hr_attendance','hr_attendance_breaks',
    'hr_attendance_monthly_closures','hr_leave_applications','hr_employee_leave_policy',
    'hr_announcements','hr_jobs','hr_review_cycles','hr_feedback'];
  -- readable by the employee the row belongs to, and HR
  own_read TEXT[] := ARRAY['hr_leave_balances','hr_leave_balance_history','hr_payslips','hr_employee_documents',
    'hr_employee_education','hr_employee_work_history','hr_attendance_corrections','hr_assets','hr_expense_claims',
    'hr_loans','hr_tickets','hr_goals','hr_reviews','hr_checklist_items','hr_exits'];
  -- HR only
  hr_read TEXT[] := ARRAY['hr_payroll_runs','hr_payroll_settings','hr_candidates','hr_audit_logs',
    'hr_biometric_devices','hr_biometric_sync_logs'];
BEGIN
  FOREACH t IN ARRAY ws_read || own_read || hr_read LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    IF t = ANY(ws_read) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id = public.hr_my_workspace())', t || '_read', t);
    ELSIF t = ANY(own_read) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id = public.hr_my_workspace() AND (public.hr_is_admin() OR employee_id = public.hr_my_employee_id()%s))',
        t || '_read', t, CASE WHEN t = 'hr_reviews' THEN ' OR reviewer_employee_id = public.hr_my_employee_id()' ELSE '' END);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id = public.hr_my_workspace() AND public.hr_is_admin())', t || '_read', t);
    END IF;

    -- Writes from the browser: HR/super_admin within their workspace only.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (workspace_id = public.hr_my_workspace() AND public.hr_is_admin())', t || '_hr_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (workspace_id = public.hr_my_workspace() AND public.hr_is_admin()) WITH CHECK (workspace_id = public.hr_my_workspace())', t || '_hr_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (workspace_id = public.hr_my_workspace() AND public.hr_is_admin())', t || '_hr_delete', t);
  END LOOP;
END $$;

-- ── 5. Personal fields ───────────────────────────────────────────────────────
ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS date_of_birth      DATE,
  ADD COLUMN IF NOT EXISTS gender             TEXT,
  ADD COLUMN IF NOT EXISTS phone              TEXT,
  ADD COLUMN IF NOT EXISTS personal_email     TEXT,
  ADD COLUMN IF NOT EXISTS blood_group        TEXT,
  ADD COLUMN IF NOT EXISTS marital_status     TEXT,
  ADD COLUMN IF NOT EXISTS current_address    TEXT,
  ADD COLUMN IF NOT EXISTS permanent_address  TEXT,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON public.hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_apps_dates ON public.hr_leave_applications(workspace_id, from_date, to_date);

-- ── 4. Hide sensitive hr_employees columns from browser roles ────────────────
-- Column grants: browser roles can read only these columns. Service role is unaffected.
-- NOTE: when adding a new non-sensitive column, add it to this GRANT as well.
REVOKE SELECT ON public.hr_employees FROM anon, authenticated;
GRANT SELECT (id, workspace_id, user_id, employee_code, department_id, designation, employment_type,
  reporting_manager_id, date_of_joining, date_of_exit, probation_end_date, work_location, status,
  created_at, updated_at, created_by, date_of_birth, gender, phone, blood_group, notice_period_days)
  ON public.hr_employees TO authenticated;
