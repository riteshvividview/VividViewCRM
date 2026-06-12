# Phase 3 — HRMS + Invoice System

## Phase Summary

| Attribute | Value |
|---|---|
| **Phase** | 3 of 6 (covers product Phases 4 and 5) |
| **Duration** | 10 weeks (5 × 2-week sprints) |
| **Overall Completion** | `░░░░░░░░░░` 0% |
| **Status** | Not Started |
| **Prerequisite** | Phase 2 fully complete |
| **Goal** | Deliver the complete HRMS system (employees, attendance, leaves, payroll, performance, onboarding, exit) and the GST-compliant Invoice system (create, approve, send, payment tracking, PDF generation, credit notes, reports) |

---

## Phase Completion Tracker

```
── HRMS Backend ─────────────────────────────────────────
Employee Module (BE)          ░░░░░░░░░░   0%
Department Module (BE)        ░░░░░░░░░░   0%
Shift & Attendance (BE)       ░░░░░░░░░░   0%
Leave System (BE)             ░░░░░░░░░░   0%
Payroll Engine (BE)           ░░░░░░░░░░   0%
PDF Payslip Generation (BE)   ░░░░░░░░░░   0%
Performance Reviews (BE)      ░░░░░░░░░░   0%
Onboarding Workflow (BE)      ░░░░░░░░░░   0%
Exit Management (BE)          ░░░░░░░░░░   0%
Profile Change Approvals (BE) ░░░░░░░░░░   0%
HRMS Notifications (BE)       ░░░░░░░░░░   0%

── HRMS Frontend ────────────────────────────────────────
Employee Directory UI         ░░░░░░░░░░   0%
Employee Profile UI           ░░░░░░░░░░   0%
Attendance & Clock UI         ░░░░░░░░░░   0%
Leave Management UI           ░░░░░░░░░░   0%
Payroll UI                    ░░░░░░░░░░   0%
HR Dashboard                  ░░░░░░░░░░   0%
Performance Review UI         ░░░░░░░░░░   0%
Onboarding & Exit UI          ░░░░░░░░░░   0%

── Invoice Backend ──────────────────────────────────────
Invoice Module (BE)           ░░░░░░░░░░   0%
GST Computation Engine (BE)   ░░░░░░░░░░   0%
PDF Invoice Generation (BE)   ░░░░░░░░░░   0%
Payment Tracking (BE)         ░░░░░░░░░░   0%
Credit Note Module (BE)       ░░░░░░░░░░   0%
Overdue Cron (BE)             ░░░░░░░░░░   0%
Invoice Reports (BE)          ░░░░░░░░░░   0%

── Invoice Frontend ─────────────────────────────────────
Invoice List & Detail UI      ░░░░░░░░░░   0%
Invoice Composer UI           ░░░░░░░░░░   0%
Payment Recording UI          ░░░░░░░░░░   0%
Invoice Reports UI            ░░░░░░░░░░   0%
─────────────────────────────────────────────────────────
PHASE 3 TOTAL                 ░░░░░░░░░░   0%
```

---

## Sprint 7 — Week 13–14: HRMS Core (Employees, Departments, Shifts)

### 3.1 Employee Module

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints (from `hrms-api.md`):**
```
POST   /api/v1/employees
GET    /api/v1/employees
GET    /api/v1/employees/:id
PATCH  /api/v1/employees/:id
POST   /api/v1/employees/:id/suspend
POST   /api/v1/employees/:id/reinstate
POST   /api/v1/employees/:id/terminate
```

**Service tasks:**
- [ ] `EmployeesService.create(dto)` — transaction: create `User` account (role=EMPLOYEE, temp password), create `Employee` record, generate `employeeCode` if not provided, create `OnboardingChecklist` from workspace template, create onboarding tasks in Task module (`TasksService.createOnboardingTasks(employee)`), send welcome email via BullMQ
- [ ] `EmployeesService.findAll(filters)` — role-filtered response (salary fields excluded for ADMIN and TEAM_LEAD via class-transformer `@Exclude`)
- [ ] `EmployeesService.findOne(id)` — same field exclusion by role; EMPLOYEE can only see own record
- [ ] `EmployeesService.update(id, dto)` — HR cannot update own salary fields (PAN, bank, salary); all changes to sensitive fields audited with before/after
- [ ] `EmployeesService.suspend(id, dto)` — sets status=SUSPENDED, deactivates User account (`isActive=false`), increments `tokenVersion`, all active sessions terminated; team lead notified
- [ ] `EmployeesService.reinstate(id, dto)` — reactivates User account; team lead notified
- [ ] `EmployeesService.terminate(id)` — validates pre-conditions: all exit checklist items COMPLETED, FFS disbursed; sets status=TERMINATED; deactivates user; emits `EMPLOYEE_TERMINATED` audit entry; data retention flags set

