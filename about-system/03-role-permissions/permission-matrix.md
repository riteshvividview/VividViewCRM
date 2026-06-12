# Permission Matrix — VividCRM RBAC System

## Notation

| Symbol | Meaning |
|---|---|
| `FULL` | Granted — all records in workspace, no restriction |
| `TEAM` | Granted — restricted to own team's records only |
| `SELF` | Granted — restricted to own records only |
| `DENY` | Denied — HTTP 403; record invisible in listings |
| `COND` | Conditional — see footnote; depends on runtime state |
| `—` | Not applicable — action type has no meaning in this module |

Actions: **C** = Create · **R** = Read · **U** = Update · **D** = Delete · **A** = Approve · **E** = Export · **AS** = Assign

---

## Module: CRM

Covers: Leads, Deals, Contacts, Companies, Campaigns, Mailing

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `DENY` | `TEAM` [1] | `DENY` |
| **Read** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Update** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Delete** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Assign** | `FULL` | `FULL` | `DENY` | `TEAM` [2] | `DENY` |

**Footnotes:**
- [1] TEAM_LEAD can only create records (e.g., leads) that are attributed to their own team. They cannot create records for other teams.
- [2] TEAM_LEAD can only assign CRM records to users within their own team. Assigning to users outside the team requires ADMIN or SUPER_ADMIN.

---

## Module: Tasks

Covers: Tasks, Subtasks, Comments, Activity Logs, Time Tracking, Recurring Tasks

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `DENY` | `TEAM` | `SELF` [3] |
| **Read** | `FULL` | `FULL` | `DENY` | `TEAM` | `SELF` [4] |
| **Update** | `FULL` | `FULL` | `DENY` | `TEAM` | `SELF` [5] |
| **Delete** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Approve** | `FULL` | `FULL` | `DENY` | `TEAM` [6] | `DENY` |
| **Export** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Assign** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |

**Footnotes:**
- [3] EMPLOYEE can create tasks only on projects they are a member of; the task is self-attributed by default.
- [4] EMPLOYEE can only read tasks they are explicitly assigned to or tasks they created. They cannot browse all tasks in a project.
- [5] EMPLOYEE can update status, comments, and time entries on tasks assigned to them. They cannot change the task's assignee, priority tier, or due date.
- [6] TEAM_LEAD can approve time-tracking entries submitted by their team members.

---

## Module: Projects

Covers: Projects, Boards, Sprints, Sprint Goals, Project Members

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `DENY` | `TEAM` [7] | `DENY` |
| **Read** | `FULL` | `FULL` | `DENY` | `TEAM` | `SELF` [8] |
| **Update** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Delete** | `FULL` | `FULL` | `DENY` | `DENY` [9] | `DENY` |
| **Approve** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `DENY` | `TEAM` | `DENY` |
| **Assign** | `FULL` | `FULL` | `DENY` | `TEAM` [10] | `DENY` |

**Footnotes:**
- [7] TEAM_LEAD can create projects for their own team. Projects created by TEAM_LEAD are automatically scoped to that team.
- [8] EMPLOYEE can read projects they are explicitly added to as a project member. They cannot browse the full project list.
- [9] Projects cannot be deleted by TEAM_LEAD even within their own team — deletion requires ADMIN or SUPER_ADMIN due to cascade risk on tasks, time entries, and invoices.
- [10] TEAM_LEAD can add or remove members from projects they own, but only from within their team's user pool.

---

## Module: Attendance

Covers: Daily Attendance Records, Clock-In/Out Logs, Shift Attendance, Manual Attendance Marking

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `DENY` | `FULL` | `DENY` | `SELF` [11] |
| **Read** | `FULL` | `DENY` | `FULL` | `TEAM` | `SELF` |
| **Update** | `FULL` | `DENY` | `FULL` [12] | `DENY` | `DENY` |
| **Delete** | `FULL` | `DENY` | `DENY` [13] | `DENY` | `DENY` |
| **Approve** | `FULL` | `DENY` | `FULL` [14] | `DENY` | `DENY` |
| **Export** | `FULL` | `DENY` | `FULL` | `TEAM` | `DENY` |
| **Assign** | `FULL` | `DENY` | `FULL` [15] | `DENY` | `DENY` |

**Footnotes:**
- [11] EMPLOYEE can clock in and clock out (which creates/updates an attendance record for the current day). They cannot create attendance records for past or future dates.
- [12] HR can correct attendance records (e.g., fix a missed clock-in). All corrections are logged in the audit trail with the reason and the original value.
- [13] Attendance records are never hard-deleted. If marked in error, they are flagged as `VOIDED` with a reason. Only SUPER_ADMIN can perform soft-delete.
- [14] HR approves regularisation requests — where an employee has requested correction of their own attendance due to a system error.
- [15] HR assigns shift schedules to employees or departments (e.g., assign the "Night Shift" schedule to a department).

