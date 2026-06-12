# Payroll Workflow — VividCRM

## Entities Covered
Payroll Run · Payslip · Salary Structure · Salary Component · Deduction · Bonus · Tax Computation

---

## 1. Payroll Run Lifecycle

### State Machine

```
                    ┌──────────────┐
                    │    DRAFT     │  ← HR initiates for a pay period
                    └──────┬───────┘
                           │
                           │ HR submits for review
                           ▼
                    ┌──────────────┐
                    │ UNDER_REVIEW │  ← Inputs verified; adjustments made
                    └──────┬───────┘
                           │
                           │ HR approves
                           ▼
                    ┌──────────────┐
                    │   APPROVED   │  ← Payslips generated (BullMQ)
                    └──────┬───────┘
                           │
                           │ Payment confirmed
                           ▼
                    ┌──────────────┐
                    │  FINALISED   │  ← Immutable; payslips distributed
                    └──────┬───────┘
                           │
                           │ Payment bank transfer confirmed
                           ▼
                    ┌──────────────┐
                    │  DISBURSED   │  ← Payment sent; record closed
                    └──────────────┘

        [DRAFT] ──────────────────────────────────────────▶ [CANCELLED]
```

### States

| State | Description | Mutable? |
|---|---|---|
| `DRAFT` | Being computed; inputs can be adjusted | Yes — HR can edit |
| `UNDER_REVIEW` | HR reviewing computed figures | Yes — HR can correct inputs |
| `APPROVED` | Finalised by HR; payslips generated | No (SUPER_ADMIN override only) |
| `FINALISED` | Payment instructions prepared | No |
| `DISBURSED` | Salaries paid and confirmed | No |
| `CANCELLED` | Run aborted (only from DRAFT) | No |

### Transitions

