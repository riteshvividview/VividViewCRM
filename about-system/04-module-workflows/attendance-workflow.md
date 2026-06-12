# Attendance Workflow — VividCRM

## Entities Covered
Attendance Record · Clock Event · Regularisation Request · Shift · Holiday

---

## 1. Daily Attendance Record Lifecycle

### State Machine

```
                    ┌──────────────┐
                    │   ABSENT     │  ← Default state at start of each working day
                    └──────┬───────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
              ▼            ▼                ▼
       ┌──────────┐  ┌──────────┐   ┌────────────┐
       │ PRESENT  │  │  LEAVE   │   │  HOLIDAY   │
       └────┬─────┘  └──────────┘   └────────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐  ┌──────────────┐
│  HALF   │  │   OVERTIME   │
│  DAY    │  │   (flag)     │
└─────────┘  └──────────────┘
```

Additionally, any record can be supplemented with a `REGULARISATION` overlay when HR corrects it.

### States

| State | Description | Set By |
|---|---|---|
| `ABSENT` | Employee did not clock in and has no approved leave | System (auto, end of day) |
| `PRESENT` | Employee clocked in and out within shift window | System (from clock events) |
| `HALF_DAY` | Hours worked < 50% of shift duration | System (calculated) |
| `LEAVE` | Approved leave covers this date | System (from approved leave record) |
| `HOLIDAY` | Company holiday calendar covers this date | System (from holiday table) |
| `WEEKEND` | Day falls on a non-working day per shift config | System |
| `REGULARISED` | HR or SUPER_ADMIN corrected the original record | HR / SUPER_ADMIN |

### Automatic Status Computation

At the end of each working day (11:59 PM workspace timezone), a BullMQ job runs per active employee:

```
[Daily Attendance Computation Job — per employee]
       │
       ▼
Is today a HOLIDAY? (check holiday calendar)
  Yes → status: HOLIDAY → stop
  No  → continue

Is today a WEEKEND? (check employee's shift config)
  Yes → status: WEEKEND → stop
  No  → continue

Does employee have an APPROVED leave for today?
  Yes → status: LEAVE → stop
  No  → continue

Did employee clock in today?
  No  → status: ABSENT → stop
  Yes → continue

Calculate total hours = sum of (clock-out - clock-in) for all clock events today
Shift expected hours = employee shift duration

total hours >= shift duration × 0.5?
  No  → status: HALF_DAY
  Yes → status: PRESENT

total hours > shift duration × 1.25?
  Yes → flag: OVERTIME = true (does not change PRESENT status)

→ Record saved to attendance table
```

---

## 2. Clock Event Lifecycle

### State Machine

```
[EMPLOYEE opens app] → [Clock In button]
       │
       ▼
┌────────────┐
│ CLOCKED_IN │  ← Timestamp recorded
└─────┬──────┘
      │
      │ (Employee clicks Clock Out)
      ▼
┌─────────────┐
│ CLOCKED_OUT │  ← Duration calculated
└─────────────┘
```

### Clock-In Rules

| Rule | Detail |
|---|---|
| One active clock-in per employee | Cannot clock in twice without clocking out first |
| Only current-day clock-in | Employees cannot clock in for past or future dates |
| Early clock-in tolerance | Clock-in allowed up to 60 minutes before shift start (configurable) |
| Late clock-in | Permitted; late arrival flagged on the attendance record |
| IP/location restriction | Optional: workspace can restrict clock-in to specific IP ranges or GPS coordinates (Phase 2 feature) |

### Clock Event Flow

```
[EMPLOYEE clicks Clock In]
       │
       ▼
[Validation]
  ├── Is there an existing open clock-in (no clock-out)?
  │     Yes → Error: "Please clock out first"
  │
  └── Is today a HOLIDAY or WEEKEND?
        Yes → Warning shown (can still clock in for exceptional scenarios)
        No  → Proceed

[Clock event created]
  ├── type: CLOCK_IN
  ├── timestamp: now() (UTC)
  ├── employeeId
  └── source: WEB / MOBILE / KIOSK

[Employee sees running timer on dashboard]

       │
       │ (Employee clicks Clock Out)
       ▼
[Validation]
  └── Is there an open clock-in for today?
        No  → Error: "No active clock-in found"
        Yes → Proceed

[Clock event created]
  ├── type: CLOCK_OUT
  ├── timestamp: now() (UTC)
  └── duration = clockOut.timestamp - clockIn.timestamp

[Today's total hours updated]
[If total hours cross shift threshold → attendance record status recomputed]
```

---

## 3. Regularisation Request Lifecycle

A regularisation request allows an employee to request correction of their attendance record (e.g., forgot to clock in, system issue).

### State Machine

