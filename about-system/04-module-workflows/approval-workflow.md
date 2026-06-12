# Approval Workflow — VividCRM

## Purpose

This document defines the cross-module approval engine that powers every approval process in VividCRM. Rather than each module implementing its own ad-hoc approval logic, all approvals follow a unified pattern with configurable levels, escalation, delegation, and expiry. This enables consistent behaviour, a single audit trail, and a unified notification system.

---

## 1. Approval Request Lifecycle

### Universal State Machine

All approval requests — regardless of module — follow this state machine:

```
                    ┌──────────────┐
                    │   PENDING    │  ← Created when a record enters approval state
                    └──────┬───────┘
                           │
              ┌────────────┼──────────────────┐
              │            │                  │
              ▼            ▼                  ▼
       ┌──────────┐  ┌──────────┐     ┌──────────────┐
       │UNDER_    │  │ESCALATED │     │   EXPIRED    │
       │REVIEW    │  │          │     │              │
       └────┬─────┘  └────┬─────┘     └──────────────┘
            │             │
       ┌────┴──────┐  ┌───┴───────┐
       │           │  │           │
       ▼           ▼  ▼           ▼
  ┌──────────┐ ┌────────┐ ┌────────────┐
  │ APPROVED │ │REJECTED│ │  APPROVED  │
  └──────────┘ └────────┘ └────────────┘
```

### States

| State | Description |
|---|---|
| `PENDING` | Request created; assigned to approver(s); no action taken yet |
| `UNDER_REVIEW` | An approver has opened the request but not yet acted |
| `ESCALATED` | Approver did not act within the escalation window; request moved to a higher level |
| `APPROVED` | Request accepted; downstream action triggered |
| `REJECTED` | Request declined; reason recorded; submitter notified |
| `EXPIRED` | No action taken within the expiry window; auto-rejected or re-queued |
| `WITHDRAWN` | Submitter cancelled the request before approval was given |

---

## 2. Approval Request Types by Module

| Approval Type | Module | Level 1 Approver | Level 2 Approver | Notes |
|---|---|---|---|---|
| Leave Application (≤ 2 days) | Leaves | TEAM_LEAD | — | Single-level |
| Leave Application (> 2 days) | Leaves | TEAM_LEAD | HR | Two-level |
| Medical / Sick Leave (> 3 days) | Leaves | TEAM_LEAD | HR | L2 requires medical document |
| Maternity / Paternity Leave | Leaves | — | HR | L2 only; HR directly |
| Unpaid Leave | Leaves | TEAM_LEAD | HR | Always two-level |
| Comp-Off Leave | Leaves | — | — | Auto-approved if balance exists |
| Attendance Regularisation | Attendance | — | HR | HR directly |
| Time Entry (for billing) | Tasks | TEAM_LEAD | — | Single-level |
| Employee Profile Change (sensitive) | Employees | — | HR | HR directly |
| Payroll Run | Payroll | — | HR | HR is primary; SUPER_ADMIN secondary |
| Invoice (before sending) | Invoice | ADMIN | — | Single-level; self-approval prohibited |
| Onboarding Checklist Completion | Employees | — | HR | HR signs off on onboarding |
| Exit Clearance (each item) | Employees | Assigned actor | HR | Per-item; HR final sign-off |
| Probation Confirmation | Employees | TEAM_LEAD (review) | HR (decision) | Two-level |
| Performance Review Sign-off | Employees | TEAM_LEAD (fill) | HR (finalise) | Two-level |
| Document Acknowledgement | Documents | — | HR / ADMIN | Assigned at document level |

---

## 3. Approval Routing Engine

When a record enters an approval state, the routing engine determines the approval chain:

```
[Record submitted for approval]
       │
       ▼
[Routing Engine evaluates]
  ├── Read approval config for this {module} + {subtype} + {conditions}
  │
  ├── Determine approval levels:
  │     L1: role = TEAM_LEAD + scope = submitter's team
  │     L2: role = HR (or ADMIN for Invoice)
  │
  ├── For each level, identify the approver:
  │     L1 → find active TEAM_LEAD(s) for submitter's team
  │           If multiple TEAM_LEADs: any one can approve (first to act wins)
  │     L2 → find active HR user(s)
  │           If multiple HR users: any one can approve
  │
  ├── Is the submitter the same as the L1 approver?
  │     Yes → Skip L1; escalate directly to L2
  │     No  → Route to L1
  │
  └── Approval request record created per level

[Approver(s) notified for the current active level]
```

