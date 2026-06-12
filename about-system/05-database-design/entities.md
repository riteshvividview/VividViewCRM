# Entities — VividCRM Database Design

## Design Principles

1. **Every table carries `workspaceId`** — multi-tenancy is row-scoped from day one; no migration cost when SaaS launches
2. **Soft-delete everywhere** — `deletedAt` timestamp on mutable business records; financial and HR records never hard-delete
3. **Immutable financial records** — PayrollRun, PayrollLineItem, Payslip, Payment, AuditLog are append-only by convention; deletion is blocked at the service layer
4. **Snapshot client state on financial documents** — Invoice captures `clientName`, `clientAddress`, `clientGstin` at creation time so CRM edits do not mutate issued invoices
5. **Polymorphic via nullable FKs** — document attachments and CRM activities use nullable foreign keys rather than a single `entityType + entityId` string pair, preserving FK integrity
6. **JSON for flexible breakdowns** — `earningsBreakdown` and `deductionsBreakdown` on PayrollLineItem store component-level data; this avoids a wide columnar table while keeping the total figures in typed columns for aggregation
7. **Bitmask for weekday config** — Shift working days stored as an integer bitmask (Mon=1, Tue=2, Wed=4 …) for compact storage and fast computation
8. **Cuid2 primary keys** — collision-resistant, URL-safe, non-sequential (no enumeration risk in multi-tenant APIs)

---

## Entity Count Summary

| Domain | Entities |
|---|---|
| Core / Shared | Workspace, User, Team, TeamMember |
| CRM | Lead, Deal, Contact, Company, Campaign, Mailing, MailingRecipient, CrmActivity |
| Task Management | Project, ProjectMember, Board, BoardColumn, Task, TaskComment, TaskMention, TaskWatcher, TaskLabel, TaskLabelAssignment, TimeEntry, Sprint, RecurringTaskTemplate |
| HRMS — People | Employee, Department, Shift, ShiftAssignment, Holiday |
| HRMS — Attendance | AttendanceRecord, ClockEvent, RegularisationRequest |
| HRMS — Leave | LeaveType, LeavePolicy, LeavePolicyRule, LeaveBalance, LeaveApplication |
| HRMS — Payroll | SalaryStructure, SalaryComponent, SalaryStructureAssignment, PayrollRun, PayrollLineItem, Payslip, Bonus |
| HRMS — Lifecycle | PerformanceReview, OnboardingChecklist, OnboardingChecklistItem, ExitRecord, ExitChecklistItem, ProfileChangeRequest |
| Invoice | Invoice, InvoiceLineItem, Payment, CreditNote, InvoiceTemplate, InvoiceTemplateLineItem |
| Approvals | ApprovalRequest, ApprovalLevel, ApprovalAction, ApprovalDelegation |
| Documents | Document, DocumentAttachment, DocumentShare |
| Notifications | Notification, NotificationPreference |
| Audit | AuditLog |
| **Total** | **55 entities** |

---

## Core / Shared Entities

### Workspace
Central tenant record. Every other entity in the system is scoped to a workspace via `workspaceId`.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Display name |
| slug | String | URL-safe unique identifier |
| timezone | String | Default: `Asia/Kolkata` |
| currency | String | Default: `INR` |
| gstin | String? | Workspace GST number (for invoice generation) |
| businessState | String? | Used for intra/inter-state GST decision |
| isCrmEnabled | Boolean | Feature flag — SaaS plan control |
| isTasksEnabled | Boolean | Feature flag |
| isHrmsEnabled | Boolean | Feature flag |
| isInvoiceEnabled | Boolean | Feature flag |
| plan | String | INTERNAL / STARTER / GROWTH / BUSINESS / ENTERPRISE |
| payrollCycleDay | Int | Day of month payroll is computed |
| leaveYearStart | String | APRIL or JANUARY |

### User
System authentication and identity record. Every human actor in the system is a User. A User may also have an Employee record (for HRMS data).

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| workspaceId | String | FK → Workspace |
| email | String | Unique per workspace |
| passwordHash | String | bcrypt hash |
| role | Role (enum) | SUPER_ADMIN / ADMIN / HR / TEAM_LEAD / EMPLOYEE |
| isActive | Boolean | False when terminated or suspended |
| tokenVersion | Int | Incremented on role change; invalidates all existing JWTs |

