# Project Workflow — VividCRM

## Entities Covered
Project · Board · Sprint · Project Member · Project Template

---

## 1. Project Lifecycle

### State Machine

```
                    ┌───────────────┐
                    │   PLANNING    │  ← Created (from Deal win or manually)
                    └───────┬───────┘
                            │
                            │ Team assembled, scope defined
                            ▼
                    ┌───────────────┐
                    │   ACTIVE      │  ← Work in progress
                    └───────┬───────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
       ┌──────────┐  ┌────────────┐  ┌──────────┐
       │  ON_HOLD │  │ COMPLETED  │  │CANCELLED │
       └────┬─────┘  └────────────┘  └──────────┘
            │
            │ (hold lifted)
            ▼
       ┌──────────┐
       │  ACTIVE  │
       └──────────┘
```

### States

| State | Description | Who Can Set |
|---|---|---|
| `PLANNING` | Scope being defined; no active tasks yet | ADMIN, SUPER_ADMIN |
| `ACTIVE` | Team working; tasks being created and executed | ADMIN, TEAM_LEAD, SUPER_ADMIN |
| `ON_HOLD` | Temporarily paused — client, budget, or dependency hold | ADMIN, SUPER_ADMIN |
| `COMPLETED` | All deliverables accepted; project closed | ADMIN, SUPER_ADMIN |
| `CANCELLED` | Project abandoned before completion | ADMIN, SUPER_ADMIN |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `PLANNING` | Project created (from Deal or manual) | ADMIN / SUPER_ADMIN | Default board created; TEAM_LEAD assigned |
| `PLANNING` | `ACTIVE` | Kickoff confirmed; team assigned | ADMIN / TEAM_LEAD | Project visible to team members; tasks can be created |
| `PLANNING` | `CANCELLED` | Project abandoned pre-kickoff | ADMIN / SUPER_ADMIN | Reason required |
| `ACTIVE` | `ON_HOLD` | Client pause or internal block | ADMIN / SUPER_ADMIN | Reason + expected resume date required; team notified |
| `ACTIVE` | `COMPLETED` | All tasks DONE; client sign-off | ADMIN / SUPER_ADMIN | Completion checklist reviewed; see Completion Flow |
| `ACTIVE` | `CANCELLED` | Project terminated mid-delivery | ADMIN / SUPER_ADMIN | Reason required; open tasks auto-cancelled; team notified |
| `ON_HOLD` | `ACTIVE` | Hold lifted | ADMIN / SUPER_ADMIN | Team notified; in-progress tasks resume |
| `ON_HOLD` | `CANCELLED` | Hold becomes permanent abandonment | ADMIN / SUPER_ADMIN | — |
| `COMPLETED` | `ACTIVE` | Reopened for change request scope | ADMIN / SUPER_ADMIN | Reason required; audit log entry; new Change Request sprint created |

### Project Creation Flow

```
[Trigger: Deal marked WON with "Create Project" selected]
  OR
[Trigger: ADMIN/TEAM_LEAD clicks "New Project" manually]

       │
       ▼
[Project Setup Wizard]
  Step 1 — Basic Info
    ├── Name, description, client (Contact/Company from CRM)
    ├── Project type: CLIENT / INTERNAL / MAINTENANCE
    ├── Linked Deal (optional — auto-filled if from Deal win)
    └── Start date, estimated end date

  Step 2 — Team
    ├── Select TEAM_LEAD (owner)
    └── Add initial members (EMPLOYEE users)

  Step 3 — Board Setup
    ├── Default board auto-created with columns:
    │     TODO → IN_PROGRESS → IN_REVIEW → DONE
    └── Additional custom columns configurable by TEAM_LEAD

  Step 4 — Template (optional)
    └── Apply a Project Template to pre-populate tasks

       │
       ▼
[Project status → PLANNING]
[TEAM_LEAD notified]
[Team members notified]
```

### Project Completion Flow