### Team Lead Unavailability Handling

```
[L1 approver (TEAM_LEAD) is on leave or suspended]
       │
       ▼
[System checks]
  └── Is TEAM_LEAD on approved leave for today?
        Yes → Auto-escalate to L2 (HR for leave; ADMIN for tasks)
        No  → Route normally

[TEAM_LEAD suspension]
  └── Pending approvals auto-reassigned to HR as temporary approver
```

---

## 4. Multi-Level Approval Chain Flow

```
[Two-level approval: L1 = TEAM_LEAD, L2 = HR]

SUBMITTED
    │
    ▼
[L1 Approval Request created — status: PENDING]
[TEAM_LEAD notified]
    │
    ├── TEAM_LEAD approves
    │         │
    │         ▼
    │   [L1 Approval Record: APPROVED]
    │   [L2 Approval Request created — status: PENDING]
    │   [HR notified]
    │         │
    │         ├── HR approves
    │         │         │
    │         │         ▼
    │         │   [L2 Approval Record: APPROVED]
    │         │   [Record.status → APPROVED]
    │         │   [Downstream actions triggered]
    │         │   [Submitter notified: APPROVED]
    │         │
    │         └── HR rejects
    │                   │
    │                   ▼
    │             [L2 Approval Record: REJECTED]
    │             [Record.status → REJECTED]
    │             [Submitter notified: REJECTED with L2 reason]
    │             [TEAM_LEAD notified: REJECTED]
    │
    └── TEAM_LEAD rejects
              │
              ▼
        [L1 Approval Record: REJECTED]
        [L2 never created]
        [Record.status → REJECTED]
        [Submitter notified: REJECTED with L1 reason]
```

---

## 5. Escalation Workflow

Escalation triggers when an approver does not act within the configured window:

```
[Approval Request created — status: PENDING]
[Escalation timer starts]
       │
       │ Escalation window elapsed (default: 48h, configurable per approval type)
       ▼
[BullMQ job: CHECK_APPROVAL_ESCALATION]
  ├── Is request still PENDING or UNDER_REVIEW?
  │     No  → Already acted on; skip
  │     Yes → Escalate
  │
  ├── Escalation action (per config):
  │     NOTIFY_ONLY → reminder sent to original approver + manager notified
  │     REASSIGN    → request moved to next-level approver
  │     AUTO_APPROVE → request auto-approved (only for low-risk types like comp-off)
  │     AUTO_REJECT → request auto-rejected (rare; used for time-sensitive approvals)
  │
  └── Audit log: APPROVAL_ESCALATED entry

[Escalated approver notified]
[Original approver notified that request was escalated away from them]
```

### Escalation Matrix

| Approval Type | Escalation Window | Escalation Action |
|---|---|---|
| Leave (≤ 2 days, L1) | 24 hours | NOTIFY_ONLY → 48h → REASSIGN to HR |
| Leave (> 2 days, L1) | 24 hours | NOTIFY_ONLY → 48h → REASSIGN to HR |
| Leave (L2) | 48 hours | NOTIFY_ONLY → 72h → NOTIFY SUPER_ADMIN |
| Attendance Regularisation | 48 hours | NOTIFY_ONLY → 72h → AUTO_APPROVE |
| Time Entry | 48 hours | NOTIFY_ONLY → 72h → NOTIFY ADMIN |
| Payroll Run | 24 hours | NOTIFY SUPER_ADMIN → 48h → SUPER_ADMIN takes over |
| Invoice | 48 hours | NOTIFY SUPER_ADMIN | |
| Employee Profile Change | 72 hours | NOTIFY_ONLY → 96h → AUTO_APPROVE (non-financial fields) |

---

## 6. Delegation Workflow

An approver can delegate their approval authority to another user of the same role while they are unavailable:

