# Invoice Workflow — VividCRM

## Entities Covered
Invoice · Line Item · Payment · Credit Note · Invoice Template

---

## 1. Invoice Lifecycle

### State Machine

```
                    ┌──────────────┐
                    │    DRAFT     │  ← Created (manual, from Deal, from time entries)
                    └──────┬───────┘
                           │
                           │ ADMIN finalises
                           ▼
                    ┌──────────────┐
                    │READY_TO_SEND │  ← Approved; PDF generated
                    └──────┬───────┘
                           │
                           │ ADMIN sends to client
                           ▼
                    ┌──────────────┐
                    │     SENT     │  ← Client notified via email
                    └──────┬───────┘
                           │
              ┌────────────┼──────────────────┐
              │            │                  │
              ▼            ▼                  ▼
      ┌──────────┐  ┌────────────┐    ┌────────────┐
      │  VIEWED  │  │  OVERDUE   │    │   VOIDED   │
      └────┬─────┘  └─────┬──────┘    └────────────┘
           │              │
      ┌────┴──────┐  ┌────┴──────┐
      │           │  │           │
      ▼           ▼  ▼           ▼
┌───────────┐ ┌──────────┐ ┌──────────┐
│PARTIALLY  │ │   PAID   │ │  VOIDED  │
│   PAID    │ │          │ │          │
└─────┬─────┘ └──────────┘ └──────────┘
      │
      ▼
  ┌──────┐
  │ PAID │  (when balance = 0)
  └──────┘
```

### States

| State | Description | Editable? |
|---|---|---|
| `DRAFT` | Being composed; not yet approved | Yes — ADMIN |
| `READY_TO_SEND` | Approved; PDF ready; not yet sent | No (only metadata editable) |
| `SENT` | Emailed to client; awaiting payment | No |
| `VIEWED` | Client opened the invoice link | No |
| `OVERDUE` | Payment due date has passed; unpaid | No |
| `PARTIALLY_PAID` | Partial payment received | No |
| `PAID` | Full payment received | No (terminal) |
| `VOIDED` | Cancelled; superseded by credit note | No (terminal) |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `DRAFT` | Invoice created | ADMIN / SUPER_ADMIN | Invoice number assigned; line items editable |
| `DRAFT` | `READY_TO_SEND` | ADMIN approves and finalises | ADMIN | Self-approval check; PDF generation job queued |
| `DRAFT` | `DRAFT` | ADMIN edits | ADMIN | Any field editable; number not regenerated |
| `DRAFT` | (deleted) | ADMIN deletes | ADMIN | Soft-delete; linked time entries reverted to APPROVED |
| `READY_TO_SEND` | `SENT` | ADMIN sends invoice | ADMIN | Email sent to client contact; sent timestamp recorded |
| `READY_TO_SEND` | `DRAFT` | ADMIN recalls for edits | ADMIN | PDF invalidated; re-approval required |
| `SENT` | `VIEWED` | Client opens invoice link | System (email pixel / link click) | Viewed timestamp recorded; ADMIN notified |
| `SENT` | `OVERDUE` | Due date passes with no payment | System (BullMQ cron) | Overdue notification sent to client + ADMIN |
| `VIEWED` | `OVERDUE` | Due date passes with no payment | System | Same as above |
| `SENT` / `VIEWED` / `OVERDUE` | `PARTIALLY_PAID` | Partial payment logged | ADMIN | Outstanding balance updated |
| `SENT` / `VIEWED` / `OVERDUE` / `PARTIALLY_PAID` | `PAID` | Full payment logged | ADMIN | See Payment Flow; time entries marked BILLED |
| `SENT` / `VIEWED` / `OVERDUE` / `PARTIALLY_PAID` | `VOIDED` | ADMIN voids invoice | ADMIN | Reason required; credit note created; linked time entries reverted |
| `OVERDUE` | `PAID` | Late payment logged | ADMIN | Late payment flag recorded; ADMIN can note penalty/waiver |

---

## 2. Invoice Creation Flow

### Manual Creation

