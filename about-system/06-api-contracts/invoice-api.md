# Invoice API — VividCRM

## Scope Rules

- `SUPER_ADMIN` — full access including edit-after-sent with override
- `ADMIN` — full lifecycle (create, approve, send, void); cannot edit sent invoices
- `HR`, `TEAM_LEAD`, `EMPLOYEE` — no access to any invoice endpoints

---

## Invoices

---

### POST `/api/v1/invoices`

Create a new invoice draft.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class CreateInvoiceDto {
  // Client
  @IsOptional()
  @IsUUID()
  contactId?: string

  @IsOptional()
  @IsUUID()
  companyId?: string

  // At least one of contactId or companyId must be provided
  // Client snapshot fields (auto-populated from Contact/Company; overridable)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clientName: string

  @IsOptional()
  @IsEmail()
  clientEmail?: string

  @IsOptional()
  @IsString()
  clientAddress?: string

  @IsOptional()
  @IsString()
  @MaxLength(15)
  clientGstin?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientState?: string

  // Links
  @IsOptional()
  @IsUUID()
  dealId?: string

  @IsOptional()
  @IsUUID()
  projectId?: string

  // Dates
  @IsISO8601()
  invoiceDate: string  // YYYY-MM-DD

  @IsISO8601()
  dueDate: string  // YYYY-MM-DD

  // Config
  @IsOptional()
  @IsEnum(['NET_15', 'NET_30', 'NET_45', 'NET_60', 'DUE_ON_RECEIPT', 'CUSTOM'])
  paymentTerms?: string

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string  // default: INR

  @IsOptional()
  @IsEnum(GstType)
  gstType?: GstType  // CGST_SGST | IGST | EXEMPT

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  paymentTermsText?: string

  // Line Items
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[]

  @IsOptional()
  @IsUUID()
  templateId?: string
}

class InvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string

  @IsNumber()
  @Min(0.001)
  quantity: number

  @IsNumber()
  @Min(0)
  unitPrice: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(28)
  gstRate?: number  // 0 | 5 | 12 | 18 | 28 — default 18

  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsnSacCode?: string

  @IsOptional()
  @IsBoolean()
  isTaxExempt?: boolean  // override gstRate to 0

  @IsOptional()
  @IsUUID()
  timeEntryId?: string  // import from approved time entry
}
```

**Response `201`:**
```json
{
  "id": "inv_abc",
  "invoiceNumber": "INV-2025-0042",
  "status": "DRAFT",
  "clientName": "StartupXYZ",
  "clientGstin": "27ABCDE1234F1Z5",
  "gstType": "IGST",
  "invoiceDate": "2025-06-30",
  "dueDate": "2025-07-30",
  "paymentTerms": "NET_30",
  "currency": "INR",
  "subtotal": 100000,
  "totalIgst": 18000,
  "totalTax": 18000,
  "grandTotal": 118000,
  "outstanding": 118000,
  "lineItems": [
    {
      "id": "li_1",
      "description": "Website Redesign — Phase 1",
      "quantity": 1,
      "unitPrice": 100000,
      "gstRate": 18,
      "hsnSacCode": "998314",
      "taxableAmount": 100000,
      "igstAmount": 18000,
      "lineTotal": 118000,
      "order": 0
    }
  ],
  "createdAt": "2025-06-30T10:00:00.000Z"
}
```

**Validation:**
- At least one of `contactId` / `companyId` required
- `dueDate` must be >= `invoiceDate`
- `lineItems` — minimum 1 item
- `timeEntryId` — entry must exist, be in `APPROVED` status, not yet billed
- GST computation: if `clientState == workspace.businessState` → CGST+SGST; else → IGST
- Invoice number auto-generated: `{prefix}-{year}-{sequentialNumber}` (prefix + seq from workspace config)

**Side Effects:**
- If `timeEntryId` provided: time entry flagged as `in-draft-invoice`; not yet locked
- `AuditLog`: action=`CREATE`

---

### GET `/api/v1/invoices`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | `InvoiceStatus` | Filter by status |
| `contactId` | string | Client contact filter |
| `companyId` | string | Client company filter |
| `dealId` | string | Linked deal |
| `projectId` | string | Linked project |
| `dueBefore` | date | Due date range end |
| `dueAfter` | date | Due date range start |
| `isOverdue` | boolean | Shortcut for overdue invoices |
| `isDisputed` | boolean | Disputed invoices |
| `minAmount` | number | Grand total min |
| `maxAmount` | number | Grand total max |
| `search` | string | Invoice number or client name |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "inv_abc",
      "invoiceNumber": "INV-2025-0042",
      "status": "SENT",
      "clientName": "StartupXYZ",
      "invoiceDate": "2025-06-30",
      "dueDate": "2025-07-30",
      "grandTotal": 118000,
      "totalPaid": 0,
      "outstanding": 118000,
      "currency": "INR",
      "isOverdue": false,
      "isDisputed": false,
      "sentAt": "2025-07-01T09:00:00.000Z"
    }
  ],
  "meta": { "total": 18, "page": 1, "limit": 25, "totalPages": 1 }
}
```

