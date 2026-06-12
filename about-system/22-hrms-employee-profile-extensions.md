# HRMS — Employee Profile Extensions (Compliance, Education, Work History, Documents)

## 1. SQL Migration (run manually in Supabase SQL Editor)

Run each block in order. After all blocks succeed, **no Prisma regeneration is required** —
the new tables are accessed only via the Supabase client + RLS (same as
`hr_employee_leave_policy` / `hr_leave_balance_history`), never from `backend/`.

### Block 1 — Fix missing `emergency_contact_relation` column

#### Purpose
`app/dashboard/hrms/employees/new/page.tsx` collects an "Emergency Contact → Relation" field
and POSTs it to `/api/hrms/employees`, but `hr_employees` has no matching column, so the value
was always silently dropped.

#### Affected tables
- `public.hr_employees` (new column)

```sql
ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;
```

#### Indexes / Foreign keys
None.

#### RLS impact
None — covered by the existing `hr_employees_isolation` policy.

#### Rollback
```sql
ALTER TABLE public.hr_employees DROP COLUMN IF EXISTS emergency_contact_relation;
```

---

### Block 2 — `hr_employee_education`

#### Purpose
Stores each employee's education history (qualification, institution, field of study, years,
grade) for the new "Background" tab on the employee profile page.

#### Affected tables
- `public.hr_employee_education` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_employee_education (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  qualification  TEXT        NOT NULL,
  institution    TEXT        NOT NULL,
  field_of_study TEXT,
  start_year     INTEGER,
  end_year       INTEGER,
  grade          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_education_employee  ON public.hr_employee_education(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_education_workspace ON public.hr_employee_education(workspace_id);

ALTER TABLE public.hr_employee_education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employee_education_isolation" ON public.hr_employee_education
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Indexes
- `idx_hr_employee_education_employee` on `(employee_id)`
- `idx_hr_employee_education_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `employee_id -> hr_employees(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-scoped `FOR ALL` isolation policy — same convention as `hr_employees`.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_employee_education;
```

---

### Block 3 — `hr_employee_work_history`

#### Purpose
Stores each employee's prior work experience (company, designation, dates, responsibilities)
for the "Background" tab.

#### Affected tables
- `public.hr_employee_work_history` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_employee_work_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  company_name     TEXT        NOT NULL,
  designation      TEXT        NOT NULL,
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN     NOT NULL DEFAULT false,
  responsibilities TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_work_history_employee  ON public.hr_employee_work_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_work_history_workspace ON public.hr_employee_work_history(workspace_id);

ALTER TABLE public.hr_employee_work_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employee_work_history_isolation" ON public.hr_employee_work_history
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Indexes
- `idx_hr_employee_work_history_employee` on `(employee_id)`
- `idx_hr_employee_work_history_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `employee_id -> hr_employees(id)` ON DELETE CASCADE

#### RLS impact
New table, new workspace-scoped `FOR ALL` isolation policy.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_employee_work_history;
```

---

### Block 4 — `hr_employee_documents`

#### Purpose
Tracks metadata for ID proofs / documents uploaded to the new `hr-documents` storage bucket
(Block 5) — Aadhaar, PAN, passport, resume, offer letter, etc.

#### Affected tables
- `public.hr_employee_documents` (new table)

```sql
CREATE TABLE IF NOT EXISTS public.hr_employee_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id    UUID        NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  document_type  TEXT        NOT NULL,
  document_name  TEXT        NOT NULL,
  file_path      TEXT        NOT NULL,
  file_size      INTEGER,
  uploaded_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_employee  ON public.hr_employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_documents_workspace ON public.hr_employee_documents(workspace_id);

ALTER TABLE public.hr_employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_employee_documents_isolation" ON public.hr_employee_documents
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

#### Indexes
- `idx_hr_employee_documents_employee` on `(employee_id)`
- `idx_hr_employee_documents_workspace` on `(workspace_id)`

#### Foreign keys
- `workspace_id -> workspaces(id)` ON DELETE CASCADE
- `employee_id -> hr_employees(id)` ON DELETE CASCADE
- `uploaded_by -> auth.users(id)` ON DELETE SET NULL

#### RLS impact
New table, new workspace-scoped `FOR ALL` isolation policy. The `document_type` column is
free-form `TEXT` (no enum, matching the rest of the HR schema) — the UI offers a fixed list of
suggestions: Aadhaar Card, PAN Card, Passport, Resume/CV, Offer Letter, Education Certificate,
Experience Letter, Bank Proof, Other.

#### Rollback
```sql
DROP TABLE IF EXISTS public.hr_employee_documents;
```

---

### Block 5 — `hr-documents` storage bucket

#### Purpose
Private storage bucket for the files referenced by `hr_employee_documents`. Unlike the existing
`avatars` bucket (public, profile photos), this bucket holds sensitive PII (Aadhaar/PAN/bank
proofs) and must never be publicly readable.

#### Affected
- `storage.buckets` (new row: `hr-documents`)
- `storage.objects` (4 new RLS policies)

```sql
-- Bucket: private, 5MB limit, PDF + common image types only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents', 'hr-documents', false, 5242880,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Object path convention: {workspace_id}/{employee_id}/{timestamp}-{filename}
-- (storage.foldername(name))[1] = workspace_id, used to scope access.
-- An additional role check restricts access to super_admin/hr, beyond the
-- page-level RBAC gate on /dashboard/hrms/employees/[id].

CREATE POLICY "hr_documents_select" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('super_admin','hr')
  );

CREATE POLICY "hr_documents_insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('super_admin','hr')
  );

CREATE POLICY "hr_documents_update" ON storage.objects
  FOR UPDATE TO public
  USING (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('super_admin','hr')
  )
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('super_admin','hr')
  );

CREATE POLICY "hr_documents_delete" ON storage.objects
  FOR DELETE TO public
  USING (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('super_admin','hr')
  );
```

#### RLS impact
4 new policies on `storage.objects`, scoped to the `hr-documents` bucket only — no impact on
the existing `avatars` policies.

#### Rollback
```sql
DROP POLICY IF EXISTS "hr_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_delete" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'hr-documents';
```

---

## 2. Compliance fields exposed on the employee profile

`hr_employees` already had `pan_number`, `aadhaar_number`, `uan_number`, `bank_account_number`,
`bank_ifsc`, `bank_name`, `salary_ctc`, `salary_basic` columns, but no UI ever read or wrote most
of them.

### What changed
- `app/dashboard/hrms/employees/[id]/page.tsx`:
  - "Compensation & Compliance" card now also shows **PAN Number** (full), **Aadhaar Number**
    (masked to last 4 digits), and **Bank Account Number** (masked to last 4 digits).
  - "Emergency Contact" card now shows **Relation** (`emergency_contact_relation`).
  - The previously inert "Edit" button now opens an **"Edit Details"** dialog where HR can set
    Salary CTC, Salary Basic, PAN, Aadhaar, UAN, Bank Name, Bank IFSC, Bank Account Number, and
    Emergency Contact Name/Phone/Relation. Saves directly to `hr_employees` via the existing
    `hr_employees_isolation` RLS policy (no new API route, same pattern as the Delete button).
- `app/api/hrms/employees/route.ts`: now persists `emergency_contact_relation` on creation
  (Block 1 fix).

---

## 3. "Background" tab — Education & Work History

New component `components/hrms/employee-background-tab.tsx`, added as a tab on the employee
profile page. HR/super_admin can add, edit, and delete:
- **Education** entries (qualification, institution, field of study, start/end year, grade) —
  `hr_employee_education`
- **Work Experience** entries (company, designation, date range or "Present", responsibilities) —
  `hr_employee_work_history`

Both use direct Supabase client CRUD, covered by the new isolation policies from Blocks 2 & 3.

---

## 4. "Documents" tab — ID proofs & files

New component `components/hrms/employee-documents-tab.tsx`, added as a tab on the employee
profile page. HR/super_admin can:
- Upload a document (PDF/JPEG/PNG/WEBP, max 5MB) with a type and display name — stored in the
  `hr-documents` bucket at `{workspace_id}/{employee_id}/{timestamp}-{filename}`, recorded in
  `hr_employee_documents`.
- View/download via a short-lived signed URL (bucket is private).
- Delete a document (removes both the storage object and the metadata row).

---

## Files added/modified

**Added**
- `about-system/22-hrms-employee-profile-extensions.md` (this file)
- `components/hrms/employee-background-tab.tsx`
- `components/hrms/employee-documents-tab.tsx`

**Modified**
- `app/api/hrms/employees/route.ts` (persist `emergency_contact_relation`)
- `app/dashboard/hrms/employees/[id]/page.tsx` (compliance fields, Emergency Contact relation,
  "Edit Details" dialog, "Background" and "Documents" tabs)