```
[ADMIN or SUPER_ADMIN initiates project completion]
       │
       ▼
[System runs completion checklist]
  ├── Are there any tasks in TODO / IN_PROGRESS / BLOCKED / IN_REVIEW? 
  │     Yes → Warning shown; actor must confirm override or resolve tasks first
  │     No  → Proceed
  │
  ├── Are there any unpaid invoices linked to this project?
  │     Yes → Warning shown (project can still complete, but invoice flagged)
  │     No  → Proceed
  │
  ├── Are there any unbilled APPROVED time entries?
  │     Yes → Warning shown; actor can trigger invoice draft before completing
  │     No  → Proceed
  │
  └── Final confirmation: "Mark project as COMPLETED?"

[Project.status → COMPLETED]
[Project.completedAt = now()]
[All remaining DONE tasks → ARCHIVED]
[Team members notified]
[Project Report auto-generated: tasks summary, time logged, billable vs. non-billable hours]
```

---

## 2. Sprint Lifecycle

### State Machine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───▶│ PLANNED  │───▶│  ACTIVE  │───▶│COMPLETED │
└──────────┘    └──────────┘    └────┬─────┘    └──────────┘
                                     │
                                     ▼
                                ┌──────────┐
                                │ CANCELLED│
                                └──────────┘
```

### States

| State | Description |
|---|---|
| `DRAFT` | Sprint being planned; tasks being added to backlog |
| `PLANNED` | Sprint finalised; start date confirmed; team notified |
| `ACTIVE` | Sprint in progress; daily standups expected |
| `COMPLETED` | Sprint end date reached or manually closed |
| `CANCELLED` | Sprint abandoned; tasks return to backlog |

### Transitions

| From | To | Trigger | Actor | Guard |
|---|---|---|---|---|
| — | `DRAFT` | TEAM_LEAD creates sprint | TEAM_LEAD / ADMIN | Project must be `ACTIVE` |
| `DRAFT` | `PLANNED` | Sprint finalised (start/end dates + tasks locked) | TEAM_LEAD | Must have at least 1 task |
| `PLANNED` | `ACTIVE` | Sprint start date reached (auto) or manual start | System / TEAM_LEAD | Only one sprint can be `ACTIVE` per project at a time |
| `PLANNED` | `CANCELLED` | Sprint cancelled before start | TEAM_LEAD / ADMIN | Tasks return to backlog |
| `ACTIVE` | `COMPLETED` | Sprint end date reached (auto) or manual close | System / TEAM_LEAD | See Sprint Completion Flow |
| `ACTIVE` | `CANCELLED` | Sprint abandoned mid-execution | ADMIN / SUPER_ADMIN | Reason required; tasks return to backlog |
| `COMPLETED` | — | Terminal | — | — |

### Sprint Planning Flow

```
[TEAM_LEAD opens Sprint Planning]
       │
       ▼
[Backlog view shown — all TODO tasks in the project not yet in a sprint]
       │
       ▼
[TEAM_LEAD drags tasks into the sprint]
  ├── Each task shows: estimated hours, assignee, priority
  ├── Sprint capacity panel shows: total hours added vs. team capacity
  └── Warning shown if sprint is over-capacity

[TEAM_LEAD sets]
  ├── Sprint name (e.g., "Sprint 3 — Auth Module")
  ├── Sprint goal (free text)
  ├── Start date
  └── End date (typically 1–2 weeks)

[Sprint status → PLANNED]
[Team members notified of upcoming sprint]
```

### Sprint Completion Flow

```
[Sprint end date reached OR TEAM_LEAD manually closes sprint]
       │
       ▼
[System evaluates unfinished tasks]
  ├── Tasks in DONE / ARCHIVED → included in sprint completion report
  └── Tasks in TODO / IN_PROGRESS / BLOCKED / IN_REVIEW → "Incomplete tasks"

[Actor chooses for each incomplete task]
  ├── Move to Backlog (becomes unassigned to sprint)
  ├── Move to Next Sprint (if one exists in DRAFT or PLANNED status)
  └── Cancel (if task is no longer relevant)