### Team
Logical grouping of users for CRM and task scoping. A Team has one TEAM_LEAD.

### TeamMember
Junction table: User ↔ Team. Records when the user joined the team.

---

## CRM Entities

### Lead
An unqualified prospect. First entity in the CRM pipeline.

| Field | Type | Notes |
|---|---|---|
| status | LeadStatus | NEW → ATTEMPTING_CONTACT → CONTACTED → QUALIFIED → CONVERTED / DISQUALIFIED |
| source | String? | WEBSITE, REFERRAL, CAMPAIGN, IMPORT, MANUAL |
| convertedAt | DateTime? | Set when status → CONVERTED |
| convertedDealId | String? | The Deal created from this lead |
| campaignId | String? | Optional link to Campaign that sourced this lead |
| disqualifiedReason | String? | Required when status → DISQUALIFIED |

### Deal
A qualified sales opportunity moving through a pipeline.

| Field | Type | Notes |
|---|---|---|
| status | DealStatus | QUALIFICATION → PROPOSAL → NEGOTIATION → WON / LOST |
| value | Decimal | Deal monetary value |
| expectedCloseDate | DateTime? | Forecast close date |
| closedAt | DateTime? | Actual close date |
| lossReason | String? | Required on LOST |
| probability | Int? | 0–100; used for weighted pipeline reporting |
| sourceLeadId | String? | The lead this deal originated from |

### Contact
A person record. Can be linked to a Company and to multiple Deals.

| Field | Type | Notes |
|---|---|---|
| status | ContactStatus | ACTIVE / INACTIVE / ARCHIVED |
| gstin | String? | For B2B clients; used in invoice generation |
| companyId | String? | FK → Company |

### Company
An organisation. Parent entity for Contacts and Deals.

### Campaign
A marketing campaign that drives lead generation.

| Field | Type | Notes |
|---|---|---|
| status | CampaignStatus | DRAFT → SCHEDULED → RUNNING → COMPLETED / CANCELLED |

### Mailing
A single email broadcast job. Belongs to a Campaign (or standalone).

| Field | Type | Notes |
|---|---|---|
| status | MailStatus | DRAFT → REVIEW → SCHEDULED → SENDING → SENT / FAILED |
| totalSent / Opened / Clicked / Bounced | Int | Updated by Brevo webhook |

### MailingRecipient
One row per recipient per mailing. Tracks per-recipient delivery state.

### CrmActivity
Immutable append-only log of events on any CRM entity. Polymorphic via nullable FKs to Lead, Deal, Contact, Company.

---

## Task Management Entities

### Project
Top-level work container. Optionally linked to a CRM Deal.

| Field | Type | Notes |
|---|---|---|
| status | ProjectStatus | PLANNING → ACTIVE → ON_HOLD / COMPLETED / CANCELLED |
| type | String | CLIENT / INTERNAL / MAINTENANCE |
| dealId | String? | FK → Deal (if created from a won deal) |
| teamId | String? | Owning team |

### ProjectMember
Junction: User ↔ Project. Tracks when member was added/removed.

### Board
A view within a Project. A project can have multiple boards (e.g., "Development Board", "QA Board").

### BoardColumn
A column within a Board. Maps to a canonical TaskStatus (e.g., "In Review" column maps to `IN_REVIEW` status).

| Field | Type | Notes |
|---|---|---|
| mappedStatus | TaskStatus | Which task status this column represents |
| wipLimit | Int? | Work-in-progress cap; warning shown when exceeded |

### Task
The core unit of work. Supports hierarchy (parent/subtasks).

| Field | Type | Notes |
|---|---|---|
| status | TaskStatus | TODO → IN_PROGRESS → BLOCKED → IN_REVIEW → DONE → ARCHIVED |
| priority | String | LOW / MEDIUM / HIGH / URGENT |
| parentTaskId | String? | Self-referential FK for subtasks |
| isBlocked | Boolean | Blocker flag |
| blockerType | BlockerType? | DEPENDENCY / EXTERNAL / RESOURCE / UNCLEAR_REQUIREMENTS |
| recurringTemplateId | String? | Set if created from a RecurringTaskTemplate |
| estimatedHours | Decimal? | Planning estimate |

