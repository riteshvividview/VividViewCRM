# Invoice Generator — Database Setup SQL

Run each block in the **Supabase SQL Editor** in order.

---

## Block 1 — inv_settings (business profile per workspace)

```sql
CREATE TABLE IF NOT EXISTS public.inv_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID        UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_name         TEXT        NOT NULL DEFAULT '',
  gst_number            TEXT        DEFAULT '',
  pan_number            TEXT        DEFAULT '',
  address               TEXT        DEFAULT '',
  city                  TEXT        DEFAULT '',
  state                 TEXT        DEFAULT '',
  pincode               TEXT        DEFAULT '',
  phone                 TEXT        DEFAULT '',
  email                 TEXT        DEFAULT '',
  bank_name             TEXT        DEFAULT '',
  bank_account          TEXT        DEFAULT '',
  bank_ifsc             TEXT        DEFAULT '',
  bank_branch           TEXT        DEFAULT '',
  logo_url              TEXT,
  signature_url         TEXT,
  invoice_prefix        TEXT        NOT NULL DEFAULT 'INV',
  next_invoice_number   INTEGER     NOT NULL DEFAULT 1,
  default_payment_days  INTEGER     NOT NULL DEFAULT 30,
  default_notes         TEXT        DEFAULT '',
  default_terms         TEXT        DEFAULT '',
  tax_type              TEXT        NOT NULL DEFAULT 'cgst_sgst',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inv_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_settings_isolation" ON public.inv_settings
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 2 — invoices

```sql
CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_number    TEXT        NOT NULL,
  contact_id        UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  client_name       TEXT        NOT NULL DEFAULT '',
  client_email      TEXT        DEFAULT '',
  client_phone      TEXT        DEFAULT '',
  client_address    TEXT        DEFAULT '',
  client_city       TEXT        DEFAULT '',
  client_state      TEXT        DEFAULT '',
  client_pincode    TEXT        DEFAULT '',
  client_gstin      TEXT        DEFAULT '',
  issue_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  status            TEXT        NOT NULL DEFAULT 'draft',
  currency          TEXT        NOT NULL DEFAULT 'INR',
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_type     TEXT        DEFAULT 'none',
  discount_value    NUMERIC(10,2) DEFAULT 0,
  discount_amount   NUMERIC(14,2) DEFAULT 0,
  cgst_amount       NUMERIC(14,2) DEFAULT 0,
  sgst_amount       NUMERIC(14,2) DEFAULT 0,
  igst_amount       NUMERIC(14,2) DEFAULT 0,
  tax_amount        NUMERIC(14,2) DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(14,2) DEFAULT 0,
  amount_due        NUMERIC(14,2) DEFAULT 0,
  notes             TEXT        DEFAULT '',
  terms             TEXT        DEFAULT '',
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON public.invoices(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(workspace_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(workspace_id, invoice_number);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_isolation" ON public.invoices
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 3 — invoice_items

```sql
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id UUID        NOT NULL,
  description  TEXT        NOT NULL,
  hsn_sac      TEXT        DEFAULT '',
  quantity     NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit         TEXT        DEFAULT 'Nos',
  unit_price   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate     NUMERIC(5,2) DEFAULT 18,
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(14,2) DEFAULT 0,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  position     INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items_isolation" ON public.invoice_items
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## Block 4 — invoice_payments

```sql
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  workspace_id     UUID        NOT NULL,
  amount           NUMERIC(14,2) NOT NULL,
  payment_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT        NOT NULL DEFAULT 'bank_transfer',
  reference_number TEXT        DEFAULT '',
  notes            TEXT        DEFAULT '',
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_payments_isolation" ON public.invoice_payments
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()));
```

---

## After All Blocks Succeed

```bash
cd backend
npx prisma db pull
npx prisma generate
npm run build
```
