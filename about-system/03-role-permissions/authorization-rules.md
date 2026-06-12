# Authorization Rules — VividCRM RBAC System

## Document Purpose

This document defines the business logic authorization rules that cannot be expressed as a static role-action-module matrix. These are runtime rules that operate on the state of records, relationships between users, temporal conditions, and workflow stages. Every rule here is enforced at the **service layer** in NestJS — not at the route guard level and not in the UI.

---

## Rule Categories

1. [Universal Rules](#1-universal-rules) — apply to every role, every module, every action
2. [Self-Approval Prohibition](#2-self-approval-prohibition)
3. [Workflow State Rules](#3-workflow-state-rules)
4. [Data Ownership Transfer Rules](#4-data-ownership-transfer-rules)
5. [Cascade and Dependency Rules](#5-cascade-and-dependency-rules)
6. [Temporal Locking Rules](#6-temporal-locking-rules)
7. [Sensitive Data Access Rules](#7-sensitive-data-access-rules)
8. [Audit and Compliance Rules](#8-audit-and-compliance-rules)
9. [Role Management Rules](#9-role-management-rules)
10. [Cross-Module Authorization Rules](#10-cross-module-authorization-rules)

---

## 1. Universal Rules

These rules apply to every authenticated request, regardless of role or module.

### 1.1 — Workspace Isolation
Every database query must include a `workspaceId` filter matching the authenticated user's workspace. A user in Workspace A can never access any record from Workspace B. This is enforced at the Prisma middleware layer and cannot be bypassed by any role, including SUPER_ADMIN (a SUPER_ADMIN scoped to Workspace A cannot access Workspace B data).

```
RULE: query.where.workspaceId === session.user.workspaceId
ENFORCEMENT: Prisma middleware (before every query)
VIOLATION: HTTP 403 + audit log entry flagged as SECURITY_VIOLATION
```

### 1.2 — Deactivated Account Denial
A deactivated (soft-deleted) user account cannot authenticate. Any valid JWT belonging to a deactivated user is rejected at the auth guard level. JWTs are not revoked on deactivation — the guard checks the database status on every request.

```
RULE: employee.status !== 'TERMINATED' && user.isActive === true
ENFORCEMENT: JwtAuthGuard (on every protected route)
VIOLATION: HTTP 401 Unauthorized
```

### 1.3 — Deleted Record Invisibility
Soft-deleted records (`deletedAt IS NOT NULL`) are excluded from all queries for all roles except SUPER_ADMIN. SUPER_ADMIN can filter to include deleted records by passing `includeDeleted: true` in the query params.

```
RULE: unless role === SUPER_ADMIN, always append WHERE deletedAt IS NULL
ENFORCEMENT: Prisma middleware (global soft-delete filter)
```

### 1.4 — Read Before Mutate
No mutation action (Update, Delete, Approve, Assign) can succeed on a record the requesting user cannot Read. The service layer must first perform a scoped READ to verify the record exists and is within the user's scope before applying any mutation.

```
RULE: canRead(user, record) === true before any canUpdate/canDelete/canApprove check
ENFORCEMENT: Service layer (before every mutation operation)
VIOLATION: HTTP 404 Not Found (record appears not to exist, not 403, to prevent data probing)
```

---

## 2. Self-Approval Prohibition

**Principle:** No user at any role level can be the sole approver of a record they submitted, created, or are the primary subject of.

### 2.1 — Leave Self-Approval
An employee who submitted a leave application cannot approve it, even if their role (TEAM_LEAD) carries APPROVE permission on the Leaves module.

```
RULE: leave.applicantId !== approver.userId
APPLIES TO: All roles with Leaves/APPROVE permission
VIOLATION: HTTP 403 — "You cannot approve your own leave application"
```

### 2.2 — Payroll Self-Approval (HR)
An HR user cannot approve a payroll run in which their own salary record was modified during that run's computation.

```
RULE: payrollRun.modifiedEmployeeIds does not contain approver.employeeId
APPLIES TO: HR role (Payroll/APPROVE)
VIOLATION: HTTP 403 — "Payroll includes your own salary record. A second HR user or SUPER_ADMIN must approve."
```

### 2.3 — Invoice Self-Approval
An ADMIN user who created an invoice cannot be the same user who approves it for sending. A second ADMIN or SUPER_ADMIN must approve.

```
RULE: invoice.createdById !== approver.userId
APPLIES TO: ADMIN role (Invoices/APPROVE)
VIOLATION: HTTP 403 — "You cannot approve an invoice you created."
EXCEPTION: Single-admin workspaces where only one ADMIN exists — SUPER_ADMIN takes over the approval step.
```

### 2.4 — Employee Profile Change Approval
When an EMPLOYEE submits a change to a sensitive self-service field (bank account, tax declaration), the change enters a `PENDING_APPROVAL` state. The submitting employee cannot approve their own change.

```
RULE: profileChange.submittedById !== approver.userId
APPLIES TO: HR role (Employees/APPROVE)
VIOLATION: System blocks the approval UI for the submitting employee
```

### 2.5 — Performance Review Self-Rating Finalisation
An employee's self-assessment in a performance review is visible to their manager and HR but does not constitute an approval. The manager (TEAM_LEAD) completing the review is the approver — not the employee.

```
RULE: performanceReview.revieweeId !== reviewer.userId
APPLIES TO: TEAM_LEAD, HR (Performance review approval flow)
VIOLATION: HTTP 403 — "You cannot finalise your own performance review"
```

---

## 3. Workflow State Rules

Actions are only permitted when a record is in the correct workflow state.

### 3.1 — Leave Application State Machine

```
DRAFT → SUBMITTED → PENDING_L1 (TEAM_LEAD) → PENDING_L2 (HR, if required) → APPROVED / REJECTED

EMPLOYEE can UPDATE: only when status is DRAFT or SUBMITTED
EMPLOYEE can DELETE (withdraw): only when status is DRAFT, SUBMITTED, or PENDING_L1
TEAM_LEAD can APPROVE/REJECT: only when status is PENDING_L1
HR can APPROVE/REJECT: only when status is PENDING_L2 or PENDING_L1 (override)
HR can CANCEL: when status is APPROVED (before the leave date passes)
```

### 3.2 — Payroll Run State Machine

```
DRAFT → UNDER_REVIEW → APPROVED → FINALISED → DISBURSED

HR can UPDATE inputs: only when status is DRAFT or UNDER_REVIEW
HR can APPROVE: only when status is UNDER_REVIEW; transitions to APPROVED
SUPER_ADMIN can UPDATE: when status is APPROVED (with mandatory audit reason)
No one can UPDATE: when status is FINALISED or DISBURSED
SUPER_ADMIN can soft-DELETE: only when status is DRAFT
```

### 3.3 — Invoice State Machine

```
DRAFT → READY_TO_SEND → SENT → VIEWED → PARTIALLY_PAID → PAID → OVERDUE → VOIDED

ADMIN can UPDATE: only when status is DRAFT
ADMIN can DELETE (hard): only when status is DRAFT
ADMIN can APPROVE (send): only when status is READY_TO_SEND
SUPER_ADMIN can UPDATE: when status is SENT or later (with mandatory audit reason)
ADMIN can VOID: when status is SENT, OVERDUE, or PARTIALLY_PAID (creates a credit note, preserves the original record)
No record transitions from PAID or VOIDED to any other state
```

### 3.4 — Task State Machine

```
TODO → IN_PROGRESS → IN_REVIEW → DONE → ARCHIVED

EMPLOYEE can UPDATE status: TODO → IN_PROGRESS, IN_PROGRESS → IN_REVIEW
TEAM_LEAD can UPDATE status: any transition within their team's tasks
ADMIN / SUPER_ADMIN can UPDATE status: any transition
No role can move a task from ARCHIVED to any other state without DELETE permission (which re-creates it)
```

### 3.5 — Employee Lifecycle State Machine

```
ONBOARDING → ACTIVE → ON_LEAVE → SUSPENDED → TERMINATED

HR can transition: ONBOARDING → ACTIVE, ACTIVE → SUSPENDED, ACTIVE → ON_LEAVE
HR can initiate: ACTIVE → TERMINATED (triggers exit management workflow)
SUPER_ADMIN required: ACTIVE → TERMINATED (final confirmation), SUSPENDED → TERMINATED
TERMINATED is terminal — no state can follow it
A TERMINATED employee's system account is deactivated simultaneously
```

---

## 4. Data Ownership Transfer Rules

### 4.1 — Reassignment on User Deactivation
When a user is deactivated (TERMINATED), all open records owned by that user must be reassigned before deactivation completes. The system blocks deactivation if any of the following open records exist:

- Open CRM leads or deals (`status NOT IN ('WON', 'LOST', 'DUPLICATE')`)
- Active tasks (`status NOT IN ('DONE', 'ARCHIVED')`) where the user is the sole assignee
- Pending leave approvals the user was designated to approve
- Open invoices in `DRAFT` or `READY_TO_SEND` status

The SUPER_ADMIN or HR must bulk-reassign these records before the deactivation proceeds.

### 4.2 — Team Reassignment
When a TEAM_LEAD is deactivated or reassigned to a different team, their former team's records do not become orphaned. The system:
1. Notifies ADMIN and SUPER_ADMIN of the orphaned team
2. Blocks TEAM_LEAD deactivation until a new TEAM_LEAD is assigned to the team
3. Alternatively, ADMIN can explicitly confirm "No replacement needed" to proceed — the team's records become ADMIN-managed temporarily

### 4.3 — Department Merge/Delete
A department cannot be deleted if it has active employees. The HR or SUPER_ADMIN must first reassign all employees to another department. Once empty, the department can be soft-deleted. Soft-deleted departments are hidden from all views but their historical records (payroll cost centre, attendance summaries) retain the department reference for audit purposes.

---

## 5. Cascade and Dependency Rules

### 5.1 — Deal → Project Cascade
When a Deal is deleted, any linked Projects are not automatically deleted. The system:
- Removes the `dealId` reference from linked Projects (sets it to `null`)
- Notifies the ADMIN and the Project's TEAM_LEAD
- Projects continue to exist independently

### 5.2 — Project → Task Cascade
When a Project is soft-deleted:
- All tasks under the project are soft-deleted simultaneously
- All time entries linked to those tasks are archived (not deleted)
- Invoice line items already generated from those time entries are NOT deleted
- If a payroll run references any of those time entries, the payroll run is flagged for review

### 5.3 — Employee → All Records Cascade on Termination
When an employee is terminated:
- Their user account is deactivated immediately (auth blocked)
- Their open tasks are flagged as `UNASSIGNED` and their TEAM_LEAD is notified
- Their pending leave applications are automatically cancelled with reason `EMPLOYEE_TERMINATED`
- Their future shifts are removed from the shift schedule
- Their payroll record for the current period is flagged for final settlement computation
- Their HR documents are archived but retained for 7 years per statutory compliance
- Their CRM deal and contact assignments are NOT automatically reassigned (manual step required)

---

## 6. Temporal Locking Rules

### 6.1 — Attendance Past-Date Correction Window
Employees can clock in/out for the current day only. HR can correct attendance for any date within the past 30 calendar days. Attendance records older than 30 days require SUPER_ADMIN approval to modify, with a mandatory reason logged.

```
RULE:
  EMPLOYEE: attendance.date === today
  HR: attendance.date >= (today - 30 days)
  SUPER_ADMIN: attendance.date >= (workspaceCreatedAt) — no limit, with reason required
```

### 6.2 — Payroll Period Lock
Once a payroll period is marked `FINALISED`, no attendance, leave, or salary data from that period can be modified without SUPER_ADMIN intervention. Modifications to finalised period data require:
1. SUPER_ADMIN explicit unlock with a reason
2. Payroll re-computation
3. Second-level HR approval of the corrected run
4. Full audit trail of the original, the unlock, and the corrected values

### 6.3 — Invoice Edit Window
Once an invoice has been sent to a client (`SENT` status), ADMIN cannot edit it. If a correction is needed:
- ADMIN creates a credit note (which links to the original invoice)
- Or SUPER_ADMIN unlocks the invoice for editing with a mandatory reason logged
- Edited sent invoices generate a `INVOICE_AMENDED` audit event

### 6.4 — Leave Application Retroactive Submission
Employees cannot submit leave applications for dates that have already passed (retroactive leaves). HR can submit retroactive leave records on behalf of an employee with a mandatory reason. This creates an `HR_INITIATED_LEAVE` record type in the audit trail.

---

## 7. Sensitive Data Access Rules

### 7.1 — Salary Data Isolation
Salary, compensation, and tax data from the Payroll and Employee modules is accessible only to SUPER_ADMIN and HR. This is enforced at three levels:
1. **Route guard:** Payroll endpoints are decorated with `@Roles(SUPER_ADMIN, HR)` 
2. **Serializer exclusion:** `EmployeeResponseDto` excludes `salaryAmount`, `salaryStructureId`, `bankAccount`, `taxId` for all other roles via class-transformer `@Exclude`
3. **Prisma select:** Service methods for non-HR roles use explicit `select` clauses that omit salary fields — the data is never fetched from the database

### 7.2 — HR Document Access Isolation
Documents categorised as `HR_DOCUMENT` (offer letters, payslips, medical records, performance reviews) are only readable by:
- SUPER_ADMIN (full access)
- HR (all HR documents workspace-wide)
- The employee the document belongs to (SELF scope, their own documents only)

ADMIN, TEAM_LEAD, and other employees cannot read HR documents — even if they know the document's ID.

### 7.3 — Sensitive Export Audit
Any export action on the following data types generates a `SENSITIVE_EXPORT` audit event:
- Payroll data (any role)
- Employee personal information (name, contact, address, bank — HR and above)
- Attendance bulk export (HR and above)
- Invoice client data bulk export (ADMIN and above)

`SENSITIVE_EXPORT` events include: actor, timestamp, module, filter criteria applied, number of records exported, and the export format.

### 7.4 — Peer Salary Invisibility (HR Self-Rule)
An HR user cannot view or modify their own salary structure. When an HR user accesses the Payroll or Employee module for records including their own:
- Their own salary fields are masked in the response
- An attempt to update their own salary structure returns HTTP 403 with the reason `SELF_SALARY_MODIFICATION_DENIED`
- A second HR user or SUPER_ADMIN must handle any changes to an HR user's compensation

---

## 8. Audit and Compliance Rules

### 8.1 — Immutable Audit Log
The audit log table is append-only. No role, including SUPER_ADMIN, can delete or update audit log entries through the application. This is enforced:
1. At the application layer (no DELETE or UPDATE service methods exist for the audit log model)
2. At the database layer (a PostgreSQL row-level security policy blocks DELETE and UPDATE on the `audit_logs` table for the application database user)

### 8.2 — Mandatory Reason for Override Actions
The following actions require a free-text `reason` field (minimum 20 characters) before the action is permitted:
- SUPER_ADMIN unlocking a finalised payroll period
- SUPER_ADMIN editing a sent invoice
- SUPER_ADMIN performing a soft-delete on any financial record
- HR submitting a retroactive attendance correction older than 7 days
- HR submitting a retroactive leave on behalf of an employee
- Any role force-reassigning records from a terminated employee

The `reason` is stored on the audit log entry and is visible to all SUPER_ADMIN users.

### 8.3 — Data Retention on Termination
When an employee is terminated, the following data must be retained for the statutory minimum period and cannot be deleted:
- Payroll records: 7 years
- Attendance records: 3 years
- Leave records: 3 years
- HR documents (contracts, offer letters): 7 years
- Tax declaration records: 7 years
- Audit log entries: Indefinitely

The system must block any deletion of records within their retention period, regardless of the requesting role.

---

## 9. Role Management Rules

### 9.1 — Last SUPER_ADMIN Protection
The system must always have at least one active SUPER_ADMIN. Attempting to:
- Deactivate the last SUPER_ADMIN user
- Change the last SUPER_ADMIN's role to any other role
- Delete the last SUPER_ADMIN's account

...returns HTTP 400 with the error `LAST_SUPER_ADMIN_PROTECTION`. A new SUPER_ADMIN must be designated before the current one can be removed.

### 9.2 — Role Escalation Prohibition
No user can assign a role equal to or higher than their own:
- ADMIN cannot assign the SUPER_ADMIN role
- ADMIN cannot assign the ADMIN role
- HR cannot assign any role (HR has no role assignment permission)
- TEAM_LEAD cannot assign any role
- EMPLOYEE cannot assign any role

Only SUPER_ADMIN can assign any role, including SUPER_ADMIN.

```
RULE: assigningUser.role === SUPER_ADMIN
ENFORCEMENT: Service layer (UserService.assignRole)
VIOLATION: HTTP 403 — "Insufficient privileges to assign this role"
```

### 9.3 — Role Change Immediate Effect
When a user's role is changed:
1. The change takes effect immediately in the database
2. All existing JWTs for that user are invalidated (via a Redis `tokenVersion` counter increment)
3. The user's next request with their old token receives HTTP 401 with `TOKEN_INVALIDATED`
4. The user must re-authenticate to receive a new token with the updated role
5. A `ROLE_CHANGED` audit event is created with the old role, new role, and the SUPER_ADMIN who made the change

### 9.4 — TEAM_LEAD Team Binding
A TEAM_LEAD's scope is determined by their team assignments, not the role alone. A user with the TEAM_LEAD role but no team assigned has no more permissions than an EMPLOYEE (since their TEAM scope resolves to an empty set). The system must warn SUPER_ADMIN when a TEAM_LEAD is not assigned to any team.

---

## 10. Cross-Module Authorization Rules

### 10.1 — CRM Deal → Invoice Cross-Module Creation
When an ADMIN creates an invoice from a closed Deal:
- The system auto-populates the client from the Deal's linked Contact/Company
- The system auto-populates line items from the Deal's linked Project's time entries
- The ADMIN must have both `CRM/READ (FULL)` and `Invoices/CREATE (FULL)` — partial access blocks this workflow
- The resulting invoice is linked to the source Deal ID for audit traceability

### 10.2 — HRMS Onboarding → Task Creation Cross-Module
When HR triggers the onboarding workflow for a new employee:
- The system creates Tasks in the Task Management module
- These tasks are owned by the HRMS onboarding workflow (not by the HR user)
- The tasks are assigned to the new employee's TEAM_LEAD and to HR-designated contacts
- HR does not need Tasks/CREATE permission for this to work — it is a system-initiated action under a service account, not a user-initiated one
- The TEAM_LEAD of the new employee receives a notification and can manage these tasks with their normal TEAM scope

### 10.3 — Task Time Entries → Invoice Line Items Cross-Module
When an ADMIN imports time entries from a project into an invoice:
- Only time entries with status `APPROVED` (approved by a TEAM_LEAD) can be imported
- PENDING time entries are not eligible for invoicing
- Once a time entry is added to an invoice, it is marked `BILLED` and cannot be added to another invoice
- If the invoice is voided, the time entry status reverts from `BILLED` to `APPROVED` (making it eligible for a new invoice)

### 10.4 — Calendar Sync Source-of-Truth Rule
The Calendar module displays events from multiple sources (Tasks, Leaves, HR Events). The calendar is a read-aggregation view — events cannot be edited via the Calendar module. Mutations must happen at the source:
- Task due date events → must be changed in the Tasks module
- Leave blocks → must be changed in the Leaves module (via workflow — not direct edit)
- HR events (review cycles, holidays) → must be changed in the HRMS Settings

Attempting to directly update a synced calendar event (identified by a `sourceModule` field) returns HTTP 400 with `CALENDAR_SYNC_SOURCE_REDIRECT` and the URL of the source record.

### 10.5 — Reports Cross-Module Data Scoping
The Reports module aggregates data from multiple source modules. When a report is generated, the data scope for each source module is independently enforced:

```
User: TEAM_LEAD (teamId: T1)

Report: "Project Revenue and Team Performance"
├── Project data: filtered to TEAM_LEAD's team (T1 only)
├── Task data: filtered to TEAM_LEAD's team (T1 only)
├── Time entry data: filtered to TEAM_LEAD's team (T1 only)
├── Invoice data: DENIED (TEAM_LEAD has no Invoices/READ permission)
└── Employee salary data: DENIED (TEAM_LEAD has no Payroll/READ permission)

Result: Report renders project and task metrics only. Revenue and salary columns are hidden,
        not masked — the columns are absent from the report schema entirely.
```

---

## Enforcement Summary

| Rule Type | Enforcement Layer | Failure Response |
|---|---|---|
| Workspace isolation | Prisma middleware | HTTP 403 + SECURITY_VIOLATION audit |
| Role-based route access | NestJS route guard | HTTP 403 Forbidden |
| Data scope filtering | Prisma middleware | HTTP 404 (record appears not to exist) |
| Field-level masking | Class-transformer serializer | Fields absent from response |
| Self-approval prohibition | Service layer | HTTP 403 + descriptive message |
| Workflow state transitions | Service layer | HTTP 400 + current state + allowed transitions |
| Temporal locking | Service layer | HTTP 400 + lock reason + who can override |
| Role escalation prohibition | Service layer | HTTP 403 + "Insufficient privileges" |
| Audit log append-only | DB row-level security | SQL error (not reachable via application) |
| Last SUPER_ADMIN protection | Service layer | HTTP 400 + LAST_SUPER_ADMIN_PROTECTION |
| Sensitive data isolation | Route guard + serializer + Prisma select | HTTP 403 or fields absent from response |