```
┌──────────┐    ┌───────────────┐    ┌──────────┐
│ SUBMITTED│───▶│ UNDER_REVIEW  │───▶│ APPROVED │
└──────────┘    └───────┬───────┘    └──────────┘
                        │
                        ▼
                   ┌──────────┐
                   │ REJECTED │
                   └──────────┘
```

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `SUBMITTED` | Employee submits regularisation | EMPLOYEE | HR notified; TEAM_LEAD notified (for info) |
| `SUBMITTED` | `UNDER_REVIEW` | HR opens the request | HR | — |
| `UNDER_REVIEW` | `APPROVED` | HR approves correction | HR | Attendance record corrected; status recalculated |
| `UNDER_REVIEW` | `REJECTED` | HR rejects | HR | Rejection reason required; employee notified |
| `REJECTED` | `SUBMITTED` | Employee resubmits with updated reason | EMPLOYEE | HR notified again |

### Regularisation Request Fields

| Field | Description |
|---|---|
| `date` | The attendance date to be corrected |
| `requestedStatus` | What the employee believes it should be (PRESENT, HALF_DAY) |
| `clockInTime` | Claimed clock-in time (if missing from record) |
| `clockOutTime` | Claimed clock-out time (if missing from record) |
| `reason` | Free text explanation (mandatory) |
| `supportingProof` | Optional document upload (email screenshot, etc.) |

### Attendance Correction Rules

| Rule | Detail |
|---|---|
| Date window | Employee can regularise within 30 days; HR can regularise any date in current payroll period |
| Finalised payroll lock | Attendance in a FINALISED payroll period cannot be regularised without SUPER_ADMIN override |
| Audit trail | Original record preserved; correction appended with HR actor and timestamp |
| Maximum regularisations per month | Configurable (default: 3 per employee per month) |

---

## 4. Shift Management Workflow

### Shift Assignment Flow

```
[HR creates a Shift]
  ├── Name (e.g., "General Shift", "Night Shift")
  ├── Start time, End time
  ├── Working days (Mon–Fri, Mon–Sat, etc.)
  ├── Break duration (deducted from working hours)
  └── Overtime threshold (hours beyond which overtime is flagged)

[HR assigns Shift to employee or department]
  ├── Assign to individual employee → overrides department default
  └── Assign to department → applies to all employees in dept without individual override

[Shift effective from date]
  └── Future shift changes take effect on the specified start date
```

### Shift Change Flow

```
[HR modifies an employee's shift]
       │
       ▼
[System checks]
  └── Does the change affect already-computed attendance records?
        Yes → Warning: "Records from {date} onwards will be recomputed"
        No  → Proceed

[New shift assignment saved with effective date]
[BullMQ job queued to recompute affected attendance records]
[Employee notified of shift change]
```

---

## 5. Holiday Calendar Workflow

### Holiday Creation Flow

```
[HR adds a holiday]
  ├── Date
  ├── Name (e.g., "Diwali", "Republic Day")
  ├── Type: NATIONAL / REGIONAL / COMPANY
  └── Applicable to: ALL / specific departments / specific locations

[Holiday saved]
[BullMQ job queued to update attendance records for that date]
  ├── Employees with ABSENT status on that date → status: HOLIDAY
  ├── Employees with PRESENT status on that date → status unchanged
  │     (worked on a holiday — flagged for potential holiday pay, configurable)
  └── Employees with LEAVE status → leave balance credit back (configurable per leave policy)
```

### Holiday Impact on Leave

| Scenario | Behaviour |
|---|---|
| Leave applied on a holiday | System warns employee; leave not deducted (holiday takes precedence) |
| Holiday declared after leave approved | Leave cancelled for that day; balance credited back (configurable) |
| Employee works on a holiday | PRESENT record created; overtime/holiday pay flagged for payroll |

---

## 6. Attendance Report Workflow

| Report Type | Generated By | Frequency | Scope |
|---|---|---|---|
| Daily Attendance Summary | BullMQ (auto, midnight) | Daily | Per department |
| Monthly Attendance Report | BullMQ (auto, month end) | Monthly | All employees |
| Late Arrivals Report | HR (manual or scheduled) | Weekly | Per team / all |
| Absenteeism Report | HR (manual or scheduled) | Monthly | Per team / all |
| Overtime Report | HR (manual) | Monthly | All employees |
| TEAM_LEAD Summary | BullMQ (auto, weekly) | Weekly | Per team |

All reports are generated as BullMQ background jobs. Large exports (>1,000 records) are queued and the user receives a download notification when ready.

---

## 7. Attendance Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Employee marked ABSENT (end of day) | Employee, TEAM_LEAD | In-app + email |
| Regularisation submitted | HR, TEAM_LEAD (info only) | In-app + email |
| Regularisation approved / rejected | Employee | In-app + email |
| Shift assignment changed | Employee | In-app + email |
| Holiday declared | All affected employees | In-app + email |
| Overtime flagged | Employee, TEAM_LEAD | In-app |
| Late arrival (clock-in after shift start + grace period) | Employee, TEAM_LEAD | In-app |