**Response DTO:**
- [ ] `EmployeeResponseDto` — full profile for HR/SUPER_ADMIN
- [ ] `EmployeeBasicResponseDto` — public profile for ADMIN/TEAM_LEAD (excludes salary, bank, PAN, Aadhaar, dateOfBirth, personalPhone)
- [ ] `EmployeeSelfResponseDto` — self view (personal fields visible, salary-adjacent fields like bank account shown but not in HR-full mode)

**Profile change approval flow:**
```
POST /api/v1/employees/:id/profile-changes
GET  /api/v1/employees/:id/profile-changes
POST /api/v1/profile-changes/:id/approve
POST /api/v1/profile-changes/:id/reject
```
- [ ] `ProfileChangeRequestsService` — creates request; HR notified; on APPROVE: updates the actual field on Employee record; AuditLog entry isSensitive=true
- [ ] HR self-block: HR cannot approve their own profile change request

---

### 3.2 Department Module

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:** Standard CRUD on `/departments`

- [ ] `DepartmentsService.delete(id)` — blocks deletion if active employees exist (returns count + list)
- [ ] `DepartmentsService.findAll()` — returns tree structure (parent/children hierarchy)
- [ ] Department head assignment: `headId` references an Employee ID; validated to be an active employee in the workspace
- [ ] `DepartmentsService.findOne(id)` — includes employee count and leave policy assignment

---

### 3.3 Shift Management Module

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST/GET/GET:id/PATCH/DELETE /shifts
POST /employees/:id/shift-assignments
GET  /employees/:id/shift-assignments
```

- [ ] `ShiftsService` — standard CRUD + soft-delete
- [ ] `ShiftAssignmentsService.assign(employeeId, dto)` — creates assignment with `effectiveFrom`; previous assignment's `effectiveTo` set to day before `effectiveFrom`
- [ ] `ShiftAssignmentsService.getCurrent(employeeId, date)` — finds active assignment for a given date (used by attendance computation)
- [ ] Working days bitmask utilities:
  ```ts
  isWorkingDay(shift: Shift, date: Date): boolean
  getWorkingDaysInMonth(shift: Shift, year: number, month: number): number
  ```
- [ ] If past effective date provided: queue BullMQ job to recompute attendance records from that date forward (non-blocking)

---

## Sprint 8 — Week 15–16: HRMS Attendance + Leave System

### 3.4 Attendance Module

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
GET  /api/v1/attendance
GET  /api/v1/attendance/my
POST /api/v1/attendance/clock-in
POST /api/v1/attendance/clock-out
GET/POST/POST:approve/POST:reject /regularisations
```

- [ ] `AttendanceService.clockIn(employeeId)` — validates no existing open clock-in; creates `ClockEvent(CLOCK_IN)`; updates/creates `AttendanceRecord` for today; checks if late (shift.startTime + grace period of 15 min); returns attendance record
- [ ] `AttendanceService.clockOut(employeeId)` — validates open clock-in exists; creates `ClockEvent(CLOCK_OUT)`; calculates `totalMinutes`; updates `AttendanceRecord` with hours and overtime flag; returns updated record
- [ ] **End-of-day BullMQ job** (`attendance-compute`):
  - Runs daily at 11:30 PM workspace timezone (cron: `30 23 * * *` in workspace TZ)
  - For each ACTIVE employee:
    1. Check holiday calendar → HOLIDAY
    2. Check shift working days → WEEKEND
    3. Check APPROVED leaves → LEAVE
    4. Check ClockEvents for today → PRESENT / HALF_DAY / ABSENT
    5. Compute totalMinutes, isLate, isOvertime
    6. Upsert `AttendanceRecord`
    7. If ABSENT: send in-app + email notification to employee and TEAM_LEAD