### TaskComment
A comment thread entry on a Task. Soft-delete preserves thread continuity.

### TaskMention
One row per @mentioned user per comment. Drives notification delivery.

### TaskWatcher
Users who receive notifications for a task without being the assignee.

### TaskLabel / TaskLabelAssignment
Configurable workspace-level labels (tags) applied to tasks.

### TimeEntry
Hours logged by an employee against a task.

| Field | Type | Notes |
|---|---|---|
| status | TimeEntryStatus | DRAFT → SUBMITTED → APPROVED / REJECTED → BILLED |
| isBillable | Boolean | Whether these hours can be invoiced to a client |
| billableRate | Decimal? | Per-hour rate override |
| invoiceId | String? | Set when entry is imported into an invoice |

### Sprint
A time-boxed iteration within a Project.

| Field | Type | Notes |
|---|---|---|
| status | SprintStatus | DRAFT → PLANNED → ACTIVE → COMPLETED / CANCELLED |
| plannedPoints | Int? | Story points planned |
| completedPoints | Int? | Story points completed (filled at close) |
| carryOverCount | Int? | Tasks moved to next sprint |

### RecurringTaskTemplate
A template that generates Tasks on a schedule via BullMQ.

| Field | Type | Notes |
|---|---|---|
| frequency | RecurringFrequency | DAILY / WEEKLY / BIWEEKLY / MONTHLY / CUSTOM |
| cronExpression | String? | For CUSTOM frequency |
| status | RecurringTemplateStatus | ACTIVE / PAUSED / ENDED / ARCHIVED |
| occurrenceCount | Int | Running count of generated tasks |
| nextGenerateAt | DateTime? | Next scheduled generation time |

---

## HRMS — People Entities

### Employee
HRMS-specific data for a system User. One-to-one with User.

| Field | Type | Notes |
|---|---|---|
| status | EmployeeStatus | ONBOARDING → ACTIVE → ON_LEAVE / SUSPENDED / EXITING → TERMINATED |
| employmentType | EmploymentType | FULL_TIME / PART_TIME / CONTRACT / INTERN |
| probationEndDate | Date? | Triggers probation review workflow |
| probationStatus | String? | UNDER_PROBATION / CONFIRMED / EXTENDED / FAILED |
| currentSalaryStructureId | String? | Active salary structure |
| bankAccountNumber | String? | Encrypted at application layer |
| reportingManagerId | String? | Another employee's ID |

### Department
Organisational unit. Supports hierarchy via `parentDepartmentId`.

### Shift
Work schedule definition: start/end times, working days bitmask, break duration.

### ShiftAssignment
Which shift an employee is on, from which effective date. History preserved.

### Holiday
Company/national/regional holidays. Scoped to all or specific departments.

---

## HRMS — Attendance Entities

### AttendanceRecord
One row per employee per working day. Computed by BullMQ end-of-day job.

| Field | Type | Notes |
|---|---|---|
| status | AttendanceStatus | ABSENT / PRESENT / HALF_DAY / LEAVE / HOLIDAY / WEEKEND / REGULARISED |
| firstClockIn | DateTime? | Derived from ClockEvent |
| lastClockOut | DateTime? | Derived from ClockEvent |
| totalMinutes | Int? | Total logged minutes |
| isLate | Boolean | Clock-in after shift start + grace period |
| isOvertime | Boolean | Hours exceed threshold |
| originalStatus | AttendanceStatus? | Preserved on HR correction |
| Unique on | (employeeId, date) | One record per employee per day |

### ClockEvent
Raw clock-in and clock-out events from the employee. Source of truth for attendance computation.

### RegularisationRequest
Employee-submitted correction request for a missed or incorrect attendance entry.

---

## HRMS — Leave Entities

### LeaveType
Configuration record: Earned Leave, Sick Leave, Casual Leave, etc.

| Field | Type | Notes |
|---|---|---|
| code | String | EL, SL, CL, ML, PL, CO, UPL — unique per workspace |
| approvalRoute | LeaveApprovalRoute | L1_ONLY / L1_AND_L2 / L2_ONLY / NONE |
| accrualType | String | ANNUAL_UPFRONT / MONTHLY_ACCRUAL |
| carryForwardLimit | Decimal? | Max days carry-forward; null = unlimited |
| genderRestriction | String | NONE / FEMALE_ONLY / MALE_ONLY |