```
[ADMIN clicks "New Invoice"]
       │
       ▼
[Invoice Composer]
  Step 1 — Client
    ├── Select client: Contact or Company (from CRM)
    ├── Billing address (auto-filled from CRM; editable)
    └── GSTIN of client (for GST computation)

  Step 2 — Details
    ├── Invoice number (auto-generated, format: INV-YYYY-NNNN, editable)
    ├── Invoice date (default: today)
    ├── Due date (default: today + payment terms days, configurable)
    ├── Currency (default: INR)
    ├── Payment terms (NET_15 / NET_30 / NET_45 / NET_60 / DUE_ON_RECEIPT / CUSTOM)
    └── Linked project (optional — for reference and time entry import)

  Step 3 — Line Items
    ├── Manual line item: Description, Qty, Unit Price, Tax Rate
    └── Import from time entries (if project linked):
          ├── Shows all APPROVED time entries not yet billed
          ├── Each entry: Task name, Employee, Hours, Rate
          └── Selected entries → line items added

  Step 4 — Tax (GST)
    ├── Auto-detect: Is client in same state as business?
    │     Yes → CGST + SGST (split equally at configured rate)
    │     No  → IGST (single rate)
    ├── HSN / SAC code per line item (configurable)
    ├── Tax exemption flag (for export invoices, SEZ clients)
    └── Tax total computed and displayed

  Step 5 — Notes and Terms
    ├── Invoice notes (visible on PDF, e.g., "Thank you for your business")
    └── Payment terms text (bank details, UPI, payment link)

[Invoice saved as DRAFT]
```

### Creation from Deal Win

```
[Deal.status → WON with "Create Invoice" flag]
       │
       ▼
[Invoice draft auto-created]
  ├── Client: Deal.contactId or Deal.companyId
  ├── Invoice title: Deal.title
  ├── Line item: Deal.value as a single line item (editable)
  └── Due date: Deal.closeDate + default payment terms

[ADMIN reviews and edits before approving]
```

---

## 3. GST Computation Flow

```
[Line items finalised]
       │
       ▼
[For each line item]
  ├── Taxable amount = Qty × Unit Price
  ├── Tax rate = line item's assigned GST rate (0%, 5%, 12%, 18%, 28%)
  └── Is client in same state as workspace?

[Same state (intra-state)]
  CGST = Taxable Amount × (Tax Rate / 2)
  SGST = Taxable Amount × (Tax Rate / 2)
  Total Tax = CGST + SGST

[Different state (inter-state) or international]
  IGST = Taxable Amount × Tax Rate
  Total Tax = IGST

[Invoice totals]
  Subtotal = sum of all line item taxable amounts
  Total Tax = sum of all line item taxes (CGST + SGST or IGST)
  Grand Total = Subtotal + Total Tax
  Amount in words = Grand Total converted to Indian rupees in words (for PDF)
```

---

## 4. PDF Generation Flow

```
[Invoice.status → READY_TO_SEND]
       │
       ▼
[BullMQ job queued: GENERATE_INVOICE_PDF]
       │
       ▼
[Job execution]
  ├── Fetch invoice record with all line items, client details, workspace details
  ├── Fetch workspace logo from file storage
  ├── Select invoice template (default or custom)
  ├── Render HTML template with invoice data
  ├── Convert HTML → PDF (Puppeteer or similar)
  ├── Upload PDF to file storage (R2 / S3)
  │     Path: /invoices/{workspaceId}/{invoiceNumber}.pdf
  ├── Store PDF URL on invoice record
  └── Update payslip status: GENERATED

[ADMIN notified: "Invoice PDF ready"]
[ADMIN can preview PDF before sending]
```

---

## 5. Payment Tracking Flow

### Logging a Payment