- [ ] `RegularisationsService.approve(id, hrUserId)` — corrects `AttendanceRecord` for the date; preserves original values in `originalStatus`; AuditLog entry
- [ ] `AttendanceService.getSummary(employeeId, month, year)` — aggregate stats: present days, absent, leave, late count, overtime hours

---

### 3.5 Holiday Module

**Estimate:** 0.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] CRUD on `/holidays`
- [ ] `HolidaysService.create(dto)` — saves holiday; enqueues BullMQ job to update attendance records for that date across all applicable employees
- [ ] `HolidayRecomputeProcessor` — finds all attendance records for that date; updates status to HOLIDAY (unless PRESENT)
- [ ] Department-scoped holidays: `applicableToAll=false` + `departmentIds` filters which employees are affected

---

### 3.6 Leave System

**Estimate:** 4 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints (from `hrms-api.md`):** Full CRUD + `submit`, `approve-l1`, `reject-l1`, `approve-l2`, `reject-l2`, `withdraw`, `cancel`

**Service tasks:**

- [ ] `LeaveTypesService` — workspace-level CRUD; `code` unique per workspace
- [ ] `LeavePoliciesService` — assign policy to department; `LeavePolicyRule` junction management
- [ ] `LeaveBalancesService.allocate(workspaceId, year)` — BullMQ job at start of leave year; reads each employee's policy rules; creates/updates `LeaveBalance` records for the year; handles carry-forward
- [ ] `LeaveBalancesService.addPending(employeeId, leaveTypeId, days)` — called on submission
- [ ] `LeaveBalancesService.convertPendingToUsed(leaveApplicationId)` — called on full approval
- [ ] `LeaveBalancesService.releasePending(leaveApplicationId)` — called on rejection/withdrawal/expiry
- [ ] `LeaveApplicationsService.submit(id, employeeId)` — transition DRAFT → SUBMITTED; validates: sufficient balance, no overlap, minAdvanceNotice, maxConsecutiveDays, genderRestriction; computes `totalDays` (excludes holidays/weekends); determines `approvalRoute`; creates `ApprovalRequest`; notifies L1 approver
- [ ] **Approval methods** — each transitions the leave status, creates `ApprovalAction`, notifies relevant parties, and on final approval: creates calendar blocks, pre-sets attendance records to LEAVE, deducts balance
- [ ] **Self-approval block** — enforced in service: `if (leave.employeeId === actorId) throw ForbiddenException`
- [ ] **Conflict detection** — before submit: query for any APPROVED or PENDING leaves with overlapping date range for the same employee
- [ ] **Expiry BullMQ job** — runs hourly; finds PENDING_L1 or PENDING_L2 leaves where `expiresAt < now()`; transitions to EXPIRED; releases balance; notifies all parties
- [ ] **Year-end carry-forward BullMQ job** — runs on first day of new leave year; reads carry-forward policy; creates new-year balance records

---

## Sprint 9 — Week 17–18: Payroll Engine

### 3.7 Salary Structure Module

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST/GET/GET:id/PATCH  /salary-structures
POST/GET               /employees/:id/salary-assignments
```

- [ ] `SalaryStructuresService` — CRUD; status transitions (DRAFT → ACTIVE → SUPERSEDED)
- [ ] Assignment: `SalaryStructureAssignmentsService.assign(employeeId, dto)` — closes previous assignment (`effectiveTo = effectiveFrom - 1 day`); creates new assignment; updates `employee.currentSalaryStructureId`; AuditLog: `SALARY_CHANGE`, isSensitive=true
- [ ] HR self-assign block: HR cannot assign salary structure to themselves

---

### 3.8 Payroll Computation Engine

**Estimate:** 5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST /api/v1/payroll-runs
GET  /api/v1/payroll-runs
GET  /api/v1/payroll-runs/:id
GET  /api/v1/payroll-runs/:id/line-items
PATCH /api/v1/payroll-runs/:id/line-items/:employeeId
POST /api/v1/payroll-runs/:id/submit
POST /api/v1/payroll-runs/:id/approve
POST /api/v1/payroll-runs/:id/finalise
POST /api/v1/payroll-runs/:id/disburse
POST /api/v1/payroll-runs/:id/bonuses
GET  /api/v1/employees/:id/payslips
GET  /api/v1/payslips/:id/download
```