### LeavePolicy
Named policy assigned to a department (or workspace-wide default).

### LeavePolicyRule
Junction: LeavePolicy ↔ LeaveType. Allows per-policy entitlement overrides.

### LeaveBalance
Per-employee, per-leave-type, per-year balance tracking.

| Field | Type | Notes |
|---|---|---|
| allocated | Decimal | Annual entitlement for this year |
| carriedForward | Decimal | Days brought in from prior year |
| used | Decimal | Approved and taken |
| pending | Decimal | Tentatively reserved (applications in flight) |
| lapsed | Decimal | Unused balance that expired |
| Unique on | (employeeId, leaveTypeId, year) | One balance record per year |

### LeaveApplication
An employee's leave request with full approval state.

| Field | Type | Notes |
|---|---|---|
| status | LeaveApplicationStatus | DRAFT → SUBMITTED → PENDING_L1 → PENDING_L2 → APPROVED / REJECTED / WITHDRAWN / EXPIRED / CANCELLED |
| approvalRoute | LeaveApprovalRoute | Frozen at submission time |
| l1ApproverId, l2ApproverId | String? | Who approved at each level |
| approvalRequestId | String? | FK → ApprovalRequest (cross-module link) |

---

## HRMS — Payroll Entities

### SalaryStructure
A named template of salary components (earnings + deductions). Assigned to employees.

### SalaryComponent
One component within a SalaryStructure.

| Field | Type | Notes |
|---|---|---|
| type | SalaryComponentType | EARNING / DEDUCTION |
| isFixed | Boolean | Fixed amount vs. formula-derived |
| deductionBasis | DeductionBasis? | FIXED / PERCENTAGE_OF_BASIC / PERCENTAGE_OF_GROSS |
| percentageValue | Decimal? | If formula-derived |
| isStatutory | Boolean | PF, ESI, Professional Tax |

### SalaryStructureAssignment
History of salary structure assignments per employee with effective dates.

### PayrollRun
One payroll computation run per workspace per month.

| Field | Type | Notes |
|---|---|---|
| status | PayrollRunStatus | DRAFT → UNDER_REVIEW → APPROVED → FINALISED → DISBURSED |
| totalGross / Deductions / Net | Decimal | Aggregate figures |
| isUnlocked | Boolean | SUPER_ADMIN override flag |
| Unique on | (workspaceId, month, year) | One run per period |

### PayrollLineItem
Per-employee computation result within a payroll run.

| Field | Type | Notes |
|---|---|---|
| earningsBreakdown | Json | `{ "Basic": 30000, "HRA": 12000 }` |
| deductionsBreakdown | Json | `{ "PF": 3600, "PT": 200 }` |
| isProRated | Boolean | New joiners / exiters mid-month |
| proRationFactor | Decimal? | e.g., 0.6774 for 21 days out of 31 |
| Unique on | (payrollRunId, employeeId) | One line per employee per run |

### Payslip
Generated PDF record for one employee for one payroll run.

### Bonus
A one-time payment added to a specific payroll run for a specific employee.

---

## HRMS — Lifecycle Entities

### PerformanceReview
A review cycle entry: self-assessment, manager review, HR sign-off.

| Field | Type | Notes |
|---|---|---|
| status | PerformanceReviewStatus | DRAFT → SELF_ASSESSMENT → MANAGER_REVIEW → HR_REVIEW → COMPLETED |
| selfRating / managerRating / finalRating | Int? | 1–5 scale |
| reviewType | String | ANNUAL / QUARTERLY / PROBATION |

### OnboardingChecklist / OnboardingChecklistItem
Generated at employee creation. Tracks mandatory pre-activation items.

### ExitRecord / ExitChecklistItem
Generated at exit initiation. Tracks knowledge transfer, asset return, FFS.

### ProfileChangeRequest
An employee's request to change a sensitive field. Requires HR approval before the change takes effect.

---

## Invoice Entities

### Invoice
A client-facing billing document. Snapshot of client data at creation time.

