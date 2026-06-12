# Audit Strategy — VividCRM Database Design

## Purpose

The audit system provides an immutable, queryable record of every significant mutation in the platform. It serves four functions:

1. **Compliance** — payroll, HR, and financial records require change history for statutory audits (tax, labour law)
2. **Security** — detect unauthorized access, privilege escalation, and data exfiltration
3. **Debugging** — reconstruct exactly what happened and when for support and incident response
4. **Trust** — give SUPER_ADMINs visibility into who changed what, across all modules

---

## Audit Log Table Design

```prisma
model AuditLog {
  id          String      @id @default(cuid())
  workspaceId String
  action      AuditAction

  // Actor
  actorId    String?     // null for system-initiated actions
  actorRole  Role?       // role at time of action (snapshot)
  actorEmail String      // preserved even if user is later deleted

  // Subject
  module     String      // CRM | TASKS | HRMS | INVOICE | SYSTEM
  entityType String      // Lead | PayrollRun | Employee | Invoice ...
  entityId   String      // PK of the affected record

  // Change data
  before     Json?       // full record state before mutation
  after      Json?       // full record state after mutation

  // Context
  reason      String?    // mandatory for sensitive overrides
  isSensitive Boolean    // SENSITIVE_EXPORT, PAYROLL_UNLOCK, SALARY_CHANGE

  // Request
  ipAddress String?
  userAgent String?
  sessionId String?

  createdAt DateTime @default(now())
}
```

### Why `actorEmail` is Snapshotted

When an employee is terminated, their User account is deactivated and may eventually be anonymised. The `actorId` FK becomes a dangling reference if the user is purged. Storing `actorEmail` as a plain string at the time of action preserves the audit trail permanently, independent of user lifecycle operations. The FK `actorId` is kept as nullable for active user lookups.

### Why `entityType` is a String (Not an Enum)

Adding new modules in Phase 2 or Phase 3 (marketplace extensions) should not require a database migration to the AuditLog table. A string `entityType` is flexible. The valid values are documented and validated at the service layer.

---

## Audit Actions Catalogue

| Action | Description | Modules |
|---|---|---|
| `CREATE` | New record created | All |
| `UPDATE` | Existing record field(s) changed | All |
| `DELETE` | Record soft-deleted | All |
| `SOFT_DELETE` | Explicit soft-delete (same as DELETE in practice, tagged separately for clarity) | All |
| `RESTORE` | Soft-deleted record restored | All |
| `APPROVE` | Approval action: leave, payroll, invoice, etc. | Leaves, Payroll, Invoice, Approvals |
| `REJECT` | Rejection action on an approval | Leaves, Payroll, Invoice, Approvals |
| `ESCALATE` | Approval escalated to next level | Approvals |
| `EXPORT` | Records exported as CSV/Excel/PDF | All |
| `LOGIN` | Successful authentication | System |
| `LOGOUT` | Session terminated | System |
| `ROLE_CHANGE` | User's role was modified | System |
| `PERMISSION_CHANGE` | Workspace-level permission config changed | System |
| `PAYROLL_UNLOCK` | Finalised payroll run unlocked for correction | Payroll |
| `SALARY_CHANGE` | Employee salary structure or CTC changed | HRMS |

---

## What Gets Audited — Module by Module

### CRM

| Entity | Audited Actions | Sensitive? | `before`/`after` Included? |
|---|---|---|---|
| Lead | CREATE, UPDATE (status changes), DELETE | No | Yes — status transitions |
| Deal | CREATE, UPDATE (status, value, assignee), DELETE | No | Yes |
| Contact | CREATE, UPDATE, DELETE | No | No (too noisy for field edits) |
| Company | CREATE, UPDATE, DELETE | No | No |
| Campaign | CREATE, UPDATE, DELETE | No | No |
| Mailing | CREATE, sent (as UPDATE), DELETE | No | Status transitions only |

CRM activities (CrmActivity table) handle the detailed per-field change log for Leads and Deals. AuditLog captures the higher-level action.

---

### Task Management

| Entity | Audited Actions | Sensitive? | Notes |
|---|---|---|---|
| Project | CREATE, status transitions (DELETE) | No | Status changes only |
| Task | CREATE, status transitions, assignee changes | No | Not all field edits |
| TimeEntry | APPROVE, REJECT, BILLED | No | Status transitions |
| Sprint | CREATE, COMPLETED | No | |

Time Entry approval and billing events are the most important here — they feed into financial records.

---

### HRMS — Employees

| Entity | Audited Actions | Sensitive? | `before`/`after`? |
|---|---|---|---|
| Employee (create) | CREATE | No | Yes |
| Employee (status change) | UPDATE | No | Yes |
| Employee (salary change) | SALARY_CHANGE | **Yes** | Yes — before/after salary values |
| Employee (role assignment) | ROLE_CHANGE | **Yes** | Yes |
| Employee (bank details change) | UPDATE | **Yes** | Yes — but bank account numbers are masked in the `after` JSON |
| Employee (PAN/Aadhaar change) | UPDATE | **Yes** | Values masked |
| ProfileChangeRequest (approved) | APPROVE | **Yes** | Yes — field name + before/after |
| Employee (termination) | DELETE (soft) | No | Yes — full record snapshot |

