# Indexing Strategy — VividCRM Database Design

## Principles

1. **Every foreign key gets an index** — Prisma does not auto-index FKs in PostgreSQL; every FK used in a JOIN or `where` clause needs an explicit `@@index`
2. **Composite indexes lead with the highest-cardinality column last** — `[workspaceId, status]` not `[status, workspaceId]` because workspaceId is used as the primary tenant filter on every query
3. **Covering indexes for hot read paths** — list views that filter + sort on the same columns get composite indexes that cover both
4. **No over-indexing write-heavy tables** — AttendanceRecord, ClockEvent, AuditLog are high-write; indexes are kept minimal (PK + critical FKs only)
5. **Partial indexes via PostgreSQL raw SQL** — Prisma's `@@index` covers most cases; a few partial indexes (e.g., only ACTIVE employees) are added via migration SQL for performance-critical paths
6. **Unique constraints as implicit indexes** — `@@unique` creates an index automatically; not duplicated with `@@index`

---

## Index Catalog

### Workspace

| Index | Columns | Type | Purpose |
|---|---|---|---|
| PK | id | unique | Record lookup |
| slug | slug | unique | Workspace lookup by slug (login flow) |

---

### User

| Index | Columns | Type | Purpose |
|---|---|---|---|
| PK | id | unique | |
| unique email | (workspaceId, email) | unique | Login lookup; prevent duplicate emails per workspace |
| workspace | workspaceId | btree | Scope filter on all user queries |
| workspace_role | (workspaceId, role) | btree | Fetch all ADMINs, all HR users for approval routing |
| workspace_active | (workspaceId, isActive) | btree | Filter active users for assignment dropdowns |

---

### Team / TeamMember

| Index | Columns | Type | Purpose |
|---|---|---|---|
| team_workspace | workspaceId | btree | List teams in workspace |
| member_team | teamId | btree | Members of a team |
| member_user | userId | btree | Teams a user belongs to |
| member_unique | (teamId, userId) | unique | Prevent duplicate membership |

---

### Lead

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | "Show me all NEW leads" |
| workspace_assignee | (workspaceId, assignedToId) | btree | "My leads" view |
| workspace_team | (workspaceId, teamId) | btree | Team-scoped lead views |
| workspace_created | (workspaceId, createdAt) | btree | Recent leads; sorted lists |
| workspace_email | (workspaceId, email) | btree | Duplicate detection on import |

**Partial index (raw SQL migration):**
```sql
CREATE INDEX idx_leads_active ON leads (workspace_id, assigned_to_id, created_at)
  WHERE deleted_at IS NULL;
```

---

### Deal

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Pipeline board grouping |
| workspace_assignee | (workspaceId, assignedToId) | btree | "My deals" |
| workspace_team | (workspaceId, teamId) | btree | Team pipeline view |
| workspace_closed | (workspaceId, closedAt) | btree | Revenue reports by close date |
| workspace_expected | (workspaceId, expectedCloseDate) | btree | Forecast reports |

---

### Contact / Company

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Active contacts filter |
| workspace_company | (workspaceId, companyId) | btree | Contacts by company |
| contact_email_unique | (workspaceId, email) | unique | Deduplication |

---

### CrmActivity

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| lead | leadId | btree | Activity feed per lead |
| deal | dealId | btree | Activity feed per deal |
| contact | contactId | btree | Activity feed per contact |
| company | companyId | btree | Activity feed per company |
| workspace_created | (workspaceId, createdAt) | btree | Global activity feed |

---

### Project

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Active projects list |
| workspace_team | (workspaceId, teamId) | btree | Team-scoped project views |
| workspace_deal | (workspaceId, dealId) | btree | Find project from deal |

---

### Task

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Cross-project board views |
| workspace_assignee | (workspaceId, assigneeId) | btree | "My tasks" view — critical path |
| project | projectId | btree | Project task list |
| project_status | (projectId, status) | btree | Kanban board columns per project |
| sprint | sprintId | btree | Sprint backlog |
| parent | parentTaskId | btree | Subtask list of parent |
| workspace_due | (workspaceId, dueDate) | btree | Overdue task reporting; due-today view |

