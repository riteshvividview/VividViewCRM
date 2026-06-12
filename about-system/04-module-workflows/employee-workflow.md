# Employee Workflow — VividCRM

## Entities Covered
Employee Record · User Account · Onboarding Checklist · Profile Change Request · Exit Management

---

## 1. Employee Lifecycle

### State Machine

```
                    ┌────────────────┐
                    │   ONBOARDING   │  ← Created by HR after offer acceptance
                    └───────┬────────┘
                            │
                            │ All checklist items complete
                            ▼
                    ┌────────────────┐
                    │    ACTIVE      │  ← Normal working state
                    └───────┬────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
       ┌──────────┐  ┌──────────────┐  ┌──────────┐
       │ ON_LEAVE │  │  SUSPENDED   │  │  EXITING │
       └────┬─────┘  └──────┬───────┘  └────┬─────┘
            │               │               │
            │ (leave ends)  │ (reinstated)  │ (notice period + FFS done)
            ▼               ▼               ▼
       ┌──────────┐  ┌──────────────┐  ┌────────────┐
       │  ACTIVE  │  │    ACTIVE    │  │ TERMINATED │
       └──────────┘  └──────────────┘  └────────────┘
```

### States

| State | Description | System Account Status |
|---|---|---|
| `ONBOARDING` | Employee record created; checklist in progress | Account created but may be locked until day 1 |
| `ACTIVE` | Fully onboarded; working normally | Active |
| `ON_LEAVE` | On extended leave (auto-set when leave starts) | Active |
| `SUSPENDED` | Temporarily suspended by HR / SUPER_ADMIN | Deactivated (cannot log in) |
| `EXITING` | Notice period; exit workflow in progress | Active (restricted modules) |
| `TERMINATED` | Employment ended; record retained | Deactivated permanently |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `ONBOARDING` | HR creates employee record | HR | User account created; onboarding tasks generated |
| `ONBOARDING` | `ACTIVE` | All mandatory checklist items completed | HR | Shift assigned; leave balances allocated; full system access granted |
| `ACTIVE` | `ON_LEAVE` | First day of approved leave period begins | System (auto) | Calendar updated; out-of-office flag set |
| `ON_LEAVE` | `ACTIVE` | Last day of approved leave period ends | System (auto) | Calendar cleared |
| `ACTIVE` | `SUSPENDED` | HR / SUPER_ADMIN suspends employee | HR / SUPER_ADMIN | Reason required; user account deactivated; all sessions terminated |
| `SUSPENDED` | `ACTIVE` | Suspension lifted | HR / SUPER_ADMIN | User account reactivated; employee notified |
| `ACTIVE` | `EXITING` | Resignation accepted or termination initiated | HR | Notice period tracking begins; exit checklist created |
| `EXITING` | `TERMINATED` | Notice period complete + FFS disbursed | HR / SUPER_ADMIN | User account permanently deactivated; see Termination Flow |

---

## 2. Onboarding Workflow

### Onboarding Initiation Flow

```
[HR creates new Employee record]
  ├── Personal Info: name, date of birth, gender, contact, address
  ├── Employment Info: designation, department, reporting manager (TEAM_LEAD)
  ├── Employment Type: FULL_TIME / PART_TIME / CONTRACT / INTERN
  ├── Date of Joining
  ├── Probation Period: N months (0 = no probation)
  └── Salary Structure (assign or defer)

[User Account created]
  ├── Work email assigned
  ├── Temporary password generated
  ├── Role assigned: EMPLOYEE (default)
  └── Account status: LOCKED (until joining date, configurable)

[Onboarding Checklist auto-generated from template]
[Tasks created in the Task module]
  ├── Task: "Collect ID and address proof documents" → assigned to HR
  ├── Task: "Sign offer letter and employment contract" → assigned to HR + Employee
  ├── Task: "Set up workstation and equipment" → assigned to IT (TEAM_LEAD of IT team)
  ├── Task: "Complete bank details form" → assigned to Employee
  ├── Task: "Complete tax declaration (Form 12BB)" → assigned to Employee
  ├── Task: "Introduction to team" → assigned to Reporting Manager
  └── Custom tasks from onboarding template (configurable per department)

[TEAM_LEAD of employee's team notified]
[Employee welcome email sent with login credentials]
```

### Onboarding Checklist Item States

```
Each checklist item follows:

┌──────────┐    ┌────────────┐    ┌──────────┐
│ PENDING  │───▶│ IN_PROGRESS│───▶│COMPLETED │
└──────────┘    └────────────┘    └──────────┘
      │
      └──────────────────────────────▶ WAIVED
                                  (HR can waive non-mandatory items)
```

### Onboarding Completion Check

```
[HR marks onboarding complete]
       │
       ▼
[System checks mandatory checklist items]
  ├── Any mandatory items PENDING or IN_PROGRESS?
  │     Yes → Error: list of incomplete mandatory items shown
  │     No  → Proceed
  │
  └── Prompt: Assign shift, confirm leave balance allocation

[Employee.status → ACTIVE]
[System access fully granted]
[HR and TEAM_LEAD notified]
```

---

## 3. Profile Change Request Workflow

Employees can request changes to certain profile fields. Sensitive fields require HR approval before taking effect.

### Sensitivity Classification

| Field | Change Method | Approval Required |
|---|---|---|
| Profile photo | Direct (self-service) | No |
| Personal phone number | Direct (self-service) | No |
| Emergency contact | Direct (self-service) | No |
| Home address | Requires approval | HR |
| Bank account number | Requires approval + verification | HR |
| Tax declaration (Form 12BB) | Requires approval | HR |
| PAN / Aadhaar number | Requires approval | HR |
| Designation | Cannot self-edit | HR / SUPER_ADMIN only |
| Department | Cannot self-edit | HR only |
| Salary | Cannot self-edit | HR only |
| Work email | Cannot self-edit | SUPER_ADMIN only |
| Role | Cannot self-edit | SUPER_ADMIN only |