---

### GET `/api/v1/invoices/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Response `200`:** Full invoice with `lineItems[]`, `payments[]`, `creditNotes[]`, `contact`, `company`, `deal`, `project`.

```json
{
  "id": "inv_abc",
  "invoiceNumber": "INV-2025-0042",
  "status": "PARTIALLY_PAID",
  "contact": { "id": "c_1", "firstName": "Rahul", "lastName": "Mehta" },
  "company": { "id": "co_1", "name": "StartupXYZ" },
  "deal": { "id": "deal_xyz", "title": "Website Redesign" },
  "project": { "id": "proj_abc", "name": "Website Redesign" },
  "clientName": "StartupXYZ",
  "clientEmail": "billing@startupxyz.com",
  "clientGstin": "27ABCDE1234F1Z5",
  "clientState": "Maharashtra",
  "gstType": "IGST",
  "invoiceDate": "2025-06-30",
  "dueDate": "2025-07-30",
  "sentAt": "2025-07-01T09:00:00.000Z",
  "viewedAt": "2025-07-01T14:00:00.000Z",
  "paymentTerms": "NET_30",
  "currency": "INR",
  "subtotal": 100000,
  "totalIgst": 18000,
  "totalTax": 18000,
  "grandTotal": 118000,
  "totalPaid": 50000,
  "outstanding": 68000,
  "pdfUrl": "https://cdn.r2.dev/invoices/INV-2025-0042.pdf",
  "notes": "Thank you for your business.",
  "paymentTermsText": "Bank: HDFC | Account: 12345678 | IFSC: HDFC0001234",
  "lineItems": [...],
  "payments": [
    {
      "id": "pay_1",
      "amount": 50000,
      "paymentDate": "2025-07-10",
      "method": "BANK_TRANSFER",
      "reference": "UTR12345678",
      "recordedAt": "2025-07-10T15:00:00.000Z"
    }
  ],
  "creditNotes": [],
  "createdAt": "2025-06-30T10:00:00.000Z",
  "updatedAt": "2025-07-10T15:00:00.000Z"
}
```

---

### PATCH `/api/v1/invoices/:id`

Update a draft invoice.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Only allowed when `status = DRAFT`. Post-SENT edits require SUPER_ADMIN with reason.

**Request Body:**
```ts
class UpdateInvoiceDto {
  @IsOptional() @IsString() @MaxLength(200) clientName?: string
  @IsOptional() @IsEmail() clientEmail?: string
  @IsOptional() @IsString() clientAddress?: string
  @IsOptional() @IsString() @MaxLength(15) clientGstin?: string
  @IsOptional() @IsString() clientState?: string
  @IsOptional() @IsISO8601() invoiceDate?: string
  @IsOptional() @IsISO8601() dueDate?: string
  @IsOptional() @IsString() paymentTerms?: string
  @IsOptional() @IsEnum(GstType) gstType?: GstType
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsString() paymentTermsText?: string
  @IsOptional() @IsUUID() contactId?: string
  @IsOptional() @IsUUID() companyId?: string

  // Line items — full replacement of the array
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems?: InvoiceLineItemDto[]

  // SUPER_ADMIN only: post-sent edits
  @IsOptional()
  @IsString()
  @MinLength(20)
  overrideReason?: string
}
```

**Side Effects (post-sent edit by SUPER_ADMIN):**
- `AuditLog`: action=`UPDATE`, isSensitive=`true`, reason logged
- New PDF generated automatically

---

### DELETE `/api/v1/invoices/:id`

Hard-delete (DRAFT only) or soft-delete.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:**
- ADMIN: only when `status = DRAFT`
- SUPER_ADMIN: any status, with mandatory reason
- Cannot delete if any `Payment` records exist (use void instead)

---

### POST `/api/v1/invoices/:id/approve`

Move invoice from DRAFT to READY_TO_SEND. Triggers PDF generation.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Self-approval check — creator cannot approve their own invoice when multiple admins exist. Single-admin workspaces are exempt.

**Response `200`:**
```json
{
  "invoice": { "id": "inv_abc", "status": "READY_TO_SEND" },
  "pdfStatus": "GENERATING",
  "message": "Invoice approved. PDF is being generated."
}
```