[Sprint.status → COMPLETED]
[Sprint Report generated]
  ├── Velocity: story points or hours completed vs. planned
  ├── Completion rate: % of tasks DONE
  ├── Carry-over: count of tasks moved to next sprint or backlog
  └── Per-member contribution breakdown
```

---

## 3. Board and Column Lifecycle

### Column Operations

| Operation | Actor | Constraint |
|---|---|---|
| Add column | TEAM_LEAD / ADMIN | Maximum 8 columns per board |
| Rename column | TEAM_LEAD / ADMIN | Cannot rename terminal columns (DONE, CANCELLED) |
| Reorder columns | TEAM_LEAD / ADMIN | DONE and CANCELLED always remain rightmost |
| Delete column | TEAM_LEAD / ADMIN | Column must be empty (no tasks in it) |
| Set WIP limit | TEAM_LEAD / ADMIN | Optional; warning shown when limit exceeded |

### Task Movement on Board

```
[User drags task card to a new column]
       │
       ▼
[System maps column to task status]
  ├── "To Do" column → status: TODO
  ├── "In Progress" column → status: IN_PROGRESS
  ├── "In Review" column → status: IN_REVIEW
  ├── "Done" column → status: DONE (if actor has DONE permission)
  └── Custom column → status: IN_PROGRESS (custom columns are mid-stream by default)

[Authorization check]
  ├── Is the actor permitted to set this status? (per permission matrix)
  └── Does the target status violate any workflow guard?

[If permitted] → Task status updated; activity logged; notifications sent
[If denied] → Card snaps back to original column; toast error shown
```

---

## 4. Project Member Management

### Member Addition Flow

```
[TEAM_LEAD opens Project Members settings]
       │
       ▼
[TEAM_LEAD selects user(s) from their team]
  ├── Only users within the TEAM_LEAD's team scope can be added by TEAM_LEAD
  └── ADMIN / SUPER_ADMIN can add any workspace user

[User added as project member]
  ├── User can now see the project and its tasks
  ├── User can be assigned tasks within this project
  └── User receives notification: "You have been added to {Project Name}"
```

### Member Removal Flow

```
[TEAM_LEAD removes a member from the project]
       │
       ▼
[System checks: does this user have open tasks?]
  ├── Yes → Warning shown
  │     Actor must choose: reassign tasks / leave unassigned / cancel tasks
  │
  └── No → Member removed immediately

[Member removed]
  ├── User can no longer see the project or its tasks
  ├── Any tasks still assigned to this user become UNASSIGNED (if override chosen)
  └── Notification sent to removed user
```

---

## 5. Project Template Workflow

```
[ADMIN / SUPER_ADMIN creates a Project Template]
  ├── Template name and category (e.g., "Website Build", "Brand Campaign")
  ├── Default tasks with: title, estimated hours, default assignee role, order
  ├── Default sprint structure (optional)
  └── Default board columns

[Template saved]

[On new project creation]
  ├── Actor selects "Apply Template"
  └── System creates all template tasks in the new project
        ├── Tasks in TODO status
        ├── Assignees set to placeholder roles (e.g., "Assigned to: Developer")
        └── Actual assignees filled in by TEAM_LEAD during planning
```

---

## 6. Project Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Project created | TEAM_LEAD, project members | In-app + email |
| Project status changed | TEAM_LEAD, ADMIN | In-app + email |
| Project placed ON_HOLD | All project members | In-app + email |
| Project COMPLETED | All project members, linked client (if email configured) | In-app + email |
| Member added to project | New member | In-app + email |
| Member removed from project | Removed member | In-app |
| Sprint started | All sprint members | In-app + email |
| Sprint completed | TEAM_LEAD, ADMIN | In-app |
| Sprint overdue (end date passed, still ACTIVE) | TEAM_LEAD | In-app + email (daily) |
| Project deadline approaching (7 days) | TEAM_LEAD, ADMIN | In-app + email |
