# Relationships — VividCRM Database Design

## Notation

```
─────  1-to-1 (one on each side)
══════ 1-to-many (double line on many side)
──┤    zero-or-one (optional)
──|    exactly-one (required)
══<    one-to-many (crow's foot)
>══<   many-to-many (via junction table)
```

---

## 1. Core Ownership Chain

Every entity is scoped to a Workspace. The Workspace is the multi-tenancy root.

```
Workspace ══< User
Workspace ══< Team
Workspace ══< Employee
Workspace ══< Department
Workspace ══< Lead
Workspace ══< Deal
Workspace ══< Contact
Workspace ══< Company
Workspace ══< Campaign
Workspace ══< Mailing
Workspace ══< Project
Workspace ══< Task
Workspace ══< Sprint
Workspace ══< PayrollRun
Workspace ══< SalaryStructure
Workspace ══< LeaveType
Workspace ══< LeavePolicy
Workspace ══< Holiday
Workspace ══< Invoice
Workspace ══< InvoiceTemplate
Workspace ══< Document
Workspace ══< Notification
Workspace ══< AuditLog
Workspace ══< ApprovalRequest
Workspace ══< ApprovalDelegation
```

---

## 2. User ↔ Employee Relationship

A User is the authentication identity. An Employee is the HRMS record. One-to-one.

```
User ──1──── Employee
│
├── assigned as TEAM_LEAD of → Team
├── member of → Team (via TeamMember)
├── assigned → Leads
├── assigned → Deals
├── assigned → Tasks (assignee or creator)
├── author of → TaskComments
├── member of → Projects (via ProjectMember)
├── logs → TimeEntries
├── performs → ApprovalActions
└── receives → Notifications
```

---

## 3. CRM Relationships

```
Campaign ──1──── Mailing (one campaign, many mailings)
Campaign ══< Lead (leads sourced by campaign)

Lead ──1──┤ Deal (optional: lead converted to deal)
Lead ──1──┤ Contact (auto-created on conversion)
Lead ──1──┤ Company (auto-linked on conversion)
Lead ══< CrmActivity (activity log)
Lead ══< DocumentAttachment

Deal ──1──┤ Contact (client contact)
Deal ──1──┤ Company (client company)
Deal ══< CrmActivity
Deal ══< DocumentAttachment
Deal ──1──┤ Project (deal won → project created)
Deal ══< Invoice (deal can have many invoices, e.g. milestone billing)

Contact ──1──┤ Company
Contact ══< Deal
Contact ══< Invoice (contact is client on invoice)
Contact ══< CrmActivity
Contact ══< DocumentAttachment

Company ══< Contact
Company ══< Deal
Company ══< Invoice
Company ══< CrmActivity
Company ══< DocumentAttachment

Mailing ══< MailingRecipient (one per email address)
```

---

## 4. Task Management Relationships

```
Project ──1──┤ Deal (optional source deal)
Project ──1──┤ Team
Project ══< Board
Project ══< Task
Project ══< Sprint
Project ══< ProjectMember (junction: Project ↔ User)
Project ══< TimeEntry
Project ══< DocumentAttachment

Board ══< BoardColumn
BoardColumn ══< Task (tasks are positioned in a column)

Sprint ══< Task (tasks assigned to sprint)

Task ──1──┤ Task (parentTaskId: subtask hierarchy, self-referential)
Task ══< Task (subtasks)
Task ──1──┤ BoardColumn (current position)
Task ──1──┤ Sprint (optional)
Task ──1──┤ User (assignee)
Task ──1──┤ User (creator)
Task ──1──┤ RecurringTaskTemplate (if generated from template)
Task ══< TaskComment
Task ══< TaskMention (via TaskComment)
Task ══< TaskWatcher
Task ══< TaskLabelAssignment
Task ══< TimeEntry

TaskComment ══< TaskMention (one per @mention in comment)
TaskLabel >══< Task (via TaskLabelAssignment)

TimeEntry ──1──┤ Task
TimeEntry ──1──┤ Project
TimeEntry ──1──┤ User
TimeEntry ──1──┤ InvoiceLineItem (when billed)
```