**Side Effects:**
- BullMQ job: generate PDF (HTML → PDF via Puppeteer)
- Time entries linked to line items locked (`status → BILLED`)

---

### POST `/api/v1/invoices/:id/send`

Send invoice to client via email.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Status must be `READY_TO_SEND`. PDF must be in `GENERATED` state.

**Request Body:**
```ts
class SendInvoiceDto {
  @IsEmail()
  toEmail: string

  @IsOptional()
  @IsArray()
  @IsEmail(undefined, { each: true })
  ccEmails?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string  // optional personal note appended to email
}
```

**Response `200`:**
```json
{
  "invoice": { "id": "inv_abc", "status": "SENT", "sentAt": "2025-07-01T09:00:00.000Z" }
}
```

**Side Effects:**
- Email dispatched via Brevo (BullMQ job)
- Email contains: invoice PDF attachment + payment link (if configured)
- `sentAt` timestamp recorded

---

### POST `/api/v1/invoices/:id/void`

Void a sent or overdue invoice.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:**
- Cannot void a `PAID` invoice — only credit notes can be issued against paid invoices
- Cannot void a `DRAFT` invoice — use DELETE instead

**Request Body:**
```ts
class VoidInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  reason: string

  @IsOptional()
  @IsBoolean()
  issueCreditNote?: boolean  // default true

  @IsOptional()
  @IsEnum(['FULL', 'PARTIAL'])
  creditNoteType?: string  // default FULL

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditNoteAmount?: number  // required if creditNoteType = PARTIAL
}
```

**Response `200`:**
```json
{
  "invoice": { "id": "inv_abc", "status": "VOIDED", "voidedAt": "..." },
  "creditNote": {
    "id": "cn_1",
    "creditNoteNumber": "CN-INV-2025-0042",
    "amount": 118000,
    "status": "ISSUED"
  }
}
```

**Side Effects:**
- Time entries reverted from `BILLED` → `APPROVED`
- Credit note created (if `issueCreditNote: true`)
- Client notified (if `status` was `SENT` or later)

---

### GET `/api/v1/invoices/:id/pdf`

Download invoice PDF.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Response `200`:** Binary PDF stream. `Content-Type: application/pdf`. `Content-Disposition: attachment; filename="INV-2025-0042.pdf"`.

**Validation:** PDF must be generated (status >= `READY_TO_SEND`).

**Side Effects:** `AuditLog`: action=`EXPORT`, isSensitive=`true`.

---

### POST `/api/v1/invoices/:id/dispute`

Flag an invoice as disputed.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class DisputeInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  disputeNote: string
}
```

**Effect:** `isDisputed = true`. Overdue reminder emails suppressed while disputed.

---

### POST `/api/v1/invoices/:id/resolve-dispute`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:** None.

**Effect:** `isDisputed = false`. Overdue reminders resume.

---

## Invoice Line Items

---

### POST `/api/v1/invoices/:id/line-items`

Add a line item to a draft invoice.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Invoice must be in `DRAFT` status.

**Request Body:** `InvoiceLineItemDto` (same as in create invoice).

**Response `201`:** Updated invoice totals + new line item.

---

### PATCH `/api/v1/invoices/:id/line-items/:lineItemId`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Invoice must be in `DRAFT`.

**Request Body:** All fields optional (same shape as create, all `@IsOptional()`).

---

### DELETE `/api/v1/invoices/:id/line-items/:lineItemId`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Invoice must be in `DRAFT`. Must have at least 1 remaining line item.

**Side Effects:** If line item was linked to a `timeEntryId`, that entry is reverted from `in-draft-invoice` back to `APPROVED`.

---

### POST `/api/v1/invoices/:id/import-time-entries`

Bulk-import approved time entries from a project as line items.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Invoice must be in `DRAFT`.

**Request Body:**
```ts
class ImportTimeEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  timeEntryIds: string[]

  @IsOptional()
  @IsNumber()
  @Min(0)
  overrideBillableRate?: number  // apply uniform rate to all imported entries
}
```

**Response `200`:**
```json
{
  "importedCount": 12,
  "lineItemsCreated": 12,
  "totalHours": 96,
  "totalAmount": 240000,
  "skipped": []
}
```

**Validation:**
- All entries must be `APPROVED` and not yet `BILLED`
- All entries must belong to the workspace
- If invoice has a linked `projectId`, entries must belong to that project (warn if not)

---

## Payments

---

### POST `/api/v1/invoices/:id/payments`

Record a payment received against an invoice.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Invoice must be in `SENT`, `VIEWED`, `OVERDUE`, or `PARTIALLY_PAID` status.

**Request Body:**
```ts
class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number

  @IsISO8601()
  paymentDate: string  // YYYY-MM-DD

  @IsEnum(PaymentMethod)
  method: PaymentMethod

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string  // UTR / UPI ID / cheque number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
```

**Response `201`:**
```json
{
  "payment": {
    "id": "pay_2",
    "amount": 68000,
    "paymentDate": "2025-07-20",
    "method": "BANK_TRANSFER",
    "reference": "UTR98765432",
    "createdAt": "2025-07-20T11:00:00.000Z"
  },
  "invoice": {
    "id": "inv_abc",
    "status": "PAID",
    "totalPaid": 118000,
    "outstanding": 0,
    "paidAt": "2025-07-20T11:00:00.000Z"
  }
}
```

**Validation:**
- `amount` must not exceed `invoice.outstanding`
- `paymentDate` cannot be before `invoice.invoiceDate` or in the future

**Side Effects:**
- `invoice.totalPaid` incremented; `invoice.outstanding` decremented
- If `outstanding = 0` → `invoice.status = PAID`; else → `PARTIALLY_PAID`
- `AuditLog`: action=`UPDATE`

---

### GET `/api/v1/invoices/:id/payments`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "pay_1",
      "amount": 50000,
      "paymentDate": "2025-07-10",
      "method": "BANK_TRANSFER",
      "reference": "UTR12345678",
      "createdAt": "2025-07-10T15:00:00.000Z"
    }
  ],
  "summary": {
    "totalPaid": 118000,
    "outstanding": 0
  }
}
```