---

## Module: Leaves

Covers: Leave Applications, Leave Balances, Leave Policies, Leave Types, Holiday Calendar

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `DENY` | `FULL` | `DENY` | `SELF` |
| **Read** | `FULL` | `DENY` | `FULL` | `TEAM` | `SELF` |
| **Update** | `FULL` | `DENY` | `FULL` | `DENY` | `COND` [16] |
| **Delete** | `FULL` | `DENY` | `FULL` | `DENY` | `COND` [17] |
| **Approve** | `FULL` | `DENY` | `FULL` | `TEAM` [18] | `DENY` |
| **Export** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Assign** | `FULL` | `DENY` | `FULL` [19] | `DENY` | `DENY` |

**Footnotes:**
- [16] EMPLOYEE can update their own leave application only while its status is `PENDING`. Once approved or rejected, the leave is immutable.
- [17] EMPLOYEE can withdraw (soft-delete) their own leave application only while its status is `PENDING`. Approved leaves cannot be cancelled by the employee — only by HR.
- [18] TEAM_LEAD can approve or reject leave applications from their direct reports. If the leave requires HR confirmation (e.g., medical leave over 3 days), TEAM_LEAD approval triggers a second-level approval request to HR.
- [19] HR assigns leave policies (e.g., which employees are eligible for Earned Leave vs. Casual Leave) and manages the annual leave balance allocation.

---

## Module: Payroll

Covers: Payroll Runs, Payslips, Salary Structures, Deductions, Bonuses, Tax Computations

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `DENY` | `FULL` [20] | `DENY` | `DENY` |
| **Read** | `FULL` | `DENY` | `FULL` | `DENY` | `SELF` [21] |
| **Update** | `FULL` | `DENY` | `FULL` [22] | `DENY` | `DENY` |
| **Delete** | `FULL` [23] | `DENY` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `DENY` | `FULL` [24] | `DENY` | `DENY` |
| **Export** | `FULL` | `DENY` | `FULL` | `DENY` | `SELF` [25] |
| **Assign** | `FULL` | `DENY` | `FULL` [26] | `DENY` | `DENY` |

**Footnotes:**
- [20] HR initiates payroll runs for a given month/period. They cannot initiate a payroll run for a period that has already been finalised.
- [21] EMPLOYEE can read only their own payslips. They cannot view the payslip of any other employee, including peers in their own team.
- [22] HR can update payroll inputs (attendance corrections, bonus additions, advance deductions) only while the payroll run is in `DRAFT` status. Once approved, the run is immutable.
- [23] Payroll records are soft-delete only. Hard-delete of any payroll record is blocked at the application layer. SUPER_ADMIN can perform soft-delete only on payroll runs in `DRAFT` status.
- [24] HR approves the final payroll run after review. Approval triggers payslip generation (BullMQ job) and marks the run as `FINALISED`. Approval requires HR self-exclusion — HR cannot approve a run where their own salary was modified.
- [25] EMPLOYEE can download their own payslip as a PDF. This action is logged as a `SENSITIVE_EXPORT` in the audit trail.
- [26] HR assigns salary structures (bands, components, deduction templates) to employees. Salary structure changes require a reason note and are logged.

---

## Module: Employees

Covers: Employee Profiles, Personal Information, Employment Details, Documents, Emergency Contacts

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Read** | `FULL` | `COND` [27] | `FULL` | `COND` [28] | `SELF` |
| **Update** | `FULL` | `DENY` | `FULL` [29] | `DENY` | `COND` [30] |
| **Delete** | `FULL` [31] | `DENY` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `DENY` | `FULL` [32] | `DENY` | `DENY` |
| **Export** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Assign** | `FULL` | `DENY` | `FULL` [33] | `DENY` | `DENY` |

