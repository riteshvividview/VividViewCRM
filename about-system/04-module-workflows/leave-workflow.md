# Leave Workflow — VividCRM

## Entities Covered
Leave Application · Leave Balance · Leave Policy · Leave Type · Holiday Intersection

---

## 1. Leave Application Lifecycle

### State Machine

```
                         ┌───────────┐
                         │   DRAFT   │  ← Employee fills form but does not submit
                         └─────┬─────┘
                               │
                               │ Employee submits
                               ▼
                         ┌───────────┐
                         │ SUBMITTED │
                         └─────┬─────┘
                               │
              ┌────────────────┼──────────────────┐
              │                │                  │
              ▼                ▼                  ▼
     ┌─────────────┐  ┌──────────────┐   ┌──────────────┐
     │PENDING_L1   │  │  APPROVED    │   │  REJECTED    │
     │(TEAM_LEAD)  │  │ (auto if no  │   │ (auto reject │
     └──────┬──────┘  │ L1 required) │   │  if expired) │
            │         └──────────────┘   └──────────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌──────────┐  ┌──────────┐
│PENDING_L2│  │ REJECTED │
│  (HR)    │  │(by TL)   │
└────┬─────┘  └──────────┘
     │
┌────┴────┐
│         │
▼         ▼
┌────────┐ ┌──────────┐
│APPROVED│ │ REJECTED │
│        │ │ (by HR)  │
└────┬───┘ └──────────┘
     │
     ▼
┌──────────┐
│CANCELLED │  ← Post-approval cancellation (before leave date, by HR only)
└──────────┘
```

### States

| State | Description |
|---|---|
| `DRAFT` | Saved by employee, not yet submitted |
| `SUBMITTED` | Submitted; routing to approver(s) in progress |
| `PENDING_L1` | Awaiting TEAM_LEAD approval (Level 1) |
| `PENDING_L2` | Awaiting HR approval (Level 2 — for certain leave types or durations) |
| `APPROVED` | Fully approved; leave recorded on calendar and attendance |
| `REJECTED` | Declined at L1 or L2; leave not granted |
| `CANCELLED` | Approved leave cancelled before the leave date (by HR or employee before PENDING state) |
| `WITHDRAWN` | Withdrawn by employee (only while in DRAFT, SUBMITTED, or PENDING_L1) |
| `EXPIRED` | Application not acted on within the approval window; auto-rejected |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `DRAFT` | Employee starts leave form | EMPLOYEE | Leave balance preview shown; conflicts checked |
| `DRAFT` | `SUBMITTED` | Employee clicks "Submit" | EMPLOYEE | Balance tentatively reserved; routing determined |
| `DRAFT` | (deleted) | Employee discards draft | EMPLOYEE | No balance impact |
| `SUBMITTED` | `PENDING_L1` | Routing requires TEAM_LEAD | System | TEAM_LEAD notified |
| `SUBMITTED` | `APPROVED` | Leave type requires no approval (e.g., comp-off) | System | Calendar and attendance updated |
| `PENDING_L1` | `PENDING_L2` | TEAM_LEAD approves; leave type requires L2 | TEAM_LEAD | HR notified |
| `PENDING_L1` | `APPROVED` | TEAM_LEAD approves; L2 not required | TEAM_LEAD | See Approval Flow |
| `PENDING_L1` | `REJECTED` | TEAM_LEAD rejects | TEAM_LEAD | Reason required; employee notified; balance released |
| `PENDING_L1` | `WITHDRAWN` | Employee withdraws before TL acts | EMPLOYEE | Balance released; TL notified |
| `PENDING_L2` | `APPROVED` | HR approves | HR | See Approval Flow |
| `PENDING_L2` | `REJECTED` | HR rejects | HR | Reason required; employee and TL notified; balance released |
| `APPROVED` | `CANCELLED` | HR cancels approved leave | HR | Reason required; balance restored; calendar updated; employee notified |
| `PENDING_L1` | `EXPIRED` | No action within 48h (configurable) | System | Balance released; employee and TL notified |
| `PENDING_L2` | `EXPIRED` | No action within 48h after L1 | System | Balance released; all parties notified |

---

## 2. Leave Approval Routing Logic

Which approval levels are required is determined at submission time based on the leave type and duration:

```
[Employee submits leave application]
       │
       ▼
[System reads Leave Policy for this employee's department and leave type]
       │
       ▼
Routing decision:

Leave type = CASUAL LEAVE or EARNED LEAVE
  Duration ≤ 2 days?
    → L1 only (TEAM_LEAD)
  Duration > 2 days?
    → L1 + L2 (TEAM_LEAD then HR)

Leave type = SICK LEAVE
  Duration ≤ 3 days?
    → L1 only (TEAM_LEAD)
  Duration > 3 days?
    → L1 + L2 (mandatory medical document required at L2)

Leave type = MATERNITY / PATERNITY LEAVE
  → L2 only (HR directly — no TEAM_LEAD approval required)
  → HR must verify statutory eligibility

Leave type = COMP_OFF (compensatory off)
  → No approval required (auto-APPROVED if comp-off balance exists)

Leave type = UNPAID_LEAVE
  → L1 + L2 always (regardless of duration)
  → TEAM_LEAD must acknowledge; HR must approve

[Route set; approver(s) notified]
```