---

## Credit Notes

---

### GET `/api/v1/credit-notes`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `status`, `originalInvoiceId`, standard pagination.

---

### GET `/api/v1/credit-notes/:id`

---

### GET `/api/v1/credit-notes/:id/pdf`

**Permission:** `SUPER_ADMIN`, `ADMIN`

Returns credit note PDF (binary stream).

---

## Invoice Templates

---

### POST `/api/v1/invoice-templates`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class CreateInvoiceTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  paymentTerms?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateLineItemDto)
  lineItems?: TemplateLineItemDto[]
}

class TemplateLineItemDto {
  @IsString()
  @IsNotEmpty()
  description: string

  @IsNumber()
  @Min(0.001)
  quantity: number

  @IsNumber()
  @Min(0)
  unitPrice: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(28)
  gstRate?: number

  @IsOptional()
  @IsString()
  hsnSacCode?: string
}
```

---

### GET `/api/v1/invoice-templates`

**Permission:** `SUPER_ADMIN`, `ADMIN`

---

### GET `/api/v1/invoice-templates/:id`

---

### PATCH `/api/v1/invoice-templates/:id`

---

### DELETE `/api/v1/invoice-templates/:id`

---

## Revenue Reports

---

### GET `/api/v1/invoices/reports/revenue`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `year` | number | Year filter |
| `month` | number | Month filter (1-12) |
| `groupBy` | `month` \| `quarter` \| `client` | Aggregation level |
| `status` | InvoiceStatus[] | Include specific statuses |
| `contactId` | string | By client contact |
| `companyId` | string | By company |

**Response `200`:**
```json
{
  "period": { "year": 2025, "groupBy": "month" },
  "summary": {
    "totalInvoiced": 1800000,
    "totalCollected": 1400000,
    "totalOutstanding": 320000,
    "totalOverdue": 80000
  },
  "byPeriod": [
    { "period": "2025-01", "invoiced": 320000, "collected": 320000, "outstanding": 0 },
    { "period": "2025-02", "invoiced": 280000, "collected": 200000, "outstanding": 80000 }
  ]
}
```

---

### GET `/api/v1/invoices/reports/aging`

Accounts receivable aging report.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Response `200`:**
```json
{
  "data": [
    {
      "invoiceNumber": "INV-2025-0038",
      "clientName": "TechCorp Pvt Ltd",
      "invoiceDate": "2025-05-01",
      "dueDate": "2025-05-31",
      "outstanding": 75000,
      "daysPastDue": 26,
      "bucket": "21-30_DAYS"
    }
  ],
  "summary": {
    "current": 320000,
    "oneToThirty": 150000,
    "thirtyOneToSixty": 75000,
    "sixtyOnePlus": 30000,
    "total": 575000
  }
}
```

---

### GET `/api/v1/invoices/reports/gst-summary`

GST liability summary for a period (for filing returns).

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `month`, `year`

**Response `200`:**
```json
{
  "period": "2025-06",
  "totalTaxableAmount": 1000000,
  "totalCgst": 0,
  "totalSgst": 0,
  "totalIgst": 180000,
  "totalTaxCollected": 180000,
  "breakdown": [
    { "gstRate": 18, "taxableAmount": 1000000, "igst": 180000 }
  ]
}
```