**Partial indexes:**
```sql
-- My open tasks (most common query in the app)
CREATE INDEX idx_tasks_open_assignee ON tasks (workspace_id, assignee_id, due_date)
  WHERE status NOT IN ('DONE', 'CANCELLED', 'ARCHIVED') AND deleted_at IS NULL;

-- Overdue tasks (BullMQ daily check)
CREATE INDEX idx_tasks_overdue ON tasks (workspace_id, assignee_id)
  WHERE status NOT IN ('DONE', 'CANCELLED', 'ARCHIVED')
    AND due_date < NOW()
    AND deleted_at IS NULL;
```

---

### TimeEntry

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| task | taskId | btree | Time on a task |
| project | projectId | btree | Project time summary |
| user | userId | btree | My time entries |
| user_date | (userId, date) | btree | Daily timesheet view |
| project_status | (projectId, status) | btree | Find APPROVED entries to invoice |
| invoice | invoiceId | btree | Time entries on an invoice |

---

### Sprint

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| project | projectId | btree | Sprints in a project |
| project_status | (projectId, status) | btree | Find ACTIVE sprint per project |

---

### RecurringTaskTemplate

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Find ACTIVE templates |
| workspace_next | (workspaceId, nextGenerateAt) | btree | BullMQ job: find templates due for generation |

---

### Employee

| Index | Columns | Type | Purpose |
|---|---|---|---|
| PK + userId unique | userId | unique | User → Employee lookup (1:1) |
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Active employees list |
| workspace_dept | (workspaceId, departmentId) | btree | Department roster |
| workspace_manager | (workspaceId, reportingManagerId) | btree | Direct reports of a manager |

**Partial index:**
```sql
CREATE INDEX idx_employees_active ON employees (workspace_id, department_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_employees_probation_due ON employees (workspace_id, probation_end_date)
  WHERE probation_status = 'UNDER_PROBATION';
```

---

### AttendanceRecord

| Index | Columns | Type | Purpose |
|---|---|---|---|
| unique | (employeeId, date) | unique | One record per employee per day; fast upsert |
| workspace | workspaceId | btree | Tenant scope |
| employee | employeeId | btree | Employee's attendance history |
| employee_date | (employeeId, date) | btree | Date-range attendance queries |
| workspace_date | (workspaceId, date) | btree | Department-wide attendance on a given day |
| workspace_status | (workspaceId, status) | btree | Absent/late reports across workspace |

> **Note:** This table grows at ~30 rows/employee/month. For a 100-employee workspace: 36,000 rows/year. Indexes are critical but kept tight. Avoid full-table scans with `WHERE` always filtering on `workspaceId` + date range.

---

### ClockEvent

| Index | Columns | Type | Purpose |
|---|---|---|---|
| employee | employeeId | btree | All clock events for an employee |
| employee_time | (employeeId, timestamp) | btree | Today's clock events; attendance computation |

> No workspaceId on this table — always queried via employeeId.

---

### LeaveBalance

| Index | Columns | Type | Purpose |
|---|---|---|---|
| unique | (employeeId, leaveTypeId, year) | unique | One balance per type per year |
| employee | employeeId | btree | All balances for an employee |
| workspace | workspaceId | btree | Workspace-wide balance reports |

---

### LeaveApplication

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| employee | employeeId | btree | Employee's leave history |
| employee_status | (employeeId, status) | btree | Pending applications for an employee |
| workspace_start | (workspaceId, startDate) | btree | Leaves in a date range (calendar view) |
| workspace_status | (workspaceId, status) | btree | All pending approvals for HR |

---

### PayrollRun

| Index | Columns | Type | Purpose |
|---|---|---|---|
| unique | (workspaceId, month, year) | unique | One run per period |
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Find DRAFT or APPROVED run |

---

### PayrollLineItem / Payslip

| Index | Columns | Type | Purpose |
|---|---|---|---|
| unique | (payrollRunId, employeeId) | unique | One line per employee per run |
| payrollRun | payrollRunId | btree | All line items in a run |
| employee | employeeId | btree | Employee's payroll history |

---

### Invoice

| Index | Columns | Type | Purpose |
|---|---|---|---|
| unique | (workspaceId, invoiceNumber) | unique | Invoice number lookup |
| workspace | workspaceId | btree | Tenant scope |
| workspace_status | (workspaceId, status) | btree | Outstanding invoices view |
| workspace_contact | (workspaceId, contactId) | btree | Client billing history |
| workspace_company | (workspaceId, companyId) | btree | Company billing history |
| workspace_due | (workspaceId, dueDate) | btree | Overdue detection (BullMQ cron) |
| workspace_deal | (workspaceId, dealId) | btree | Deal → Invoices |