| Field | Type | Notes |
|---|---|---|
| status | InvoiceStatus | DRAFT → READY_TO_SEND → SENT → VIEWED → OVERDUE → PARTIALLY_PAID / PAID / VOIDED |
| gstType | GstType | CGST_SGST (intra-state) / IGST (inter-state) / EXEMPT |
| clientName, clientGstin etc. | String | Snapshot — not FK-joined |
| grandTotal, totalPaid, outstanding | Decimal | Maintained as payments are logged |
| Unique on | (workspaceId, invoiceNumber) | |

### InvoiceLineItem
One line on an invoice. Stores per-line GST computation.

| Field | Type | Notes |
|---|---|---|
| gstRate | Decimal | Percentage (0, 5, 12, 18, 28) |
| hsnSacCode | String? | HSN for goods, SAC for services |
| cgstAmount, sgstAmount, igstAmount | Decimal | Filled based on invoice gstType |
| timeEntryId | String? | Source time entry if imported |

### Payment
A payment received against an invoice. Immutable after creation.

### CreditNote
Issued when an invoice is voided. Links to the original invoice.

### InvoiceTemplate / InvoiceTemplateLineItem
Reusable invoice configuration with pre-filled line items.

---

## Approval Entities

### ApprovalRequest
One approval workflow instance. Polymorphic via `subjectType` + `subjectId`.

| Field | Type | Notes |
|---|---|---|
| subjectType | ApprovalSubjectType | LEAVE_APPLICATION / PAYROLL_RUN / INVOICE / etc. |
| currentLevel | Int | Which level is currently active |
| totalLevels | Int | Total approval levels for this request |
| expiresAt | DateTime? | After which → EXPIRED |

### ApprovalLevel
One row per level per ApprovalRequest. Tracks escalation and delegation.

### ApprovalAction
Immutable record of each action taken on an approval request (approved, rejected, escalated, delegated).

### ApprovalDelegation
A time-bounded delegation of approval authority from one user to another of the same role.

---

## Document Entities

### Document
A stored file. Points to the file in R2/S3 via `fileKey`. Supports versioning.

| Field | Type | Notes |
|---|---|---|
| category | DocumentCategory | HR / CRM / PROJECT / INVOICE / GENERAL |
| fileHash | String? | SHA-256 integrity check |
| version | Int | Incremented on file replacement |
| previousVersionId | String? | Points to prior version |
| requiresAcknowledgement | Boolean | Employee must ack before record is complete |

### DocumentAttachment
Polymorphic junction: a Document linked to a Lead, Deal, Contact, Company, or Project.

### DocumentShare
Explicit per-user sharing. Used for documents not visible workspace-wide.

---

## Notification Entities

### Notification
One delivered notification. In-app (via Socket.IO) or email (via BullMQ + Brevo).

| Field | Type | Notes |
|---|---|---|
| type | String | Event type code: TASK_ASSIGNED, LEAVE_APPROVED, etc. |
| module | String? | Which module the resource lives in |
| resourceType, resourceId | String? | Deep link target |
| channel | NotificationChannel | IN_APP / EMAIL / BOTH |
| isRead | Boolean | In-app read state |
| emailDelivered | Boolean | Confirmed delivery from Brevo webhook |

### NotificationPreference
Per-user preference overrides stored as JSON. Controls which channels are active per notification type.

---

## Audit Entity

### AuditLog
Immutable audit trail. One row per mutation event. Protected by PostgreSQL RLS at the DB level (no DELETE/UPDATE via app DB user).

| Field | Type | Notes |
|---|---|---|
| action | AuditAction | CREATE / UPDATE / DELETE / SOFT_DELETE / APPROVE / REJECT / EXPORT / etc. |
| module | String | CRM / TASKS / HRMS / INVOICE / SYSTEM |
| entityType | String | Model name: Lead, PayrollRun, Employee, etc. |
| entityId | String | PK of the affected record |
| before | Json? | Snapshot of record state before mutation |
| after | Json? | Snapshot of record state after mutation |
| actorEmail | String | Snapshot — preserved after user deletion |
| isSensitive | Boolean | SENSITIVE_EXPORT, SALARY_CHANGE, PAYROLL_UNLOCK |
| ipAddress, userAgent, sessionId | String? | Request context |