---

## 5. HRMS Relationships

```
Employee ──1──── User (one-to-one, required)
Employee ──1──┤ Department
Employee ──1──┤ Employee (reportingManagerId: self-referential manager chain)
Employee ──1──┤ SalaryStructure (current, denormalized for fast access)

Department ──1──┤ Department (parentDepartmentId: hierarchy, self-referential)
Department ══< Employee
Department ══< LeavePolicy (one policy per department)

Employee ══< ShiftAssignment
Shift ══< ShiftAssignment

Employee ══< AttendanceRecord (one per day)
Employee ══< ClockEvent
Employee ══< RegularisationRequest

Employee ══< LeaveBalance (one per leave type per year)
Employee ══< LeaveApplication

LeaveType ══< LeavePolicyRule
LeavePolicy ══< LeavePolicyRule (junction: Policy ↔ LeaveType)
LeaveType ══< LeaveBalance
LeaveType ══< LeaveApplication

Employee ══< SalaryStructureAssignment (history)
SalaryStructure ══< SalaryComponent
SalaryStructure ══< SalaryStructureAssignment

PayrollRun ══< PayrollLineItem (one per employee)
PayrollRun ══< Payslip (one per employee)
PayrollRun ══< Bonus

Employee ══< PayrollLineItem
Employee ══< Payslip
Employee ══< Bonus

Employee ──1──── OnboardingChecklist
OnboardingChecklist ══< OnboardingChecklistItem

Employee ──1──── ExitRecord
ExitRecord ══< ExitChecklistItem

Employee ══< PerformanceReview (as reviewee)
Employee ══< PerformanceReview (as manager/reviewer)

Employee ══< ProfileChangeRequest
```

---

## 6. Invoice Relationships

```
Invoice ──1──┤ Contact (client)
Invoice ──1──┤ Company (client company)
Invoice ──1──┤ Deal (source deal)
Invoice ──1──┤ Project (for time-entry billing)
Invoice ══< InvoiceLineItem
Invoice ══< Payment
Invoice ══< CreditNote (when voided)

InvoiceLineItem ──1──┤ TimeEntry (when imported from time tracking)

CreditNote ──1──── Invoice (the original voided invoice)

InvoiceTemplate ══< InvoiceTemplateLineItem
```

---

## 7. Approval Relationships

```
ApprovalRequest ══< ApprovalLevel (one per level in the chain)
ApprovalRequest ══< ApprovalAction (audit of each action taken)

ApprovalRequest relates to subject via (subjectType, subjectId):
  LeaveApplication.approvalRequestId → ApprovalRequest
  PayrollRun is approved directly by HR (no ApprovalRequest record needed for simple cases)
  Invoice approval is inline (approvedById on Invoice)

ApprovalDelegation ──1──── User (delegator)
ApprovalDelegation ──1──── User (delegate)

ApprovalAction ──1──── User (actor)
ApprovalAction ──1──── ApprovalRequest
```

---

## 8. Document Relationships

```
Document ══< DocumentAttachment (linked to CRM or Project entities)
  └── DocumentAttachment ──1──┤ Lead      (nullable)
  └── DocumentAttachment ──1──┤ Deal      (nullable)
  └── DocumentAttachment ──1──┤ Contact   (nullable)
  └── DocumentAttachment ──1──┤ Company   (nullable)
  └── DocumentAttachment ──1──┤ Project   (nullable)

Document ══< DocumentShare (explicit per-user sharing)
DocumentShare ──1──── User
```

---

## 9. Notification Relationships

```
Notification ──1──── User (recipient)
Notification ──1──┤ Workspace

NotificationPreference ──1──── User (one preference record per user)
```

---

## 10. Audit Relationships

```
AuditLog ──1──┤ User (actor, nullable — system actions have no actor)
AuditLog ──1──── Workspace

Note: AuditLog does NOT use FK to the subject entity.
entityType + entityId are plain strings.
This is intentional — audit logs persist after the subject record is hard-deleted.
```

---