```
[ADMIN logs a payment received]
  ├── Payment date
  ├── Amount received
  ├── Payment method: BANK_TRANSFER / UPI / CHEQUE / CASH / ONLINE_GATEWAY / OTHER
  ├── Reference number (bank UTR, UPI transaction ID, cheque number)
  └── Notes (optional)

[System computes]
  TotalPaid += payment.amount
  Outstanding = Invoice.grandTotal - TotalPaid

[If Outstanding > 0]
  Invoice.status → PARTIALLY_PAID

[If Outstanding = 0]
  Invoice.status → PAID
  Linked time entries → BILLED (if not already)
  Revenue report updated

[Payment record saved — immutable]
[Client payment receipt email sent (configurable)]
```

### Payment Dispute Handling

```
[Client disputes an invoice]
  ├── ADMIN records dispute note on invoice
  ├── Invoice flagged: isDisputed = true
  │     (does not change status; overdue reminders suppressed while disputed)
  └── Resolution options:
        ├── Issue credit note (partial or full) → ADMIN creates Credit Note
        ├── Adjust line items (only via VOID + new invoice)
        └── Accept dispute and mark as PAID at reduced amount with note
```

---

## 6. Credit Note Workflow

```
[ADMIN voids an invoice (partial or full)]
       │
       ▼
[Void reason required]
[Invoice.status → VOIDED]
       │
       ▼
[System auto-creates a Credit Note]
  ├── Credit Note number: CN-{original invoice number}
  ├── Type: FULL (entire invoice voided) / PARTIAL (partial credit)
  ├── Amount: full or partial credit amount
  ├── Linked invoice: original invoice ID
  └── Status: ISSUED

[Linked time entries reverted: BILLED → APPROVED (eligible for new invoice)]
[Credit Note PDF generated]
[Client notified of credit note (if send-to-client is enabled)]
```

### Credit Note States

| State | Description |
|---|---|
| `ISSUED` | Credit note created and sent to client |
| `APPLIED` | Credit note applied to a subsequent invoice |
| `EXPIRED` | Credit note not used within its validity period |

---

## 7. Overdue Handling Flow

```
[BullMQ cron job runs daily at 9:00 AM]
  For each SENT, VIEWED, or PARTIALLY_PAID invoice:
    ├── Is today > invoice.dueDate?
    │     No  → skip
    │     Yes → check reminders sent

    ├── DaysPastDue = today - invoice.dueDate
    │
    ├── DaysPastDue = 1:
    │     Invoice.status → OVERDUE
    │     Send overdue reminder #1 to client + ADMIN
    │
    ├── DaysPastDue = 7:
    │     Send overdue reminder #2 to client + ADMIN
    │
    ├── DaysPastDue = 15:
    │     Send overdue reminder #3 to client + ADMIN (escalation tone)
    │
    └── DaysPastDue = 30:
          Escalation notification to ADMIN ("Invoice 30 days overdue — action required")
          No automatic further emails (ADMIN takes over)
```

---

## 8. Invoice Template Workflow

```
[ADMIN creates an Invoice Template]
  ├── Template name (e.g., "Monthly Retainer", "Project Milestone")
  ├── Default line items (e.g., "Retainer Fee — ₹50,000/month")
  ├── Default payment terms
  ├── Default notes text
  └── Default tax configuration

[Template saved]

[On new invoice creation]
  ├── ADMIN selects template
  └── All defaults pre-filled; fully editable before approval
```

---

## 9. Invoice Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Invoice created (DRAFT) | ADMIN (creator) | In-app |
| Invoice approved (READY_TO_SEND) | ADMIN | In-app |
| PDF generated | ADMIN | In-app |
| Invoice sent to client | ADMIN, client (email) | In-app + email |
| Invoice viewed by client | ADMIN | In-app |
| Invoice overdue (day 1) | ADMIN, client | In-app + email |
| Overdue reminders (day 7, 15) | ADMIN, client | Email |
| Payment received (full) | ADMIN | In-app + email |
| Payment received (partial) | ADMIN | In-app |
| Invoice voided | ADMIN, SUPER_ADMIN | In-app |
| Credit note issued | ADMIN, client (if configured) | In-app + email |
| Invoice 30 days overdue (escalation) | ADMIN, SUPER_ADMIN | In-app + email |