**Partial index:**
```sql
-- Overdue check (runs daily via BullMQ)
CREATE INDEX idx_invoices_overdue_check ON invoices (workspace_id, due_date)
  WHERE status IN ('SENT', 'VIEWED', 'PARTIALLY_PAID') AND deleted_at IS NULL;
```

---

### ApprovalRequest

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_type | (workspaceId, subjectType) | btree | HR dashboard: all pending leave approvals |
| workspace_status | (workspaceId, status) | btree | All PENDING approvals |
| subject | subjectId | btree | Find approval for a specific record |

---

### Notification

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| recipient | recipientId | btree | All notifications for a user |
| recipient_unread | (recipientId, isRead) | btree | Unread notification count badge |
| recipient_created | (recipientId, createdAt) | btree | Notification feed (sorted by time) |

> Notifications table grows quickly. Consider archiving or partitioning by `createdAt` once a workspace exceeds ~1M rows. Implement TTL cleanup (BullMQ job) to delete notifications older than 90 days.

---

### AuditLog

| Index | Columns | Type | Purpose |
|---|---|---|---|
| workspace | workspaceId | btree | Tenant scope |
| workspace_entity | (workspaceId, entityType, entityId) | btree | Audit trail for a specific record |
| workspace_actor | (workspaceId, actorId) | btree | Actions by a specific user |
| workspace_action | (workspaceId, action) | btree | All EXPORT actions; all ROLE_CHANGE actions |
| workspace_created | (workspaceId, createdAt) | btree | Time-range audit queries |
| workspace_sensitive | (workspaceId, isSensitive) | btree | Sensitive action dashboard |

> AuditLog is append-only and will be the largest table in the system at scale. Partition by `created_at` month using PostgreSQL declarative partitioning once the workspace exceeds ~5M rows. This is a Phase 2 concern.

---

## Query Pattern → Index Map

The most critical read paths and the indexes that serve them:

| Query | Index Used |
|---|---|
| "My assigned tasks" (most frequent) | `idx_tasks_open_assignee` (partial) |
| Kanban board for a project | `(projectId, status)` on tasks |
| Pipeline by status (CRM) | `(workspaceId, status)` on deals |
| Attendance for a department today | `(workspaceId, date)` on attendance_records |
| Pending leave approvals (HR inbox) | `(workspaceId, status)` on leave_applications |
| Overdue invoices (daily cron) | `idx_invoices_overdue_check` (partial) |
| Employee payslip history | `employeeId` on payslips |
| Audit trail for a record | `(workspaceId, entityType, entityId)` on audit_logs |
| Unread notification count | `(recipientId, isRead)` on notifications |
| Recurring templates due to fire | `(workspaceId, nextGenerateAt)` on recurring_task_templates |

---

## PostgreSQL-Specific Recommendations

### Connection Pooling
Use **PgBouncer** in transaction mode (or Supabase's built-in pooler). NestJS + Prisma creates one connection per query worker; without pooling, a 50-user workspace will exhaust PostgreSQL's default `max_connections = 100`.

### VACUUM and AUTOVACUUM
- `attendance_records`, `clock_events`, `audit_logs`, `notifications` receive high insert rates — ensure autovacuum is aggressive on these tables
- `tasks`, `deals`, `leads` receive frequent UPDATEs (status changes) — autovacuum must reclaim dead tuples

```sql
ALTER TABLE audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);
```

### `pg_trgm` for Full-Text Search
Install the `pg_trgm` extension for fuzzy search on leads, contacts, tasks, and companies:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_leads_name_trgm ON leads USING gin (
  (first_name || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(email, '')) gin_trgm_ops
) WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_name_trgm ON contacts USING gin (
  (first_name || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(email, '')) gin_trgm_ops
) WHERE deleted_at IS NULL;
```

### `uuid_generate_v4` vs cuid
The schema uses cuid (string PKs). PostgreSQL UUID v4 is an alternative. cuid is chosen for its URL-safety and non-guessable sequential prefix for debugging. The tradeoff is slightly larger storage (25 bytes vs 16 bytes UUID). Not significant at projected scale.