---

## 3. Leave Balance Lifecycle

### Balance Allocation Flow

```
[Start of leave policy year (April 1 or January 1 — configurable)]
       │
       ▼
[BullMQ job runs for each active employee]
  ├── Read employee's department and leave policy
  ├── For each leave type in the policy:
  │     └── Allocate annual entitlement to employee's balance
  │           (e.g., Earned Leave: 15 days, Casual: 12 days, Sick: 10 days)
  └── Save new balance records

[Balance visible to employee immediately]
```

### Balance During Application Lifecycle

| Leave Application State | Balance Effect |
|---|---|
| `DRAFT` | Balance shown as preview only; nothing reserved |
| `SUBMITTED` / `PENDING_L1` / `PENDING_L2` | Balance tentatively reserved (shown as "Pending" in balance view) |
| `APPROVED` | Balance officially deducted |
| `REJECTED` / `WITHDRAWN` / `EXPIRED` | Tentative reservation released; balance restored |
| `CANCELLED` | Deducted balance restored |

### Balance Carry-Forward Rules

```
[End of policy year]
       │
       ▼
[BullMQ job per employee]
  For each leave type:
    ├── Check carry-forward policy:
    │     MAX_CARRY_FORWARD = 0 → unused balance lapses
    │     MAX_CARRY_FORWARD = N days → carry forward min(unused, N)
    │     MAX_CARRY_FORWARD = UNLIMITED → carry forward all unused days
    │
    ├── Apply carry-forward to new year balance
    └── Lapsed days logged in balance history (not recoverable)

[Employee notified of carry-forward amount and lapse (if any)]
```

---

## 4. Leave Type Configuration

HR configures leave types per workspace. Each leave type has:

| Configuration Field | Description |
|---|---|
| `name` | Display name (Earned Leave, Sick Leave, etc.) |
| `code` | System code (EL, SL, CL, ML, PL, CO, UPL) |
| `annualEntitlement` | Days granted per year |
| `accrualType` | ANNUAL_UPFRONT / MONTHLY_ACCRUAL |
| `carryForwardLimit` | Max days carry-forwardable (0 = none) |
| `encashable` | Whether unused balance can be encashed at year-end |
| `requiresDocument` | Mandatory attachment for applications of this type |
| `minAdvanceNotice` | Minimum days before leave date the application must be submitted |
| `maxConsecutiveDays` | Maximum consecutive days allowed per application |
| `approvalLevels` | L1_ONLY / L1_AND_L2 / L2_ONLY / NONE |
| `genderRestriction` | NONE / FEMALE_ONLY / MALE_ONLY (for maternity/paternity) |

---

## 5. Leave Conflict Detection

At submission time, the system checks for conflicts before routing:

```
[Employee submits leave for dates D1 to D2]
       │
       ▼
[Conflict checks]
  ├── Does date range overlap with an existing APPROVED or PENDING leave?
  │     Yes → Error: "You already have leave on {date}"
  │
  ├── Are any of the days HOLIDAY or WEEKEND? (per shift and holiday calendar)
  │     Yes → Exclude those days from the duration calculation (auto)
  │
  ├── Does the employee have sufficient balance?
  │     Insufficient → Error: "Insufficient {leave type} balance. Available: {N} days"
  │
  ├── Does the application violate minAdvanceNotice?
  │     Yes → Error: "This leave type requires {N} days advance notice"
  │
  └── Does the application exceed maxConsecutiveDays?
        Yes → Error: "Maximum consecutive days for this leave type is {N}"

[All checks pass → leave submitted]
```

---

## 6. Leave Calendar Sync

When a leave is `APPROVED`:

```
[Leave.status → APPROVED]
       │
       ▼
[Calendar entries created]
  ├── Employee's calendar: leave block for each day in the date range
  │     (visible only to employee, their TEAM_LEAD, and HR)
  │
  └── Team calendar: anonymised indicator ("Team member on leave")
        (visible to all project members of the employee's team)

[Attendance records pre-set]
  └── For each leave day: attendance.status = LEAVE
```

When a leave is `CANCELLED`:

```
[Calendar entries removed]
[Attendance records reverted to system-computed status]
  └── If employee clocked in on those days → PRESENT
      If employee did not clock in → ABSENT (regularisation may then be needed)
```

---

## 7. Leave Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Leave submitted | TEAM_LEAD (if L1 required), HR (if L2 only) | In-app + email |
| L1 action required | TEAM_LEAD | In-app + email |
| L1 approved (L2 needed) | HR | In-app + email |
| L1 approved (no L2) | Employee | In-app + email |
| L1 rejected | Employee | In-app + email |
| L2 approved | Employee, TEAM_LEAD | In-app + email |
| L2 rejected | Employee, TEAM_LEAD | In-app + email |
| Leave cancelled by HR | Employee, TEAM_LEAD | In-app + email |
| Leave withdrawn by employee | TEAM_LEAD (if pending L1), HR (if pending L2) | In-app |
| Leave expired (no action) | Employee, pending approver | In-app + email |
| Balance low (< 2 days remaining) | Employee | In-app |
| Year-end carry-forward summary | Employee | Email |