**Footnotes:**
- [27] ADMIN can read a limited employee profile: name, role, team, department, and work email. Fields hidden from ADMIN: salary, bank account, tax details, personal documents, emergency contact, performance ratings.
- [28] TEAM_LEAD can read a limited profile of their own team members: name, work email, designation, and department. All HR-sensitive fields (salary, leaves balance, attendance rate, personal info) are hidden.
- [29] HR can update all employee fields except system role (role changes require SUPER_ADMIN). HR cannot update their own salary structure to prevent conflict of interest.
- [30] EMPLOYEE can update: personal contact number, emergency contact, home address, and profile photo. Fields they cannot update: designation, department, work email, salary, role, banking information.
- [31] Employee records are never hard-deleted. SUPER_ADMIN can deactivate (soft-delete) an employee, which blocks login and marks the record as `TERMINATED`. Full-and-final payroll must be completed before deactivation is permitted.
- [32] HR approves changes to sensitive employee data submitted via self-service (e.g., employee changes their bank account — HR must review and approve before it takes effect).
- [33] HR assigns employees to departments, reporting managers, and work locations.

---

## Module: Departments

Covers: Department Records, Reporting Structures, Department-Level Settings

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Read** | `FULL` | `FULL` | `FULL` | `SELF` [34] | `SELF` [34] |
| **Update** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Delete** | `FULL` [35] | `DENY` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `FULL` | `DENY` | `DENY` |
| **Assign** | `FULL` | `DENY` | `FULL` | `DENY` | `DENY` |

**Footnotes:**
- [34] TEAM_LEAD and EMPLOYEE can read the name and head of their own department only. They cannot browse or list all departments.
- [35] A department cannot be deleted if it has active employees. It must first be emptied (all employees reassigned or terminated). Only SUPER_ADMIN can perform this operation.

---

## Module: Invoices

Covers: Invoice Records, Line Items, GST Computation, Payment Logs, Client Billing Statements

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Read** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Update** | `FULL` | `FULL` [36] | `DENY` | `DENY` | `DENY` |
| **Delete** | `FULL` | `COND` [37] | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `FULL` [38] | `DENY` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Assign** | `FULL` | `FULL` [39] | `DENY` | `DENY` | `DENY` |

**Footnotes:**
- [36] ADMIN can update invoice fields only while the invoice is in `DRAFT` status. Once an invoice has been sent to the client (`SENT` status or later), only SUPER_ADMIN can make modifications, and all changes are logged.
- [37] ADMIN can delete invoices only in `DRAFT` status. Sent, paid, or cancelled invoices cannot be deleted by ADMIN — they can only be voided (a status transition that preserves the record).
- [38] ADMIN approves (finalises) draft invoices before sending. This approval marks the invoice as `READY_TO_SEND` and initiates PDF generation.
- [39] ADMIN assigns invoices to a client (Contact or Company from CRM) and optionally to a project for time-entry billing.

---

## Module: Reports

Covers: Dashboard Analytics, Saved Reports, Scheduled Reports, Revenue Reports, HR Reports, Team Reports

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `COND` [40] | `DENY` | `DENY` |
| **Read** | `FULL` | `FULL` | `COND` [41] | `COND` [42] | `DENY` |
| **Update** | `FULL` | `FULL` | `COND` [40] | `DENY` | `DENY` |
| **Delete** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `COND` [41] | `COND` [42] | `DENY` |
| **Assign** | `FULL` | `FULL` | `DENY` | `DENY` | `DENY` |

**Footnotes:**
- [40] HR can create and update reports that draw exclusively from HRMS data sources (Attendance, Leaves, Payroll, Employee records). HR cannot create reports that join with CRM or Invoice data.
- [41] HR can read and export reports scoped to HRMS data only. Attempting to view a report that includes CRM pipeline or Invoice revenue data returns `403 Forbidden`.
- [42] TEAM_LEAD can read and export reports scoped to their own team's data only: task completion rates, sprint velocity, individual time entries for their team. They cannot view reports across other teams.

---

## Module: Documents

Covers: File Storage, Document Attachments, Employee Documents, CRM Documents, Shared Workspace Files

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `FULL` | `TEAM` | `SELF` [43] |
| **Read** | `FULL` | `FULL` | `COND` [44] | `TEAM` | `COND` [45] |
| **Update** | `FULL` | `FULL` | `COND` [44] | `TEAM` | `SELF` [46] |
| **Delete** | `FULL` | `FULL` | `COND` [47] | `TEAM` [48] | `SELF` [49] |
| **Approve** | `FULL` | `FULL` | `FULL` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `COND` [44] | `TEAM` | `SELF` |
| **Assign** | `FULL` | `FULL` | `FULL` | `TEAM` | `DENY` |