| From | To | Trigger | Actor | Guard |
|---|---|---|---|---|
| — | `DRAFT` | HR initiates new payroll run | HR | No existing DRAFT or later for same period |
| `DRAFT` | `UNDER_REVIEW` | HR submits run for review | HR | All employees have a salary structure assigned |
| `DRAFT` | `CANCELLED` | HR cancels before review | HR | Cannot cancel if any payslips generated |
| `UNDER_REVIEW` | `DRAFT` | HR returns for input correction | HR | — |
| `UNDER_REVIEW` | `APPROVED` | HR approves final figures | HR | Self-approval check (HR actor's own salary must not have been modified in this run) |
| `APPROVED` | `FINALISED` | HR confirms payment instructions ready | HR / SUPER_ADMIN | Payslips must all be in `GENERATED` state |
| `FINALISED` | `DISBURSED` | Payment confirmation logged | HR / SUPER_ADMIN | — |

---

## 2. Payroll Computation Flow

```
[HR clicks "Run Payroll" for period: {Month} {Year}]
       │
       ▼
[Step 1 — Employee Selection]
  ├── All ACTIVE employees with assigned salary structures included automatically
  ├── TERMINATED employees in this period: included for final settlement calculation
  └── NEW employees (joined mid-month): included with pro-rated computation flag

[Step 2 — Inputs Aggregation]
  For each employee:
  ├── Salary Structure → fetch components (Basic, HRA, Allowances)
  ├── Attendance Data → fetch from attendance table for this period
  │     ├── Working days in period
  │     ├── Days PRESENT
  │     ├── Days ABSENT
  │     └── Days on LEAVE (by leave type)
  ├── Approved Leaves → fetch APPROVED leaves for this period
  ├── Loss of Pay days = ABSENT days (not covered by any approved leave)
  └── Overtime hours (if applicable)

[Step 3 — Gross Salary Computation]
  For each employee:
  ├── Monthly Gross = sum of all positive salary components
  ├── Pro-ration (if joining date is mid-month):
  │     ProratedGross = MonthlyGross × (WorkingDaysWorked / WorkingDaysInMonth)
  └── Overtime pay = OvertimeHours × OvertimeRate (if configured)

[Step 4 — Deductions Computation]
  For each employee:
  ├── Loss of Pay = (MonthlyGross / WorkingDaysInMonth) × AbsentDays
  ├── Provident Fund (PF) = 12% of Basic (if applicable)
  ├── Employee State Insurance (ESI) = 0.75% of Gross (if gross ≤ threshold)
  ├── Professional Tax = slab-based per state (configurable)
  ├── TDS (Tax Deducted at Source) = based on declared investment proofs + income slab
  ├── Advance salary deductions (if any advances were disbursed)
  └── Other custom deductions (loan, canteen, etc.)

[Step 5 — Net Salary]
  NetSalary = GrossSalary - TotalDeductions

[Step 6 — Payroll Run saved as DRAFT]
  All computed values stored per employee in payroll_line_items table
  HR can review and override individual line items with a reason
```

---

## 3. Payslip Lifecycle

### State Machine

```
┌────────────┐    ┌───────────┐    ┌────────────┐    ┌──────────────┐
│  PENDING   │───▶│ GENERATED │───▶│ DISTRIBUTED│───▶│  DOWNLOADED  │
└────────────┘    └───────────┘    └────────────┘    └──────────────┘
```

### States

| State | Description |
|---|---|
| `PENDING` | Payroll run APPROVED; payslip queued for generation |
| `GENERATED` | PDF created and stored in file storage; not yet sent to employee |
| `DISTRIBUTED` | Payslip notification sent to employee |
| `DOWNLOADED` | Employee has downloaded the payslip PDF at least once |

### Payslip Generation Flow

```
[Payroll Run → APPROVED]
       │
       ▼
[BullMQ job queued for each employee in the run]
  (Each payslip is generated as a separate job to prevent one failure blocking all)

[Per-employee job]
  ├── Fetch employee salary line items for this run
  ├── Fetch employee profile (name, designation, department, employee ID)
  ├── Render payslip using workspace's payslip template (HTML → PDF)
  ├── Apply workspace logo and branding
  ├── Upload PDF to file storage (R2 / S3)
  └── Create payslip record: status = GENERATED

[All payslips GENERATED → HR notified]
[HR triggers distribution]
  └── BullMQ job: send payslip notification to each employee
        ├── In-app notification with download link
        └── Email with payslip PDF attached (if email distribution enabled)

[Each payslip.status → DISTRIBUTED]
[Employee downloads PDF → payslip.status → DOWNLOADED]
```

---

## 4. Salary Structure Lifecycle

### States

| State | Description |
|---|---|
| `ACTIVE` | Currently applied to one or more employees |
| `DRAFT` | Being configured; not yet assigned to any employee |
| `SUPERSEDED` | A newer structure has replaced this one for all employees |
| `ARCHIVED` | No longer in use; retained for historical payroll reference |

### Salary Structure Assignment Flow

```
[HR creates a Salary Structure]
  ├── Name (e.g., "Junior Developer — Band 2")
  ├── Components:
  │     ├── Basic Salary: ₹30,000 (fixed)
  │     ├── HRA: 40% of Basic (formula-based)
  │     ├── Special Allowance: ₹5,000 (fixed)
  │     └── Transport Allowance: ₹1,600 (fixed)
  ├── Deductions:
  │     ├── PF: 12% of Basic
  │     ├── ESI: 0.75% of Gross (if applicable)
  │     └── Professional Tax: ₹200/month (state-specific slab)
  └── CTC = Gross + Employer PF + Employer ESI

[Structure saved as DRAFT]

[HR assigns structure to employee]
  ├── Select employee
  ├── Select structure
  ├── Set effective from date
  └── Confirmation: "This will apply from {date}"

[Employee.salaryStructureId updated]
[Previous structure retained as historical record]
[Payroll runs after effective date use new structure]
```

### Salary Revision Flow

```
[HR revises an employee's salary]
       │
       ▼
[HR creates a new Salary Structure (or clones and modifies existing)]
       │
       ▼
[Assign new structure to employee with future effective date]
       │
       ▼
[System flags: payroll runs after this date will use the new structure]
[Old structure retained for all past payroll runs (immutable history)]
[Employee notified of salary revision (configurable — HR may suppress notification)]
```

---

## 5. Bonus and One-Time Payment Flow

```
[HR adds a bonus to an employee in the current payroll run]
  ├── Bonus type: PERFORMANCE / FESTIVAL / REFERRAL / JOINING / RETENTION / OTHER
  ├── Amount (₹)
  ├── Taxable: Yes / No
  └── Reason (mandatory)

[Bonus added to employee's line items for this run]
[Included in gross salary computation for tax purposes if taxable]
[Appears as separate line on payslip]
```

---

## 6. Full and Final Settlement Flow (Exit Payroll)

```
[Employee status → TERMINATED (exit management initiated)]
       │
       ▼
[HR triggers Final Settlement computation]
  ├── Last working day confirmed
  ├── Notice period worked vs. shortfall (if any)
  │
  ├── Salary for days worked in final month:
  │     Pro-rated based on last working day
  │
  ├── Leave encashment:
  │     Encashable leave types × (Monthly Gross / 26) per day
  │
  ├── Gratuity computation (if applicable, 5+ years service):
  │     (Last Basic × 15 / 26) × Years of Service
  │
  ├── Notice period recovery (if employee left without serving notice):
  │     Monthly Gross × (NoticePeriodDays - DaysServed) / 26
  │
  ├── Outstanding dues deduction:
  │     Any salary advance, loan balance, or asset value
  │
  └── Net Final Settlement Amount

[HR reviews and approves FFS]
[FFS payslip generated (special template)]
[Normal payroll run for that month excludes this employee]
[Employee record status confirmed as TERMINATED after FFS disbursement]
```

---

## 7. Payroll Correction (Post-Approval)

If an error is found after a payroll run reaches `APPROVED`:

```
[SUPER_ADMIN unlocks the payroll run]
  ├── Reason required (mandatory, minimum 20 characters)
  ├── Audit log entry: PAYROLL_UNLOCK created
  └── Run status reverts: APPROVED → UNDER_REVIEW

[HR corrects the line item(s)]
  ├── Correction note required per changed line item
  └── All changes logged (before + after values)

[HR re-approves the run]
[Payslips regenerated for affected employees only]
[Re-generated payslips supersede previous versions]
[Employees notified of corrected payslip]
```

---

## 8. Payroll Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Payroll run initiated | SUPER_ADMIN | In-app |
| Payroll run ready for review | HR | In-app |
| Payroll approved | HR, SUPER_ADMIN | In-app |
| Payslips generated | HR | In-app |
| Payslip distributed to employee | Employee | In-app + email |
| Payroll disbursed | HR, SUPER_ADMIN | In-app |
| Payslip download by employee | Audit log only | — |
| Salary structure revised | Employee (optional, HR configures) | Email |
| Payroll correction (post-approval) | SUPER_ADMIN, HR | In-app + email |
| Final settlement computed | Employee (on TERMINATED status), HR | In-app + email |