- [ ] `PayrollRunsService.create(dto)` — unique constraint check (one run per month/year); creates run record; enqueues `payroll-compute` BullMQ job
- [ ] **`PayrollComputeProcessor`** (BullMQ worker — the core of HRMS):
  ```
  For each ACTIVE employee (+ EXITING employees for FFS):
  1. Get attendance: working days, present, absent, leave, holiday counts
  2. Get approved leaves: mapped by type for Loss-of-Pay check
  3. Get active salary structure on this run's date
  4. Compute gross:
     - Monthly CTC
     - Prorate if joining/exit mid-month: gross × (daysWorked / workingDaysInMonth)
     - Loop through EARNING components: fixed amounts + formula-based
  5. Compute Loss of Pay: (gross / workingDays) × lopDays
  6. Compute statutory deductions:
     - PF = 12% of Basic (if applicable, cap at ₹1,800/month)
     - ESI = 0.75% of Gross (if gross ≤ ₹21,000)
     - Professional Tax = slab lookup per employee state
  7. Compute TDS = (annualized taxable income − deductions) × slab rate / 12
  8. Apply bonuses for this employee in this run
  9. Compute net = gross − lopDeduction − totalDeductions
  10. Store PayrollLineItem with earningsBreakdown + deductionsBreakdown as JSON
  ```