**Footnotes:**
- [43] EMPLOYEE can upload documents to their own employee profile (personal documents) and to tasks they are assigned to.
- [44] HR can read, update, and export documents categorised as HR documents (employee contracts, payslips, performance reviews, ID proofs). HR cannot access CRM-category documents (client proposals, deal contracts) unless explicitly shared.
- [45] EMPLOYEE can read documents that have been explicitly shared with them or their team, and their own employee profile documents.
- [46] EMPLOYEE can update metadata (rename) and replace a file they uploaded, only if the document has not yet been approved/acknowledged.
- [47] HR can delete HR-category documents. SUPER_ADMIN is required to permanently delete any document that has been through an approval workflow.
- [48] TEAM_LEAD can delete documents uploaded within their team's project scope. They cannot delete documents that are linked to HR or Invoice records.
- [49] EMPLOYEE can delete documents they uploaded, only while those documents have not been acknowledged or approved.

---

## Module: Calendar

Covers: Events, Meetings, Task Due Dates (synced), Holiday Entries, Leave Blocks (synced)

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `FULL` | `FULL` | `TEAM` | `SELF` |
| **Read** | `FULL` | `FULL` | `FULL` [50] | `TEAM` | `SELF` [51] |
| **Update** | `FULL` | `FULL` | `FULL` [50] | `TEAM` [52] | `SELF` [52] |
| **Delete** | `FULL` | `FULL` | `COND` [53] | `TEAM` [52] | `SELF` [52] |
| **Approve** | `FULL` | `FULL` | `FULL` | `DENY` | `DENY` |
| **Export** | `FULL` | `FULL` | `FULL` | `TEAM` | `SELF` |
| **Assign** | `FULL` | `FULL` | `FULL` | `TEAM` | `DENY` |

**Footnotes:**
- [50] HR reads and updates the workspace-wide calendar for HR events: holiday declarations, review cycle dates, company-wide events. HR cannot edit task due dates or CRM meeting events owned by ADMIN.
- [51] EMPLOYEE can see their own events, task due dates for tasks assigned to them, approved leave blocks, and company-wide public events (holidays). They cannot see other employees' calendars.
- [52] TEAM_LEAD and EMPLOYEE can update or delete only events they created. Auto-synced entries (task due dates, leave approvals) cannot be manually modified through the calendar — they must be changed at the source.
- [53] HR can delete company holiday entries. HR cannot delete leave blocks (those are managed through the Leaves module) or task-synced events.

---

## Module: Settings

Covers: Workspace Configuration, Module Toggles, Integration Keys, Role Management, Email/Notification Settings, Billing

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | `FULL` | `COND` [54] | `DENY` | `DENY` | `DENY` |
| **Read** | `FULL` | `COND` [55] | `COND` [56] | `DENY` | `DENY` |
| **Update** | `FULL` | `COND` [54] | `COND` [56] | `DENY` | `DENY` |
| **Delete** | `FULL` | `DENY` | `DENY` | `DENY` | `DENY` |
| **Approve** | `FULL` | `DENY` | `DENY` | `DENY` | `DENY` |
| **Export** | `FULL` | `COND` [55] | `DENY` | `DENY` | `DENY` |
| **Assign** | `FULL` | `COND` [57] | `DENY` | `DENY` | `DENY` |

**Footnotes:**
- [54] ADMIN can create and update settings within their operational scope: CRM pipeline stages, task priority labels, project categories, email notification preferences, and invoice templates. ADMIN cannot touch: role assignments, workspace billing, module enable/disable toggles, integration API keys, or audit log configuration.
- [55] ADMIN can read workspace name, logo, timezone, and CRM/task/invoice configuration settings. ADMIN cannot read: billing details, user role assignments, integration secrets, or audit configuration.
- [56] HR can read and update HRMS-scoped settings only: leave types and policies, holiday calendars, shift templates, payroll period configuration, and performance review cycle settings.
- [57] ADMIN can assign CRM pipeline stages to deal types and assign task labels to project categories. ADMIN cannot assign roles to users — that is exclusively SUPER_ADMIN.

---

## Summary Matrix — Actions Granted by Role

> Count of modules where each action is granted (FULL or scoped), out of 13 modules total.

| Action | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Create** | 13/13 | 7/13 | 6/13 | 5/13 | 3/13 |
| **Read** | 13/13 | 9/13 | 8/13 | 8/13 | 6/13 |
| **Update** | 13/13 | 8/13 | 7/13 | 5/13 | 3/13 |
| **Delete** | 13/13 | 6/13 | 4/13 | 3/13 | 2/13 |
| **Approve** | 13/13 | 7/13 | 6/13 | 3/13 | 0/13 |
| **Export** | 13/13 | 9/13 | 8/13 | 5/13 | 2/13 |
| **Assign** | 13/13 | 8/13 | 7/13 | 4/13 | 0/13 |
