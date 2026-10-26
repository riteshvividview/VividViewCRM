-- 39 — Security hardening (functions, CRM, invoices) + comp-off + tax declarations (safe to re-run)

-- ── 1. Function exposure ─────────────────────────────────────────────────────
-- Trigger/admin-only functions must not be callable through the REST RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_privileged() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_insert() FROM PUBLIC, anon, authenticated;
-- RLS helpers are needed by signed-in users (policies run as the caller) but never by anon.
REVOKE EXECUTE ON FUNCTION public.hr_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hr_my_workspace() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hr_my_employee_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_is_admin(), public.hr_my_workspace(), public.hr_my_employee_id(), public.get_my_workspace_id() TO authenticated;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- ── 2. Module-aware RLS for CRM and invoices ─────────────────────────────────
-- Mirrors lib/rbac/modules.ts: role defaults + per-user profile_modules overrides.
CREATE OR REPLACE FUNCTION public.app_has_module(mod TEXT, default_roles TEXT[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT pm.granted FROM profile_modules pm WHERE pm.user_id = auth.uid() AND pm.module_id = mod LIMIT 1),
    (SELECT p.role = ANY(default_roles) FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.app_has_module(TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_has_module(TEXT, TEXT[]) TO authenticated;

DO $$
DECLARE
  t TEXT; p RECORD; cond TEXT;
  crm TEXT[] := ARRAY['leads','deals','contacts','campaigns','marketing_campaigns','email_templates','email_accounts','targets','territories'];
  fin TEXT[] := ARRAY['invoices','invoice_items','invoice_payments','inv_settings'];
BEGIN
  FOREACH t IN ARRAY crm || fin LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    cond := CASE WHEN t = ANY(fin)
      THEN 'public.app_has_module(''invoices'', ARRAY[''super_admin''])'
      ELSE '(public.app_has_module(''crm_leads'', ARRAY[''super_admin'',''team_lead'']) OR public.app_has_module(''crm_deals'', ARRAY[''super_admin'',''team_lead'']) OR public.app_has_module(''crm_contacts'', ARRAY[''super_admin'',''team_lead'']) OR public.app_has_module(''crm_campaigns'', ARRAY[''super_admin'',''team_lead'']) OR public.app_has_module(''crm_mailing'', ARRAY[''super_admin'']) OR public.app_has_module(''mgmt_teams'', ARRAY[''super_admin'']))'
    END;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (workspace_id = public.get_my_workspace_id() AND %s) WITH CHECK (workspace_id = public.get_my_workspace_id() AND %s)', t || '_module_access', t, cond, cond);
  END LOOP;
END $$;

-- ── 3. Comp-off requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_comp_offs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  worked_date   DATE NOT NULL,
  days          NUMERIC NOT NULL DEFAULT 1 CHECK (days IN (0.5, 1)),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, worked_date)
);

-- ── 4. Investment / tax declarations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_tax_declarations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  financial_year      TEXT NOT NULL,              -- e.g. '2026-27'
  regime              TEXT NOT NULL DEFAULT 'new' CHECK (regime IN ('new','old')),
  sec_80c             NUMERIC NOT NULL DEFAULT 0, -- capped at 1.5L
  sec_80d             NUMERIC NOT NULL DEFAULT 0, -- health insurance
  sec_80ccd_1b        NUMERIC NOT NULL DEFAULT 0, -- NPS, capped at 50k
  home_loan_interest  NUMERIC NOT NULL DEFAULT 0, -- 24(b), capped at 2L
  annual_rent_paid    NUMERIC NOT NULL DEFAULT 0, -- for HRA exemption
  metro_city          BOOLEAN NOT NULL DEFAULT false,
  other_deductions    NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected')),
  remarks             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_hr_comp_offs_ws ON public.hr_comp_offs(workspace_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_tax_decl_ws ON public.hr_tax_declarations(workspace_id, financial_year);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_comp_offs','hr_tax_declarations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (workspace_id = public.hr_my_workspace() AND (public.hr_is_admin() OR employee_id = public.hr_my_employee_id()))', t || '_read', t);
  END LOOP;
END $$;
