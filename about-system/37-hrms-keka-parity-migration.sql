-- 37 — HRMS Keka-parity tables (additive only; safe to re-run)
-- Payroll settings, assets, expenses, loans, announcements, helpdesk, performance,
-- recruitment, onboarding/offboarding checklists and exits.

CREATE TABLE IF NOT EXISTS public.hr_payroll_settings (
  workspace_id        UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  basic_percent       NUMERIC NOT NULL DEFAULT 50,     -- % of monthly CTC when salary_basic is not set
  hra_percent         NUMERIC NOT NULL DEFAULT 40,     -- % of basic
  pf_enabled          BOOLEAN NOT NULL DEFAULT true,
  pf_wage_cap         NUMERIC NOT NULL DEFAULT 15000,
  esi_enabled         BOOLEAN NOT NULL DEFAULT true,
  esi_gross_limit     NUMERIC NOT NULL DEFAULT 21000,
  pt_enabled          BOOLEAN NOT NULL DEFAULT true,
  pt_amount           NUMERIC NOT NULL DEFAULT 200,
  pt_threshold        NUMERIC NOT NULL DEFAULT 15000,
  tds_enabled         BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  asset_tag      TEXT,
  category       TEXT NOT NULL DEFAULT 'laptop',
  serial_number  TEXT,
  status         TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','repair','retired')),
  employee_id    UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  assigned_on    DATE,
  purchase_date  DATE,
  cost           NUMERIC,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_expense_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  category         TEXT NOT NULL DEFAULT 'travel',
  amount           NUMERIC NOT NULL CHECK (amount > 0),
  expense_date     DATE NOT NULL,
  description      TEXT,
  receipt_url      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  rejection_reason TEXT,
  decided_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  payroll_run_id   UUID REFERENCES public.hr_payroll_runs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_loans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  loan_type     TEXT NOT NULL DEFAULT 'loan' CHECK (loan_type IN ('loan','salary_advance')),
  amount        NUMERIC NOT NULL CHECK (amount > 0),
  emi_amount    NUMERIC NOT NULL DEFAULT 0,
  outstanding   NUMERIC NOT NULL DEFAULT 0,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','closed','rejected')),
  decided_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  pinned        BOOLEAN NOT NULL DEFAULT false,
  expires_on    DATE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'hr',
  subject       TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  goal_type     TEXT NOT NULL DEFAULT 'okr' CHECK (goal_type IN ('okr','kpi','development')),
  period        TEXT,
  due_date      DATE,
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status        TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('not_started','on_track','at_risk','behind','completed')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_review_cycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cycle_id              UUID REFERENCES public.hr_review_cycles(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  reviewer_employee_id  UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  review_type           TEXT NOT NULL DEFAULT 'manager' CHECK (review_type IN ('self','manager','peer')),
  rating                NUMERIC CHECK (rating BETWEEN 1 AND 5),
  strengths             TEXT,
  improvements          TEXT,
  comments              TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, -- author
  to_employee_id    UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL DEFAULT 'praise' CHECK (kind IN ('praise','feedback','one_on_one')),
  badge             TEXT,
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  department_id   UUID REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  location        TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  openings        INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','on_hold','closed')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_candidates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES public.hr_jobs(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  source        TEXT DEFAULT 'direct',
  resume_url    TEXT,
  stage         TEXT NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  expected_ctc  NUMERIC,
  offered_ctc   NUMERIC,
  interview_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'onboarding' CHECK (kind IN ('onboarding','offboarding')),
  title         TEXT NOT NULL,
  owner         TEXT NOT NULL DEFAULT 'hr' CHECK (owner IN ('hr','it','manager','employee','finance')),
  due_date      DATE,
  done          BOOLEAN NOT NULL DEFAULT false,
  done_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_exits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  exit_type             TEXT NOT NULL DEFAULT 'resignation' CHECK (exit_type IN ('resignation','termination','retirement','contract_end')),
  resignation_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  last_working_day      DATE,
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','completed','withdrawn')),
  fnf_amount            NUMERIC,
  fnf_status            TEXT NOT NULL DEFAULT 'pending' CHECK (fnf_status IN ('pending','settled')),
  exit_interview_notes  TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hr_assets_ws         ON public.hr_assets(workspace_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_expense_ws        ON public.hr_expense_claims(workspace_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_loans_ws          ON public.hr_loans(workspace_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_announcements_ws  ON public.hr_announcements(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_tickets_ws        ON public.hr_tickets(workspace_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_goals_ws          ON public.hr_goals(workspace_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_reviews_ws        ON public.hr_reviews(workspace_id, cycle_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_feedback_ws       ON public.hr_feedback(workspace_id, to_employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_jobs_ws           ON public.hr_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_ws     ON public.hr_candidates(workspace_id, job_id, stage);
CREATE INDEX IF NOT EXISTS idx_hr_checklist_ws      ON public.hr_checklist_items(workspace_id, employee_id, kind);
CREATE INDEX IF NOT EXISTS idx_hr_exits_ws          ON public.hr_exits(workspace_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_manager ON public.hr_employees(workspace_id, reporting_manager_id);

-- RLS: workspace isolation (same convention as other hr_* tables). Writes go through
-- the service-role API which enforces role permissions.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_payroll_settings','hr_assets','hr_expense_claims','hr_loans','hr_announcements',
    'hr_tickets','hr_goals','hr_review_cycles','hr_reviews','hr_feedback','hr_jobs','hr_candidates',
    'hr_checklist_items','hr_exits']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_isolation') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()))', t || '_isolation', t);
    END IF;
  END LOOP;
END $$;
