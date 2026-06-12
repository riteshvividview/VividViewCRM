# Permissions — VividCRM RBAC System

## Permission Model

VividCRM uses an **action-based permission model** layered on top of **data scopes**. A permission is the combination of:

```
PERMISSION = ACTION + MODULE + SCOPE
```

Where:
- **ACTION** — what operation is being performed (Create, Read, Update, Delete, Approve, Export, Assign)
- **MODULE** — which system module is being accessed (CRM, Tasks, Payroll, etc.)
- **SCOPE** — the data boundary that restricts the action (OWN, TEAM, DEPT, ALL)

A permission check is only `GRANTED` when all three components are satisfied simultaneously.

---

## Scope Definitions

Scopes are hierarchical boundaries applied to every permission. A higher scope includes all lower scopes.

| Scope Token | Meaning | Example |
|---|---|---|
| `SELF` | Only the authenticated user's own records | An employee can only read their own payslip |
| `TEAM` | Records belonging to the user's assigned team(s) | A TEAM_LEAD can read tasks created by their team members |
| `DEPT` | Records belonging to the user's department | HR can view attendance for their department |
| `ALL` | All records in the workspace | SUPER_ADMIN can read any record in the system |
| `DENY` | No access regardless of scope | EMPLOYEE has DENY on all Invoice records |
| `COND` | Conditional — access depends on a runtime rule | EMPLOYEE can Update a leave only if its status is PENDING |

Scopes enforce at the query layer via Prisma middleware — they are not UI-level filters. The API will return a `403 Forbidden` if a user attempts to access a record outside their scope.

---

## Action Definitions

### CREATE
**Definition:** The ability to instantiate a new record in a module.

**What it covers:**
- Submitting a form that writes a new row to the database
- Importing records via CSV or bulk upload
- Triggering automatic record creation (e.g., a deal closure creating an invoice draft)

**Scope implications:**
- When scope is `TEAM`, the created record is automatically attributed to the user's team
- When scope is `SELF`, the created record is automatically attributed to the authenticated user
- Creating a record on behalf of another user (impersonation) requires `ALL` scope

**Examples by module:**
- CRM/CREATE — creating a new Lead or Deal
- Payroll/CREATE — initiating a new payroll run for a period
- Leaves/CREATE — submitting a leave application
- Tasks/CREATE — adding a new task to a board

---

### READ
**Definition:** The ability to view, list, search, or retrieve one or more records.

**What it covers:**
- Viewing a single record's detail page
- Listing records in a table or board view
- Searching and filtering records
- Receiving records via API response

**Scope implications:**
- READ is the baseline permission — all other actions (Update, Delete, Approve) implicitly require READ first
- A denied READ means the record is completely invisible — it does not appear in lists, search results, or API responses
- `TEAM`-scoped READ means the user can see all records owned by any member of their team, not just their own

**Examples by module:**
- Payroll/READ (SELF) — an employee can view their own payslip
- Employees/READ (TEAM) — a TEAM_LEAD can view basic profiles of their team members
- Reports/READ (ALL) — ADMIN can view all workspace analytics

---

### UPDATE
**Definition:** The ability to modify an existing record's fields.

**What it covers:**
- Editing field values on a record detail page
- Bulk editing selected records
- Changing a record's status through a defined workflow (e.g., moving a task from In Progress to Done)
- Inline editing in table or board views