- [ ] Tax slab configuration: configurable per workspace per financial year (stored as JSON in workspace settings)
- [ ] PF configuration: enabled/disabled per workspace; cap configurable
- [ ] Pro-ration calculation: `(workingDaysActuallyPresent + approvedLeaves + holidays) / workingDaysInMonth`
- [ ] `PayrollRunsService.approve(runId, hrUserId)` — HR self-approval block (if hrUserId's salary was in this run, reject with `HR_SELF_APPROVAL_CONFLICT`); transitions to APPROVED; enqueues payslip generation jobs (one per employee)
- [ ] `PayrollRunsService.unlock(runId, superAdminId, reason)` — SUPER_ADMIN only; reverts APPROVED → UNDER_REVIEW; reason mandatory; AuditLog: `PAYROLL_UNLOCK`, isSensitive=true
- [ ] `PayrollRunsService.overrideLineItem(runId, employeeId, dto)` — HR can override `netSalary` with `overrideNote`; run must be DRAFT or UNDER_REVIEW

---

### 3.9 Payslip PDF Generation

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `PayslipGenerateProcessor` (BullMQ) — per-employee job:
  1. Fetch `PayrollLineItem` + Employee profile + workspace branding
  2. Render payslip HTML template (Handlebars or similar)
  3. Convert HTML → PDF using `@sparticuz/chromium` (headless Chrome Lambda-compatible) or `puppeteer`
  4. Upload PDF to R2: `{workspaceId}/payslips/{year}/{month}/{employeeId}.pdf`
  5. Store `pdfUrl` on `Payslip` record; update status → GENERATED
- [ ] `PayslipDistributeProcessor` — triggered after all payslips generated:
  1. Update `Payslip.status` → DISTRIBUTED
  2. Emit `payslip.ready` Socket.IO event to each employee
  3. Enqueue email notification with payslip PDF attached
- [ ] Payslip PDF template: workspace logo, employee details, earnings table, deductions table, net pay in words (using number-to-words library for Indian format), watermark "CONFIDENTIAL"
- [ ] `GET /payslips/:id/download` — returns signed URL from R2; logs `SENSITIVE_EXPORT` in AuditLog

---

### 3.10 Performance Reviews + Onboarding + Exit

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Performance Reviews:**
- [ ] Full CRUD + `self-assessment`, `manager-review`, `hr-sign-off` endpoints
- [ ] Status machine: DRAFT → SELF_ASSESSMENT → MANAGER_REVIEW → HR_REVIEW → COMPLETED
- [ ] Notifications at each transition
- [ ] Probation review type: triggered automatically 14 days before `probationEndDate` (BullMQ cron job)

**Onboarding:**
- [ ] `OnboardingService.createFromTemplate(employeeId)` — creates checklist from workspace template (configurable list of default items); creates corresponding Tasks in Task module for each IT/HR action
- [ ] Item status transitions: PENDING → IN_PROGRESS → COMPLETED / WAIVED
- [ ] `OnboardingService.complete(employeeId, hrId)` — validates all mandatory items COMPLETED; transitions employee status ONBOARDING → ACTIVE; allocates leave balances for the year

**Exit Management:**
- [ ] `ExitService.initiate(employeeId, dto)` — creates ExitRecord; transitions status ACTIVE → EXITING; creates exit checklist from workspace template; creates knowledge-transfer tasks in Task module; TEAM_LEAD notified
- [ ] Full and Final Settlement: `ExitService.computeFFS(employeeId)` — calculates: pro-rated salary, leave encashment (`unusedEarnedLeave × (monthlySalary / 26)`), notice period shortfall deduction, gratuity (if > 5 years), outstanding advances
- [ ] `ExitService.terminate(employeeId, superAdminId)` — validates FFS disbursed and all mandatory exit items COMPLETED; calls `EmployeesService.terminate()`

---

## Sprint 10 — Week 19–20: HRMS Frontend

### 3.11 Employee Directory and Profile UI

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Employee directory** (`/hrms/employees`):
  - Grid card view (mobile) + table view (desktop)
  - Avatar, name, designation, department, status badge
  - Filters: status, department, employment type, search by name/code
  - "Add Employee" button (HR/SUPER_ADMIN only)

- [ ] **Add Employee wizard** (multi-step form):
  - Step 1: Work info — email, name, designation, employment type, department, joining date
  - Step 2: Personal info — DOB, gender, phone, address
  - Step 3: Salary — salary structure selection, CTC input
  - Step 4: Review & create — summary before submit
  - Auto-generated password shown once after creation

- [ ] **Employee profile** (`/hrms/employees/:id`):
  - Header: avatar, name, employee code, designation, status badge, action buttons
  - Mobile tabs: Profile | HRMS | Documents
  - Desktop: two-column (profile 60% + sidebar 40%)
  - **Profile tab**: personal details, employment details, contact info (editable by employee for self-service fields)
  - **HRMS tab**: shift assignment, current salary structure (HR only), leave balances, attendance summary
  - **Sensitive fields** (HR/SUPER_ADMIN only): PAN, bank details, Aadhaar
  - **Profile change requests** section: pending requests with approve/reject for HR; submit new request for employee

---

### 3.12 Attendance and Clock UI

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Clock widget** (employee dashboard + HRMS attendance page):
  - Large clock-in/clock-out button (see Dashboard Guidelines)
  - Live running timer when clocked in
  - Today's total logged time

- [ ] **Attendance calendar** (`/hrms/attendance/my`):
  - Monthly calendar view (default: current month)
  - Each day: coloured status chip (Present=green, Absent=red, Leave=amber, Holiday=blue, Weekend=gray)
  - Click a day: expand detail (clock-in time, clock-out time, total minutes)
  - Regularisation request button on ABSENT days

- [ ] **Team attendance** (TEAM_LEAD / HR):
  - Date picker + department filter
  - Table: employee | day 1 | day 2 ... | day 31 with status chips
  - Summary row: present count, absent count per day
  - Export to CSV button (HR only)

- [ ] **Regularisation requests** section:
  - HR inbox: list of pending requests with approve/reject buttons inline
  - Employee self-service: "Request correction" dialog

---

### 3.13 Leave Management UI

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **My Leaves page** (`/hrms/leaves`):
  - Balance cards: one card per leave type with donut chart (used/available)
  - Leave history list: date range, type, status badge, days count
  - "Apply for Leave" button → leave application form
  - Cancel pending application button

- [ ] **Apply for Leave form**:
  - Leave type selector (shows available balance)
  - Date range picker (calendar with blocked dates: holidays, existing leaves, weekends)
  - Duration display: auto-calculates working days
  - Reason textarea
  - Document upload (for types requiring document)
  - Submit for approval

- [ ] **HR Leave Management** (`/hrms/leaves/all`):
  - Pending approvals list (priority inbox)
  - Per-request: employee name, leave type, dates, reason, document link
  - Approve / Reject buttons inline
  - Rejection: reason required inline textarea
  - Leave calendar: team-wide view of who is on leave on which days
  - Leave type configuration link

- [ ] **TEAM_LEAD Leave View**: own team pending L1 approvals

- [ ] **Leave Types settings** (`/hrms/leaves/types`):
  - Card list of leave types with edit action
  - Create new leave type form (HR/SUPER_ADMIN)

---

### 3.14 Payroll UI

**Estimate:** 2.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Payroll Runs list** (`/hrms/payroll`):
  - Status timeline: DRAFT → UNDER_REVIEW → APPROVED → FINALISED → DISBURSED
  - Current run status card: progress, total gross, employee count, action button for current step
  - Run history: previous months with status and totals

- [ ] **Run detail** (`/hrms/payroll/:id`):
  - Summary stats: total gross, deductions, net, employee count
  - Line items table: employee | days present | gross | deductions | net
  - Override edit: click net salary cell → edit with note (UNDER_REVIEW only)
  - Bonuses section: add bonus per employee
  - Approve / Submit buttons per run status

- [ ] **Payslips section** (within run detail):
  - Generate status: 42/42 payslips generated progress bar
  - Distribute button: sends notifications to all employees
  - Per-payslip: employee name, status, download PDF link

- [ ] **My Payslips** (employee profile → Payslips tab):
  - List: month, year, net pay, download button
  - PDF opens in new tab or triggers download

- [ ] **Salary Structures** (`/hrms/payroll/structures`):
  - Card list of structures with component breakdown preview
  - Create structure form with dynamic component builder (add/remove components, select earning/deduction type, fixed vs formula)

---

### 3.15 HR Dashboard + Performance + Onboarding UI

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **HR Dashboard** (role-specific, as per dashboard guidelines)
- [ ] **Performance Reviews** (`/hrms/performance`):
  - Review list with status chips
  - Self-assessment form (for employee)
  - Manager review form
  - HR sign-off form
  - Rating scale: 5-star with labels (Exceptional / Exceeds / Meets / Below / Unsatisfactory)
- [ ] **Onboarding Checklist** (on employee profile):
  - Progress bar: 5/7 items complete
  - Item list with status selector and responsible person
  - "Complete Onboarding" button (activated when all mandatory items done)
- [ ] **Exit Management** (on employee profile, for HR):
  - Initiate exit button → exit type + LWD dialog
  - Exit checklist with status management
  - FFS computation summary card

---

## Sprint 11 — Week 21–22: Invoice System

### 3.16 Invoice Module Backend

**Estimate:** 4 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints (from `invoice-api.md`):** Full invoice lifecycle endpoints

**Service tasks:**
- [ ] `InvoicesService.create(dto)` — invoice number auto-generation: `{prefix}-{year}-{sequentialNumber}` using workspace `nextInvoiceSeq` (atomically incremented); GST computation (see below); creates line items; if time entries provided: marks entries as `in-draft-invoice`
- [ ] **GST computation engine**:
  ```ts
  function computeGst(lineItem, invoice, workspace) {
    if (invoice.gstType === 'EXEMPT') return { cgst: 0, sgst: 0, igst: 0 }
    const taxableAmount = lineItem.quantity × lineItem.unitPrice
    const taxAmount = taxableAmount × (lineItem.gstRate / 100)
    if (invoice.clientState === workspace.businessState) {
      return { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 }  // intra-state
    } else {
      return { cgst: 0, sgst: 0, igst: taxAmount }  // inter-state
    }
  }
  ```
- [ ] `InvoicesService.approve(id, actorId)` — self-approval check (creator !== approver); transitions DRAFT → READY_TO_SEND; enqueues PDF generation job; locks time entries (status BILLED)
- [ ] `InvoicesService.send(id, dto)` — validates PDF generated; sends email via Brevo with PDF attachment; updates status SENT; records `sentAt`
- [ ] `InvoicesService.void(id, dto)` — reason required; transitions to VOIDED; reverts BILLED time entries to APPROVED; creates CreditNote if requested
- [ ] `InvoicesService.logPayment(id, dto)` — creates Payment record; updates `totalPaid` and `outstanding`; transitions status (PARTIALLY_PAID or PAID based on outstanding balance); on PAID: notifies ADMIN
- [ ] Post-sent edit (SUPER_ADMIN): requires `overrideReason`; re-generates PDF; AuditLog entry isSensitive=true
- [ ] **Overdue cron** (BullMQ, daily 9:00 AM workspace TZ):
  - Query invoices: status IN (SENT, VIEWED, PARTIALLY_PAID) AND dueDate < today AND isDisputed=false
  - Day 1: status → OVERDUE; email to client + ADMIN
  - Day 7: reminder email
  - Day 15: escalation email (firmer tone)
  - Day 30: SUPER_ADMIN notification
- [ ] `InvoicesService.importTimeEntries(id, dto)` — fetches APPROVED time entries by IDs; validates all belong to workspace and are not BILLED; creates line items from entries; marks entries as `in-draft-invoice`

---

### 3.17 Invoice PDF Generation

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `PdfGenerateProcessor` (BullMQ `pdf-generation` queue):
  1. Fetch invoice with all line items, workspace branding (logo, address, bank details)
  2. Compile Handlebars HTML template
  3. Launch headless Chromium (`@sparticuz/chromium`)
  4. Generate PDF
  5. Upload to R2: `{workspaceId}/invoices/{invoiceNumber}.pdf`
  6. Update `invoice.pdfUrl`, `invoice.pdfGeneratedAt`
  7. Notify ADMIN: "PDF ready" in-app notification
- [ ] Invoice HTML template: workspace logo, GST invoice header, bill-to section, line items table (Description | Qty | Rate | Taxable | GST | Total), tax breakup (CGST/SGST or IGST), grand total, amount in words (Indian format), payment instructions, watermark on VOIDED invoices
- [ ] Credit note PDF template: references original invoice number, credit amount, reason
- [ ] `GET /invoices/:id/pdf` — returns 302 redirect to signed R2 URL (expiry: 5 minutes); AuditLog: `EXPORT`

---

### 3.18 Invoice Reports

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
GET /api/v1/invoices/reports/revenue
GET /api/v1/invoices/reports/aging
GET /api/v1/invoices/reports/gst-summary
```

- [ ] Revenue report: Prisma `groupBy` on closedAt/paidAt month; sums grandTotal, totalPaid, outstanding
- [ ] AR Aging: query outstanding invoices; compute `daysPastDue = today - dueDate`; bucket into Current / 1-30 / 31-60 / 60+; return sorted by days past due descending
- [ ] GST summary: GROUP BY gstRate; SUM of cgst + sgst + igst by rate — needed for GSTR-1 filing preparation

---

## Sprint 12 — Week 22 (Continued): Invoice Frontend

### 3.19 Invoice List and Detail UI

**Estimate:** 2.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Invoice list** (`/invoices`):
  - Quick filter tabs: All | Drafts | Sent | Overdue | Paid
  - Card view (mobile): invoice number, client name, amount, due date, status
  - Table view (desktop): all columns + overdue indicator
  - Aging summary banner on top if overdue invoices exist
  - "New Invoice" button

- [ ] **Invoice detail** (`/invoices/:id`):
  - Status timeline bar: Draft → Approved → Sent → Viewed → Paid
  - Client section: company/contact name, email, GSTIN, state
  - Line items table (read-only when not DRAFT)
  - GST breakdown card: subtotal, CGST/SGST or IGST, grand total
  - "Outstanding" amount displayed prominently in red if > 0
  - Action buttons per status:
    - DRAFT: Edit, Approve, Delete
    - READY_TO_SEND: Send to Client, Download PDF
    - SENT/VIEWED/OVERDUE: Log Payment, Void, Download PDF
    - PAID: Download PDF, View Credit Notes
  - Payment history section: list of payments with date, method, reference
  - Credit notes section (if any)

---

### 3.20 Invoice Composer UI

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Create Invoice** (`/invoices/new`):
  - **Client section**: search/select from CRM contacts and companies; auto-fills billing details; manual override of GSTIN, state, address
  - **Link section**: optional deal + project dropdowns
  - **Date section**: invoice date (default today) + due date (default today + payment terms days)
  - **GST section**: auto-detected intra/inter-state; override available; displays computed GST type badge
  - **Line items section**:
    - Dynamic list with add/remove rows
    - Per-row: description, qty, unit price, GST rate, HSN/SAC code
    - Auto-computed: taxable amount, GST amount, line total
    - "Import from time entries" button (opens time entry selector modal)
    - Template loader: select template to pre-fill line items
  - **Totals section** (sticky on desktop right panel):
    - Subtotal, CGST, SGST (or IGST), Grand Total in large text
    - "Amount in words" preview
  - **Notes + payment terms**: textarea fields
  - Save as Draft / Approve and Generate PDF buttons

- [ ] **Time entry import modal**:
  - Filtered to linked project's APPROVED, unbilled time entries
  - Grouped by employee + task
  - Checkboxes to select entries
  - Billable rate override field
  - Preview: selected hours × rate = line item amount
  - On confirm: adds line items to composer

---

### 3.21 Payment + Reports UI

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Log Payment dialog**:
  - Amount (defaults to outstanding balance)
  - Payment date (default today)
  - Method selector (bank transfer / UPI / cheque / cash / gateway)
  - Reference field (UTR / UPI ID / cheque number)
  - Notes
  - On save: invoice status updates reactively

- [ ] **Invoice Reports page** (`/invoices/reports`):
  - Revenue chart: monthly line chart (invoiced vs collected)
  - AR Aging table with bucket columns
  - GST summary table (for tax period selection): by rate, CGST, SGST, IGST columns
  - Export to Excel button (each report)

---

## Phase 3 Completion Criteria

| Criterion | Verified |
|---|---|
| Create employee → user account created, welcome email sent, onboarding checklist generated | ☐ |
| Clock in + clock out → attendance record computed correctly | ☐ |
| End-of-day job runs → absent employees notified | ☐ |
| Leave application → L1 approve → L2 approve → calendar blocks created | ☐ |
| Leave balance deducted on approval; restored on rejection | ☐ |
| Self-approval blocked (employee cannot approve own leave) | ☐ |
| Payroll run initiated → computation job completes → all line items created | ☐ |
| Payslip PDF generated, uploaded to R2, distributed to employee | ☐ |
| HR cannot approve payroll run where own salary was modified | ☐ |
| Employee terminated → user deactivated → all sessions invalidated | ☐ |
| Invoice created with correct GST type (intra vs inter-state) | ☐ |
| Invoice approved → PDF generated → send to client triggers Brevo email | ☐ |
| Payment logged → invoice status transitions to PAID | ☐ |
| Overdue cron runs → SENT invoice past due → status OVERDUE → email sent | ☐ |
| Invoice voided → time entries reverted to APPROVED → credit note created | ☐ |
| GST summary report shows correct CGST/SGST/IGST breakdowns | ☐ |
| All mobile views tested (employee profile, leave application, payslip download) | ☐ |

---

## Phase 3 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Payroll computation job times out for large employee counts | Medium | High | Process employees in batches of 20; use BullMQ child jobs per batch |
| Headless Chromium memory usage in PDF generation | Medium | High | Use `@sparticuz/chromium` (compressed); limit concurrent PDF jobs to 5; queue with concurrency=5 |
| GST computation logic errors (wrong state mapping) | Medium | High | Unit test GST engine with 20+ scenarios: intra-state, inter-state, exempt, mixed rates |
| Leave calendar conflicts between employees on same dates | Low | Medium | Database unique constraint on (employeeId, date) in attendance; conflict detection at submission |
| FFS calculation disputes (incorrect notice period computation) | Low | Medium | Log all FFS computation inputs as JSON; provide HR an override with audit trail |

---

## Phase 3 → Phase 4 Handoff

Phase 4 (Optimization) can begin when:
1. Employee lifecycle (onboarding → active → exit) fully operational
2. Attendance clock-in/out and end-of-day computation working
3. Full leave approval chain (L1 + L2) working end-to-end
4. Payroll run → payslip generation → employee notification working
5. Invoice creation → approve → send → payment → PAID status complete
6. PDF generation for both payslips and invoices operational
7. Overdue invoice cron running and sending reminders
8. All financial data audit trails verified (isSensitive entries in AuditLog)