```
[TEAM_LEAD going on leave — delegates approval authority]
       │
       ▼
[TEAM_LEAD opens Settings → Delegation]
  ├── Delegate to: (select another TEAM_LEAD in the workspace)
  ├── Delegation period: start date → end date
  └── Scope: ALL / specific approval types (e.g., only Leaves, not Time Entries)

[Delegation record saved]
[Delegate notified: "You have been granted approval authority for {period}"]

[During delegation period]
  └── All approval requests for the original TEAM_LEAD's team
        are routed to the delegate instead

[After delegation period ends]
  └── Routing reverts to original TEAM_LEAD automatically
        Any pending requests with the delegate are reassigned back
```

### Delegation Rules

- An HR user cannot delegate to a non-HR role
- A TEAM_LEAD can only delegate to another TEAM_LEAD (same role)
- Delegation does not transfer the delegating user's data access — only approval actions
- Delegation is logged: all approvals made by a delegate are tagged with `delegatedFor: {original approver userId}` in the audit trail
- A user can only have one active delegation at a time (no chained delegation)

---

## 7. Self-Approval Prevention

Enforced universally across all approval types:

```
[Approval request submitted]
       │
       ▼
[Routing engine checks: is submitter === approver?]
  ├── Submitter is the TEAM_LEAD for their own team's leave request
  │     → Skip L1; route directly to L2 (HR)
  │
  ├── HR user approving a payroll run that includes their own salary modification
  │     → Block approval; require second HR or SUPER_ADMIN to approve
  │
  ├── ADMIN approving their own invoice
  │     → Block; require second ADMIN or SUPER_ADMIN
  │
  └── Employee submitting profile change: HR approves
        → HR cannot approve their own profile change (second HR or SUPER_ADMIN required)
```

---

## 8. Approval Audit Trail

Every approval action creates an immutable audit record:

| Field | Value |
|---|---|
| `approvalRequestId` | UUID of the approval request |
| `module` | Which module owns the subject record |
| `recordId` | ID of the record being approved |
| `recordType` | LEAVE / TIME_ENTRY / PAYROLL_RUN / INVOICE / etc. |
| `level` | L1 / L2 / ESCALATION |
| `action` | APPROVED / REJECTED / ESCALATED / DELEGATED / WITHDRAWN |
| `actorId` | User who performed the action |
| `delegatedForId` | Original approver (if this was a delegation) |
| `reason` | Reason text (mandatory for REJECTED and ESCALATED) |
| `timestamp` | UTC timestamp |
| `ipAddress` | Actor's IP |
| `sessionId` | JWT session at time of action |

---

## 9. Approval Notification Events

| Event | Recipients | Channel |
|---|---|---|
| New approval request (L1) | L1 approver | In-app (real-time) + email |
| New approval request (L2) | L2 approver | In-app (real-time) + email |
| Approval granted | Submitter, next-level approver (if any) | In-app + email |
| Approval rejected | Submitter, previous level approvers | In-app + email |
| Escalation reminder | Current approver | In-app + email |
| Escalation reassignment | New approver, original approver | In-app + email |
| Delegation activated | Delegate | In-app + email |
| Delegation ended | Delegate, original approver | In-app |
| Request expired | Submitter, all approvers | In-app + email |
| Request withdrawn | Active approver (L1 or L2) | In-app |

---

## 10. Approval SLA Targets

Target response times per approval type (tracked for HR/management reporting):

| Approval Type | Target Response Time | SLA Breach Threshold |
|---|---|---|
| Leave (any) | 8 business hours | 24 business hours |
| Attendance Regularisation | 24 hours | 48 hours |
| Time Entry | 24 hours | 48 hours |
| Payroll Run | 4 business hours | 8 business hours |
| Invoice | 8 business hours | 24 business hours |
| Employee Profile Change | 24 hours | 72 hours |
| Probation Review | 72 hours | 7 days |
| Performance Review | 7 days | 14 days |
| Exit Clearance Item | 48 hours | 72 hours |

SLA breaches are surfaced in the HR Reports module as "Pending Approvals SLA Report" — showing which approvers are consistently missing SLA targets.
