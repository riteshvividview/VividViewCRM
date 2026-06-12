# HRMS — Database Setup SQL

Run each block in order in the **Supabase SQL Editor**.
After all blocks succeed, run in `backend/`:
```bash
npx prisma db pull
npx prisma generate
npm run build
```

---

## Block 1 — hr_departments

```sql
CREATE TABLE IF NOT EXISTS public.hr_departments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  code                 TEXT,
  parent_department_id UUID        REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_departments_workspace ON public.hr_departments(workspace_id);
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_departments_isolation" ON public.hr_departments
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 2 — hr_employees

```sql
CREATE TABLE IF NOT EXISTS public.hr_employees (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code          TEXT        NOT NULL,
  department_id          UUID        REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  designation            TEXT        NOT NULL DEFAULT '',
  employment_type        TEXT        NOT NULL DEFAULT 'full_time',
  reporting_manager_id   UUID        REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  date_of_joining        DATE        NOT NULL,
  date_of_exit           DATE,
  probation_end_date     DATE,
  work_location          TEXT        DEFAULT 'office',
  status                 TEXT        NOT NULL DEFAULT 'active',
  salary_ctc             NUMERIC(12,2) DEFAULT 0,
  salary_basic           NUMERIC(12,2) DEFAULT 0,
  pan_number             TEXT,
  aadhaar_number         TEXT,
  uan_number             TEXT,
  bank_account_number    TEXT,
  bank_ifsc              TEXT,
  bank_name              TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_workspace ON public.hr_employees(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON public.hr_employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON public.hr_employees(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON public.hr_employees(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employees_isolation" ON public.hr_employees
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 3 — Add head_employee_id to departments

```sql
ALTER TABLE public.hr_departments
  ADD COLUMN IF NOT EXISTS head_employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL;
```

---

## Block 4 — hr_leave_types

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  code               TEXT        NOT NULL,
  days_per_year      NUMERIC(5,1) NOT NULL DEFAULT 0,
  carry_forward_limit NUMERIC(5,1) DEFAULT 0,
  is_paid            BOOLEAN     DEFAULT true,
  requires_approval  BOOLEAN     DEFAULT true,
  applicable_gender  TEXT        DEFAULT 'all',
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, code)
);

ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_types_isolation" ON public.hr_leave_types
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 5 — hr_leave_balances

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_balances (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID        NOT NULL,
  employee_id            UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id          UUID        NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year                   INTEGER     NOT NULL,
  total_days             NUMERIC(5,1) DEFAULT 0,
  used_days              NUMERIC(5,1) DEFAULT 0,
  pending_days           NUMERIC(5,1) DEFAULT 0,
  carried_forward_days   NUMERIC(5,1) DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_balances_isolation" ON public.hr_leave_balances
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 6 — hr_leave_applications

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id    UUID        NOT NULL REFERENCES public.hr_leave_types(id),
  from_date        DATE        NOT NULL,
  to_date          DATE        NOT NULL,
  days_count       NUMERIC(5,1) NOT NULL,
  is_half_day      BOOLEAN     DEFAULT false,
  half_day_date    DATE,
  reason           TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  approved_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_leaves_employee ON public.hr_leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_status ON public.hr_leave_applications(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_dates ON public.hr_leave_applications(from_date, to_date);

ALTER TABLE public.hr_leave_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_applications_isolation" ON public.hr_leave_applications
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 7 — hr_attendance

```sql
CREATE TABLE IF NOT EXISTS public.hr_attendance (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id             UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  date                    DATE        NOT NULL,
  check_in                TIMESTAMPTZ,
  check_out               TIMESTAMPTZ,
  work_minutes            INTEGER     DEFAULT 0,
  overtime_minutes        INTEGER     DEFAULT 0,
  status                  TEXT        NOT NULL DEFAULT 'absent',
  check_in_location       JSONB,
  check_out_location      JSONB,
  is_regularized          BOOLEAN     DEFAULT false,
  regularization_reason   TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON public.hr_attendance(workspace_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee ON public.hr_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_status ON public.hr_attendance(workspace_id, status);

ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_attendance_isolation" ON public.hr_attendance
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 8 — hr_payroll_runs

```sql
CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month             INTEGER     NOT NULL,
  year              INTEGER     NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'draft',
  total_gross       NUMERIC(14,2) DEFAULT 0,
  total_deductions  NUMERIC(14,2) DEFAULT 0,
  total_net         NUMERIC(14,2) DEFAULT 0,
  employee_count    INTEGER     DEFAULT 0,
  processed_at      TIMESTAMPTZ,
  approved_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, month, year)
);

ALTER TABLE public.hr_payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_payroll_runs_isolation" ON public.hr_payroll_runs
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 9 — hr_payslips

```sql
CREATE TABLE IF NOT EXISTS public.hr_payslips (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  payroll_run_id   UUID        NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  month            INTEGER     NOT NULL,
  year             INTEGER     NOT NULL,
  days_in_month    INTEGER     NOT NULL DEFAULT 30,
  days_worked      NUMERIC(5,1) DEFAULT 0,
  days_lop         NUMERIC(5,1) DEFAULT 0,
  basic_salary     NUMERIC(12,2) DEFAULT 0,
  hra              NUMERIC(12,2) DEFAULT 0,
  special_allowance NUMERIC(12,2) DEFAULT 0,
  other_earnings   NUMERIC(12,2) DEFAULT 0,
  gross_salary     NUMERIC(12,2) DEFAULT 0,
  pf_employee      NUMERIC(12,2) DEFAULT 0,
  pf_employer      NUMERIC(12,2) DEFAULT 0,
  esi_employee     NUMERIC(12,2) DEFAULT 0,
  professional_tax NUMERIC(12,2) DEFAULT 0,
  income_tax_tds   NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_salary       NUMERIC(12,2) DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'draft',
  pdf_key          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_hr_payslips_employee ON public.hr_payslips(employee_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_run ON public.hr_payslips(payroll_run_id);

ALTER TABLE public.hr_payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_payslips_isolation" ON public.hr_payslips
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## After All Blocks Succeed

```bash
cd backend
npx prisma db pull
npx prisma generate
npm run build
npm run start:dev
```

Then seed some leave types in Supabase table editor → `hr_leave_types`:

| name | code | days_per_year | is_paid |
|---|---|---|---|
| Casual Leave | CL | 12 | true |
| Sick Leave | SL | 12 | true |
| Privilege Leave | PL | 15 | true |
| Maternity Leave | ML | 180 | true |
| Paternity Leave | PAL | 15 | true |
