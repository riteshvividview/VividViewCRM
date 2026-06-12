# Leave Management — Full Implementation

## Status: Implemented (2026-06-05)

---

## Gap Analysis Summary

### What was missing vs Keka HR:

| Feature | Status |
|---|---|
| Employee self-service leave portal | ❌ → ✅ Implemented |
| Leave balance visibility (per type) | ❌ → ✅ Implemented |
| Apply Leave form with all required fields | ❌ → ✅ Implemented |
| Half-day leave (first/second half) | ❌ → ✅ Implemented |
| Team availability preview during application | ❌ → ✅ Implemented |
| Rejection dialog with reason | ❌ → ✅ Implemented |
| Leave Policy management (HR) | ❌ → ✅ Implemented |
| Leave Policy Rules per leave type | ❌ → ✅ Implemented |
| Enhanced Leave Type config | ❌ → ✅ Implemented |
| Role-aware leave page | ❌ → ✅ Implemented |
| HR approval with L1/L2 status | ❌ → ✅ Implemented |
| Cancel approved leave (HR) | ❌ → ✅ Implemented |
| No Internet Connection screen | ❌ → ✅ Implemented |

---

## New Files Created

- `components/shared/offline-screen.tsx`
- `app/dashboard/hrms/leaves/apply/page.tsx`
- `app/dashboard/hrms/leaves/policies/page.tsx`
- `app/dashboard/hrms/leaves/types/page.tsx`

## Modified Files

- `components/layout/shell.tsx` — added OfflineScreen
- `app/dashboard/hrms/leaves/page.tsx` — complete rewrite (role-aware)

---

## SQL Migrations Required

Run these blocks in the Supabase SQL Editor **in order**.

---

### Block A — Extend hr_leave_types

```sql
ALTER TABLE public.hr_leave_types
  ADD COLUMN IF NOT EXISTS accrual_type             TEXT    NOT NULL DEFAULT 'annual_upfront',
  ADD COLUMN IF NOT EXISTS encashable                BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_advance_notice_days   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_consecutive_days      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_levels           TEXT    NOT NULL DEFAULT 'l1_only',
  ADD COLUMN IF NOT EXISTS sandwich_rule             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekends_counted          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS holidays_counted          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_negative_balance    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.hr_leave_types.accrual_type IS 'annual_upfront | monthly_accrual';
COMMENT ON COLUMN public.hr_leave_types.approval_levels IS 'none | l1_only | l1_and_l2 | l2_only';
```

---

### Block B — Extend hr_leave_applications

```sql
ALTER TABLE public.hr_leave_applications
  ADD COLUMN IF NOT EXISTS half_day_session      TEXT,
  ADD COLUMN IF NOT EXISTS notify_team_members   BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_url          TEXT,
  ADD COLUMN IF NOT EXISTS approver_l1_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approver_l2_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approver_l1_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approver_l2_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS l1_rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS l2_rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason         TEXT;

COMMENT ON COLUMN public.hr_leave_applications.half_day_session IS 'first_half | second_half';
COMMENT ON COLUMN public.hr_leave_applications.status IS 'pending_l1 | pending_l2 | approved | rejected | cancelled | withdrawn';
```

---

### Block C — hr_leave_policies

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_policies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  description         TEXT,
  policy_year_start   TEXT        NOT NULL DEFAULT '01-01',
  is_active           BOOLEAN     DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_policies_workspace ON public.hr_leave_policies(workspace_id);

ALTER TABLE public.hr_leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_policies_isolation" ON public.hr_leave_policies
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