**Scope implications:**
- UPDATE requires READ permission on the same record at the same scope
- Conditional updates are permitted based on the record's current state (e.g., an EMPLOYEE can update a leave request only while it is in PENDING status)
- Some fields within a record may be locked even when UPDATE is granted (e.g., HR can update an employee's department but cannot update their salary band without SUPER_ADMIN confirmation)

**Examples by module:**
- Deals/UPDATE — changing a deal's stage or value
- Attendance/UPDATE (ALL) — HR correcting a missed clock-in
- Employees/UPDATE (SELF) — an employee updating their emergency contact information

---

### DELETE
**Definition:** The ability to remove a record from the system, either soft-delete (archived, recoverable) or hard-delete (permanent, irreversible).

**What it covers:**
- Soft-delete: record is hidden from normal views but retained in the database with a `deletedAt` timestamp
- Hard-delete: record is permanently purged from the database (restricted to SUPER_ADMIN on financial and HR records)
- Bulk deletion of multiple records

**Scope implications:**
- DELETE is the most destructive action and has the most restrictive scope assignments
- Financial records (Payroll, Invoice) and HR records (Employees, Attendance) use soft-delete only — hard-delete is blocked even for SUPER_ADMIN via application logic
- Audit log entries are never deletable by any role
- Records with active dependencies (e.g., an Employee with open Payroll records) cannot be hard-deleted — only deactivated

**Examples by module:**
- Leads/DELETE — removing a duplicate or spam lead
- Tasks/DELETE — deleting a task that was created by mistake
- Payroll/DELETE — **blocked for all roles except SUPER_ADMIN (soft-delete only)**

---

### APPROVE
**Definition:** The ability to authorise a record that is in a pending or draft state, moving it into an active or finalised state.

**What it covers:**
- Approving a leave application (PENDING → APPROVED)
- Approving a payroll run (DRAFT → FINALISED)
- Approving an invoice before it is sent to a client (DRAFT → SENT)
- Approving a performance review sign-off
- Approving an expense claim or document submission
- Rejecting a pending record (a rejection is the inverse of approval, controlled by the same permission)

**Scope implications:**
- APPROVE requires READ permission on the pending record
- A user cannot approve their own records — this is a hard system rule enforced at the API level regardless of role
- Multi-level approval chains require each level to be approved by a user at the appropriate scope

**Self-approval prohibition (universal rule):**
No user in any role can approve a record they submitted. If a TEAM_LEAD submits a leave request, their approver must be the HR role or SUPER_ADMIN — the TEAM_LEAD cannot approve it themselves even if they have APPROVE permission on Leaves.

**Examples by module:**
- Leaves/APPROVE (TEAM) — TEAM_LEAD approves their direct reports' leave applications
- Payroll/APPROVE (ALL) — HR approves the monthly payroll run
- Invoices/APPROVE (ALL) — ADMIN approves a draft invoice before sending

---

### EXPORT
**Definition:** The ability to extract records from the system as a downloadable file (CSV, Excel, PDF, or via API).

**What it covers:**
- Exporting a filtered list of records as CSV or Excel
- Generating a PDF report
- Downloading a payslip PDF
- Bulk-exporting documents from document storage
- API-based data extraction (raw JSON export)

**Scope implications:**
- EXPORT scope mirrors READ scope — a user can only export records they can read
- EXPORT is treated as a separate, audited action because it moves data outside the system boundary
- All EXPORT actions are logged in the audit trail with the actor, timestamp, filter criteria, and record count
- Export of HRMS data (particularly Payroll and Employees) triggers an additional audit log entry tagged as `SENSITIVE_EXPORT`

**Rate limiting:** Export actions are rate-limited to prevent bulk data exfiltration — maximum 5 export jobs per user per hour.

**Examples by module:**
- Reports/EXPORT (ALL) — ADMIN exports a quarterly revenue report as Excel
- Payroll/EXPORT (SELF) — an EMPLOYEE downloads their own payslip PDF
- Attendance/EXPORT (TEAM) — TEAM_LEAD exports their team's monthly attendance summary

---

### ASSIGN
**Definition:** The ability to associate a record with a user, team, department, or other entity.

**What it covers:**
- Assigning a task or project to a team member
- Assigning an employee to a department
- Assigning a lead or deal to a sales team member
- Assigning a shift to an employee
- Assigning a leave policy to a department
- Assigning a document to a user for acknowledgement
- Re-assigning a record from one user to another

**Scope implications:**
- ASSIGN requires READ on the record being assigned AND READ on the target user/team being assigned to
- TEAM-scoped ASSIGN means the user can only assign records to members within their own team — they cannot assign records to users outside their team
- Assigning a record to a deactivated user is blocked at the API level
- Reassignment of records belonging to a different team requires ALL scope

**Examples by module:**
- Tasks/ASSIGN (TEAM) — TEAM_LEAD assigns a task to one of their team members
- Employees/ASSIGN (ALL) — HR assigns an employee to a new department
- Leaves/ASSIGN (ALL) — HR assigns a leave policy type to a department
- CRM/ASSIGN (ALL) — ADMIN assigns a lead to a specific sales representative

---

## Permission Notation Key

Used throughout the permission matrix:

| Symbol | Meaning |
|---|---|
| `FULL` | Action granted with ALL scope — unrestricted access to all records in the module |
| `TEAM` | Action granted with TEAM scope — restricted to the user's assigned team(s) |
| `SELF` | Action granted with SELF scope — restricted to the authenticated user's own records only |
| `DENY` | Action explicitly denied — returns HTTP 403; record is invisible in listings |
| `COND` | Conditional access — granted only when a specified runtime condition is true |
| `READ-ONLY` | READ is granted; all mutation actions (Create, Update, Delete) are denied |
| `[n]` | Footnote — additional rule or condition applies; see authorization-rules.md |

---

## Permission Enforcement Architecture

### Layer 1 — Route Guard (NestJS)
Every API endpoint is decorated with `@Roles(Role.ADMIN, Role.HR)` (etc.). Requests from users without the required role receive `403 Forbidden` before any business logic executes.

```typescript
@Get('payroll')
@Roles(Role.SUPER_ADMIN, Role.HR)
@UseGuards(JwtAuthGuard, RolesGuard)
getPayrollRuns() { ... }
```

### Layer 2 — Scope Filter (Prisma Middleware)
A Prisma middleware intercepts every database query and injects a `where` clause based on the authenticated user's role and scope:

```typescript
// TEAM_LEAD querying tasks
prisma.$use(async (params, next) => {
  if (params.model === 'Task' && user.role === Role.TEAM_LEAD) {
    params.args.where = {
      ...params.args.where,
      assignedTeamId: { in: user.teamIds }
    }
  }
  return next(params)
})
```

### Layer 3 — Field-Level Masking (Serializer)
Even when a record is readable, certain fields are stripped from the response based on role:

```typescript
// Employee record: salary fields stripped for TEAM_LEAD and EMPLOYEE
class EmployeeResponseDto {
  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  salaryAmount: number

  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  bankAccountNumber: string
}
```

### Layer 4 — Action Validation (Service Layer)
Business rules that cannot be expressed as route guards or scope filters are enforced in the service layer:

```typescript
async approveLeave(leaveId: string, approverId: string) {
  const leave = await this.leaveRepo.findById(leaveId)
  if (leave.employeeId === approverId) {
    throw new ForbiddenException('Self-approval is not permitted')
  }
  // ...
}
```

### Layer 5 — Audit Logging
Every mutation (Create, Update, Delete, Approve) is written to the immutable audit log table with:
- `actorId` — who performed the action
- `action` — what action was performed
- `module` — which module was affected
- `recordId` — which record was modified
- `before` — record state before mutation (JSON snapshot)
- `after` — record state after mutation (JSON snapshot)
- `timestamp` — UTC timestamp
- `ipAddress` — client IP
- `sessionId` — JWT session identifier