## 11. Entity Relationship Overview (Domain Map)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          WORKSPACE                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ scopes everything
        ┌──────────────────────┼──────────────────────────────┐
        │                      │                              │
        ▼                      ▼                              ▼
   ┌─────────┐           ┌──────────┐                  ┌──────────┐
   │  USER   │─────1:1───│ EMPLOYEE │                  │   TEAM   │
   └────┬────┘           └────┬─────┘                  └────┬─────┘
        │                     │                             │
   ┌────▼────────────┐  ┌─────▼────────────────────┐  ┌────▼─────┐
   │ CRM Module      │  │ HRMS Module               │  │ TASKS    │
   │ ─────────────── │  │ ──────────────────────── │  │ Module   │
   │ Lead            │  │ Department                │  │ ──────── │
   │ Deal ───────────┼──┼▶ Attendance               │  │ Project  │
   │ Contact         │  │ Leave Application         │  │ Board    │
   │ Company         │  │ Payroll Run               │  │ Task     │
   │ Campaign        │  │ Payslip                   │  │ Sprint   │
   │ Mailing         │  │ Salary Structure          │  │ TimeEntry│
   └────┬────────────┘  └─────┬──────────────────── ┘  └────┬─────┘
        │                     │                             │
        └──────────┬──────────┘                             │
                   │                                        │
                   ▼                                        │
           ┌──────────────┐                                 │
           │   INVOICE    │◄────────────────────────────────┘
           │ ──────────── │  (time entries → invoice line items)
           │ Invoice      │
           │ LineItem     │
           │ Payment      │
           │ CreditNote   │
           └──────────────┘

            ────── Cross-cutting ──────
        ┌─────────────┬──────────────┬──────────┐
        │  APPROVALS  │  DOCUMENTS   │  AUDIT   │
        │  ─────────  │  ─────────── │  ─────── │
        │  Request    │  Document    │  AuditLog│
        │  Level      │  Attachment  │          │
        │  Action     │  Share       │          │
        │  Delegation │              │          │
        └─────────────┴──────────────┴──────────┘
```

---

## 12. Key Cardinalities Reference

| Relationship | Cardinality | Notes |
|---|---|---|
| Workspace → User | 1:N | |
| User → Employee | 1:1 | Optional (not all users are employees) |
| Employee → Department | N:1 | Optional |
| Department → Department | 1:N | Self-referential hierarchy |
| Employee → Employee | N:1 | Self-referential manager chain |
| Team → TeamMember | 1:N | |
| User → TeamMember | 1:N | User can be in multiple teams |
| Lead → Deal | 1:0..1 | One lead can convert to at most one deal |
| Deal → Project | 1:0..1 | One deal can spawn at most one project |
| Deal → Invoice | 1:N | Milestone billing: many invoices per deal |
| Project → Board | 1:N | |
| Board → BoardColumn | 1:N | Max 8 |
| Task → Task | 1:N | Subtask hierarchy (one level in practice) |
| Task → TimeEntry | 1:N | |
| TimeEntry → InvoiceLineItem | 1:0..1 | One time entry billed once |
| Employee → AttendanceRecord | 1:N | One per calendar day |
| Employee → LeaveBalance | 1:N | One per leave type per year |
| LeaveType ↔ LeavePolicy | N:M | Via LeavePolicyRule |
| SalaryStructure → SalaryComponent | 1:N | |
| Employee → SalaryStructureAssignment | 1:N | History of structure changes |
| PayrollRun → PayrollLineItem | 1:N | One per active employee |
| PayrollRun → Payslip | 1:N | One per active employee |
| Invoice → InvoiceLineItem | 1:N | |
| Invoice → Payment | 1:N | Partial payment support |
| Invoice → CreditNote | 1:N | Multiple credit notes possible |
| ApprovalRequest → ApprovalLevel | 1:N | 1–2 levels per request |
| ApprovalRequest → ApprovalAction | 1:N | Audit of every action |
| Document → DocumentAttachment | 1:N | Same doc can be attached to multiple records |
| Document → DocumentShare | 1:N | Per-user sharing |