### Block D — hr_leave_policy_rules

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_policy_rules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        NOT NULL,
  policy_id             UUID        NOT NULL REFERENCES public.hr_leave_policies(id) ON DELETE CASCADE,
  leave_type_id         UUID        NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  annual_quota          NUMERIC(5,1) NOT NULL DEFAULT 0,
  monthly_accrual       NUMERIC(5,2) DEFAULT 0,
  carry_forward_limit   NUMERIC(5,1) DEFAULT 0,
  encashment_allowed    BOOLEAN     DEFAULT false,
  approval_required     BOOLEAN     DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(policy_id, leave_type_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_policy_rules_policy ON public.hr_leave_policy_rules(policy_id);

ALTER TABLE public.hr_leave_policy_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_policy_rules_isolation" ON public.hr_leave_policy_rules
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

### Block E — hr_employee_leave_policy

```sql
CREATE TABLE IF NOT EXISTS public.hr_employee_leave_policy (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  employee_id     UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  policy_id       UUID        NOT NULL REFERENCES public.hr_leave_policies(id) ON DELETE CASCADE,
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, policy_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_hr_emp_policy_employee ON public.hr_employee_leave_policy(employee_id);

ALTER TABLE public.hr_employee_leave_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employee_leave_policy_isolation" ON public.hr_employee_leave_policy
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

### Block F — hr_leave_balance_history

```sql
CREATE TABLE IF NOT EXISTS public.hr_leave_balance_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL,
  employee_id     UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id   UUID        NOT NULL REFERENCES public.hr_leave_types(id),
  year            INTEGER     NOT NULL,
  change_days     NUMERIC(5,1) NOT NULL,
  change_type     TEXT        NOT NULL,
  reference_id    UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON COLUMN public.hr_leave_balance_history.change_type IS 'allocation | used | carry_forward | encashment | correction | lapse | reversal';

CREATE INDEX IF NOT EXISTS idx_hr_balance_history_employee ON public.hr_leave_balance_history(employee_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_hr_balance_history_type ON public.hr_leave_balance_history(leave_type_id);

ALTER TABLE public.hr_leave_balance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_balance_history_isolation" ON public.hr_leave_balance_history
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## After Running All SQL Blocks

Seed default leave types for testing:

```sql
-- Replace 'YOUR_WORKSPACE_ID' with your actual workspace UUID
INSERT INTO public.hr_leave_types (workspace_id, name, code, days_per_year, carry_forward_limit, is_paid, requires_approval, applicable_gender, approval_levels)
VALUES
  ('YOUR_WORKSPACE_ID', 'Casual Leave',      'CL',  12,  0, true,  true,  'all',         'l1_only'),
  ('YOUR_WORKSPACE_ID', 'Sick Leave',        'SL',  12,  0, true,  true,  'all',         'l1_only'),
  ('YOUR_WORKSPACE_ID', 'Paid Leave',        'PL',  15, 10, true,  true,  'all',         'l1_and_l2'),
  ('YOUR_WORKSPACE_ID', 'Unpaid Leave',      'UL',   0,  0, false, true,  'all',         'l1_and_l2'),
  ('YOUR_WORKSPACE_ID', 'Comp Off',          'CO',   0,  5, true,  false, 'all',         'none'),
  ('YOUR_WORKSPACE_ID', 'Floater Leave',     'FL',   2,  0, true,  true,  'all',         'l1_only'),
  ('YOUR_WORKSPACE_ID', 'Maternity Leave',   'ML',  180, 0, true,  true,  'female_only', 'l2_only'),
  ('YOUR_WORKSPACE_ID', 'Paternity Leave',   'PAL', 15,  0, true,  true,  'male_only',   'l2_only'),
  ('YOUR_WORKSPACE_ID', 'Bereavement Leave', 'BL',   3,  0, true,  true,  'all',         'l2_only'),
  ('YOUR_WORKSPACE_ID', 'Work From Home',    'WFH',  0,  0, true,  true,  'all',         'l1_only')
ON CONFLICT (workspace_id, code) DO NOTHING;
```

---

## Architecture Notes

### Role-based leave page behavior:
- `super_admin` / `hr`: See all pending approvals, all history, HR management links (Types, Policies)
- `team_lead`: See their direct reports' pending leaves + their own leaves
- `employee`: See only their own leaves + balance cards

### Status values (extended):
- `pending_l1` — Awaiting Team Lead approval (L1)
- `pending_l2` — Awaiting HR approval (L2)  
- `approved` — Fully approved
- `rejected` — Declined
- `cancelled` — Approved leave cancelled by HR
- `withdrawn` — Withdrawn by employee before action

### Balance allocation (Auto — Phase 2 complete):
HR assigns a policy from the Employee Profile → Leave Policy tab. On save:
1. All existing `hr_employee_leave_policy` records for that employee are deactivated
2. A new assignment record is inserted (`is_active = true`)
3. For each rule in the policy, `hr_leave_balances` is upserted:
   - New employees: record inserted with `used_days=0, pending_days=0`
   - Existing employees: only `total_days` updated, `used_days`/`pending_days` preserved
4. A `hr_leave_balance_history` record is inserted (change_type = "allocation")

### RBAC enforcement:
- `/dashboard/hrms/leaves/policies` — client-side `router.replace("/dashboard/access-denied")` for non-HR roles
- `/dashboard/hrms/leaves/types` — same redirect guard
- `HRGuard` component at `components/hrms/hr-guard.tsx` — wrappable guard using redirect
- Employee profile → Leave Policy tab: all roles see balances; only HR sees assignment controls

---

## Phase 2 Files Added (2026-06-05)

- `components/hrms/hr-guard.tsx` — router.replace-based HR access guard
- `components/hrms/employee-leave-policy-tab.tsx` — policy assignment + auto-allocation UI

## Phase 2 Files Modified (2026-06-05)

- `app/dashboard/hrms/employees/[id]/page.tsx` — added Leave Policy tab + viewer role detection
- `app/dashboard/hrms/leaves/policies/page.tsx` — replaced toast.error with router.replace redirect
- `app/dashboard/hrms/leaves/types/page.tsx` — replaced toast.error with router.replace redirect