### Profile Change Request State Machine

```
┌──────────────┐    ┌──────────────┐    ┌──────────┐
│   SUBMITTED  │───▶│UNDER_REVIEW  │───▶│ APPROVED │
└──────────────┘    └──────┬───────┘    └──────────┘
                           │
                           ▼
                      ┌──────────┐
                      │ REJECTED │
                      └──────────┘
```

### Profile Change Flow

```
[Employee submits a change for a sensitive field]
  ├── Old value (read-only, pre-filled)
  ├── New value (entered by employee)
  ├── Supporting document (mandatory for bank account, PAN, Aadhaar)
  └── Reason (optional)

[Request saved as SUBMITTED]
[HR notified]

[HR reviews]
  ├── Verifies supporting document authenticity
  └── Approves or rejects

[On APPROVED]
  ├── Field value updated in employee record
  ├── Audit log: before + after + approving HR actor + timestamp
  └── Employee notified

[On REJECTED]
  ├── Rejection reason recorded
  └── Employee notified; can resubmit with corrected information
```

---

## 4. Probation Review Workflow

```
[Probation end date approaches — 14 days before: HR notified]
       │
       ▼
[HR triggers Probation Review]
  ├── Reviewer: Reporting Manager (TEAM_LEAD)
  ├── Self-assessment: Optional (employee fills form)
  └── Manager rating: Performance, Attitude, Deliverables

[Review submitted by TEAM_LEAD]
       │
       ▼
[HR makes decision]
  ├── CONFIRMED → Employee.probationStatus = CONFIRMED
  │     Employment continues; standard policies apply
  │
  ├── EXTENDED → Probation extended by N months
  │     New probation end date set; employee notified
  │
  └── TERMINATED → Probation failure; exit workflow triggered
        Employee.status → EXITING
```

---

## 5. Exit Management Workflow

### Exit Initiation

```
[Employee submits resignation]
  OR
[HR / SUPER_ADMIN initiates termination]

       │
       ▼
[Exit record created]
  ├── Exit type: RESIGNATION / TERMINATION / RETIREMENT / CONTRACT_END / ABSCONDING
  ├── Last working day (LWD)
  ├── Notice period (from employment contract)
  ├── Notice period served: calculated daily as LWD approaches
  └── Notice period shortfall: (if employee exits before notice period ends)

[Employee.status → EXITING]
[Exit checklist auto-generated]
```

### Exit Checklist Items

```
Assigned to HR:
  ├── Collect company assets (laptop, access cards, equipment)
  ├── Revoke all system access and permissions
  ├── Cancel pending leave applications
  └── Compute Final Settlement

Assigned to TEAM_LEAD:
  ├── Knowledge transfer completed
  ├── Reassign all open tasks
  └── Manager sign-off on knowledge transfer

Assigned to Employee:
  ├── Complete knowledge transfer documentation
  ├── Return all company assets
  ├── Serve notice period (tracked daily)
  └── Exit interview completion
```

### Exit Checklist Item States

Same as onboarding: `PENDING → IN_PROGRESS → COMPLETED / WAIVED`

### Termination Flow

```
[All exit checklist mandatory items COMPLETED]
[Final Settlement computed and APPROVED]
[FFS payslip DISTRIBUTED]

[HR / SUPER_ADMIN confirms termination]
       │
       ▼
[Validation]
  ├── Any open payroll runs including this employee?
  │     Yes → must be finalised first
  ├── Any open tasks assigned to this employee?
  │     Yes → must be reassigned
  └── Any active invoices linked to this employee's time entries?
        Warn only (does not block)

[Employee.status → TERMINATED]
[User.isActive → false]
[All active JWT sessions immediately invalidated]
[Employee record retained with status TERMINATED]
[Audit log: EMPLOYEE_TERMINATED entry]
[IT access revoke notification sent to SUPER_ADMIN]
```

### Data Retention After Termination

| Data Type | Retention Period | Access After Termination |
|---|---|---|
| Payroll records | 7 years | HR, SUPER_ADMIN |
| Attendance records | 3 years | HR, SUPER_ADMIN |
| Leave records | 3 years | HR, SUPER_ADMIN |
| HR documents (contracts, payslips) | 7 years | HR, SUPER_ADMIN |
| Task and time entries | Indefinite | ADMIN, TEAM_LEAD (for billing) |
| CRM activities | Indefinite | ADMIN |
| Employee profile | Indefinite (TERMINATED status) | HR, SUPER_ADMIN |

---

## 6. Employee Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Employee record created | Employee (welcome email), TEAM_LEAD, HR | Email + in-app |
| Onboarding task assigned | Task assignee | In-app + email |
| Onboarding completed | Employee, TEAM_LEAD, HR | In-app + email |
| Probation review due (14 days) | HR, TEAM_LEAD | In-app + email |
| Probation confirmed / extended | Employee, HR | In-app + email |
| Profile change request submitted | HR | In-app |
| Profile change approved / rejected | Employee | In-app + email |
| Suspension activated | Employee (cannot see — email only), HR, SUPER_ADMIN | Email |
| Exit initiated | Employee, TEAM_LEAD, HR | In-app + email |
| Exit checklist item due | Assigned actor | In-app + email |
| Termination confirmed | SUPER_ADMIN, HR | In-app |