**Masking rule:** For sensitive fields (bank account, PAN, Aadhaar), the `before` and `after` JSON stores the last 4 characters only: `"**** **** 4321"`. The full value is never written to the audit log.

---

### HRMS — Attendance

| Entity | Audited Actions | Sensitive? | Notes |
|---|---|---|---|
| AttendanceRecord (HR correction) | UPDATE | No | before/after status included |
| RegularisationRequest (approve/reject) | APPROVE / REJECT | No | |
| AttendanceRecord bulk export | EXPORT | **Yes** | isSensitive = true; record count logged |

---

### HRMS — Leave

| Entity | Audited Actions | Sensitive? | Notes |
|---|---|---|---|
| LeaveApplication (submit) | CREATE | No | |
| LeaveApplication (approve L1/L2) | APPROVE | No | Actor + level recorded |
| LeaveApplication (reject) | REJECT | No | Reason required |
| LeaveApplication (cancel) | UPDATE | No | Cancellation reason logged |
| LeaveBalance (year-end allocation) | CREATE | No | System actor |
| LeaveBalance (manual adjustment by HR) | UPDATE | No | Reason required |

---

### HRMS — Payroll

| Entity | Audited Actions | Sensitive? | `before`/`after`? |
|---|---|---|---|
| PayrollRun (initiate) | CREATE | No | |
| PayrollRun (submit for review) | UPDATE | No | |
| PayrollRun (approve) | APPROVE | **Yes** | Yes — total figures |
| PayrollRun (finalise) | UPDATE | **Yes** | |
| PayrollRun (disburse) | UPDATE | **Yes** | |
| PayrollRun (PAYROLL_UNLOCK) | PAYROLL_UNLOCK | **Yes** | Yes — unlock reason mandatory |
| PayrollLineItem (HR override) | UPDATE | **Yes** | Yes — before/after net salary |
| Payslip (download by employee) | EXPORT | **Yes** | isSensitive = true |
| Payslip bulk export (HR) | EXPORT | **Yes** | isSensitive = true; count logged |
| Bonus (added to run) | CREATE | **Yes** | Amount and type logged |
| SalaryStructureAssignment | SALARY_CHANGE | **Yes** | Yes — old/new structure ID + CTC |

---

### Invoice

| Entity | Audited Actions | Sensitive? | Notes |
|---|---|---|---|
| Invoice (create) | CREATE | No | |
| Invoice (approve/send) | APPROVE | No | |
| Invoice (SUPER_ADMIN edit post-send) | UPDATE | **Yes** | Reason mandatory |
| Invoice (void) | UPDATE | No | Void reason logged |
| Payment (recorded) | CREATE | No | Amount + method logged |
| Invoice bulk export | EXPORT | **Yes** | isSensitive = true |

---

### System

| Entity | Audited Actions | Sensitive? | Notes |
|---|---|---|---|
| User (login) | LOGIN | No | IP + user agent logged |
| User (failed login) | LOGIN | No | failure flag in metadata |
| User (role change) | ROLE_CHANGE | **Yes** | Old role + new role in before/after |
| User (deactivate) | UPDATE | No | |
| Workspace (settings change) | UPDATE | No | Which settings changed |
| ApprovalDelegation (created) | CREATE | No | |

---

## Audit Log Implementation

### NestJS Interceptor

A global `AuditInterceptor` wraps every mutating API call:

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest()
    const { user, ip, headers } = req

    // Record before state if needed (injected by service before this interceptor)
    const beforeSnapshot = req._auditBefore ?? null

    return next.handle().pipe(
      tap(async (response) => {
        // AuditContext set by the service layer on mutations
        if (req._auditContext) {
          await this.auditService.log({
            workspaceId: user.workspaceId,
            actorId: user.id,
            actorRole: user.role,
            actorEmail: user.email,
            action: req._auditContext.action,
            module: req._auditContext.module,
            entityType: req._auditContext.entityType,
            entityId: req._auditContext.entityId,
            before: beforeSnapshot,
            after: req._auditContext.after,
            reason: req._auditContext.reason,
            isSensitive: req._auditContext.isSensitive ?? false,
            ipAddress: ip,
            userAgent: headers['user-agent'],
            sessionId: user.sessionId,
          })
        }
      }),
    )
  }
}
```

### Service Layer Contract

Every service method that mutates a sensitive record sets `req._auditContext`:

```typescript
async approvePayrollRun(runId: string, hrUser: User, req: Request): Promise<void> {
  const run = await this.payrollRepo.findById(runId)

  req._auditBefore = {
    status: run.status,
    totalNet: run.totalNet,
    approvedByHrId: run.approvedByHrId,
  }

  await this.payrollRepo.approve(runId, hrUser.id)

  req._auditContext = {
    action: AuditAction.APPROVE,
    module: 'HRMS',
    entityType: 'PayrollRun',
    entityId: runId,
    after: { status: 'APPROVED', approvedByHrId: hrUser.id },
    isSensitive: true,
  }
}
```

### Async Audit Writes

Audit log writes are fire-and-forget via BullMQ to avoid adding latency to the API response:

```typescript
// AuditService
async log(entry: CreateAuditLogDto): Promise<void> {
  await this.auditQueue.add('write-audit-log', entry, {
    removeOnComplete: true,
    removeOnFail: false,  // keep failed audit jobs for investigation
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  })
}
```

The BullMQ worker writes the AuditLog record synchronously. If the write fails after 3 attempts, the job remains in the failed queue for manual inspection — audit log failures are never silently swallowed.

---

## Database-Level Protection

### Row-Level Security (RLS)

The PostgreSQL application user (`vividcrm_app`) is granted INSERT only on `audit_logs`. No UPDATE or DELETE is possible from the application layer:

```sql
-- Create restricted app user
CREATE USER vividcrm_app WITH PASSWORD '...';
GRANT SELECT, INSERT ON audit_logs TO vividcrm_app;
-- UPDATE and DELETE are intentionally NOT granted

-- For all other tables: full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vividcrm_app;
REVOKE UPDATE, DELETE ON audit_logs FROM vividcrm_app;
```

A separate `vividcrm_admin` user (used only for migrations and emergency admin) has full access. Its credentials are not embedded in the application environment.

### Trigger-Based Integrity (Optional Phase 2)

For maximum tamper-proofing in a compliance context, add a PostgreSQL trigger that prevents any UPDATE or DELETE via any user:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. Mutations are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
```

---

## Audit Log Retention and Archiving

| Data Classification | Retention Period | Storage Tier |
|---|---|---|
| Payroll-related audit entries | 7 years | Hot (primary DB) for 2 years; then cold (S3/R2 export) |
| HR-related audit entries | 7 years | Same as payroll |
| Invoice-related audit entries | 7 years | Same |
| Authentication logs (LOGIN/LOGOUT) | 1 year | Hot for 90 days; then cold |
| Task and CRM audit entries | 3 years | Hot for 1 year; then cold |
| Sensitive exports (`isSensitive = true`) | 7 years | Hot for 2 years; then cold |

**Archiving process (BullMQ cron, runs monthly):**
1. Query `audit_logs` for records older than the hot retention threshold
2. Export to JSON/NDJSON, upload to R2/S3 with path: `/audit-archive/{workspaceId}/{year}/{month}.ndjson.gz`
3. Delete archived records from primary DB
4. Record the archive operation itself as an AuditLog entry (type: `EXPORT`, module: `SYSTEM`)

---

## Sensitive Export Tagging

Any time data leaves the system boundary (CSV, Excel, PDF, API batch), an audit entry with `isSensitive = true` is created. The entry records:

```json
{
  "action": "EXPORT",
  "module": "HRMS",
  "entityType": "PayrollRun",
  "entityId": "payroll_run_2025_03",
  "isSensitive": true,
  "after": {
    "format": "EXCEL",
    "recordCount": 47,
    "filters": { "month": 3, "year": 2025 },
    "exportedAt": "2025-03-31T11:42:00Z"
  }
}
```

Rate-limiting rule (enforced at the service layer): maximum 5 sensitive exports per user per hour. Excess requests return HTTP 429. The rate-limit check + rejection is itself logged as an audit entry.

---

## Audit Query Patterns

Common queries the SUPER_ADMIN audit dashboard will run:

```sql
-- All actions by a specific user in the last 30 days
SELECT * FROM audit_logs
WHERE workspace_id = $1
  AND actor_id = $2
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Full history of a specific record
SELECT * FROM audit_logs
WHERE workspace_id = $1
  AND entity_type = 'PayrollRun'
  AND entity_id = $2
ORDER BY created_at ASC;

-- All sensitive exports in the last 7 days
SELECT * FROM audit_logs
WHERE workspace_id = $1
  AND is_sensitive = true
  AND action = 'EXPORT'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- All role changes ever
SELECT * FROM audit_logs
WHERE workspace_id = $1
  AND action = 'ROLE_CHANGE'
ORDER BY created_at DESC;

-- All payroll unlocks
SELECT * FROM audit_logs
WHERE workspace_id = $1
  AND action = 'PAYROLL_UNLOCK'
ORDER BY created_at DESC;
```

All of these queries are served by the composite indexes defined in `indexing-strategy.md`.

---

## CRM Activity Log vs AuditLog

These are two distinct systems with different purposes:

| Dimension | CrmActivity | AuditLog |
|---|---|---|
| **Purpose** | User-facing activity feed ("here's what happened on this lead") | Security/compliance audit trail ("who changed what and when") |
| **Visibility** | Visible to ADMIN, TEAM_LEAD in the UI | Visible only to SUPER_ADMIN |
| **Granularity** | Every user note, call log, email, status change | Only significant mutations |
| **Retention** | Same as the parent CRM record | Independent, long-term retention |
| **Mutability** | Immutable (append-only) | Immutable (DB-enforced) |
| **Scope** | CRM module only | All modules |
| **Before/After** | Metadata JSON (loose) | Typed before/after snapshots |

Both are append-only. CrmActivity is the human-readable history; AuditLog is the machine-readable compliance record.
