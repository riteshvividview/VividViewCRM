# Task Workflow — VividCRM

## Entities Covered
Task · Subtask · Comment · Mention · Time Entry · Recurring Task

---

## 1. Task Lifecycle

### State Machine

```
                    ┌──────────────┐
                    │     TODO     │  ← Created (manual, from template, from sprint backlog)
                    └──────┬───────┘
                           │
                           │ Assignee starts work
                           ▼
                    ┌──────────────┐
                    │ IN_PROGRESS  │
                    └──────┬───────┘
                           │
               ┌───────────┴────────────┐
               │                        │
               ▼                        ▼
        ┌────────────┐          ┌──────────────┐
        │  BLOCKED   │          │  IN_REVIEW   │  ← Submitted for review
        └─────┬──────┘          └──────┬───────┘
              │                        │
              │ (blocker resolved)      │
              └───────────────┐         │
                              ▼         ▼
                       ┌──────────────────┐
                       │    IN_PROGRESS   │  (back from block or review feedback)
                       └──────────────────┘
                                │
                       ┌────────┴────────┐
                       │                 │
                       ▼                 ▼
                  ┌─────────┐      ┌──────────┐
                  │  DONE   │      │ CANCELLED│
                  └────┬────┘      └──────────┘
                       │
                       ▼
                  ┌──────────┐
                  │ ARCHIVED │  ← Auto after 30 days in DONE, or manual
                  └──────────┘
```

### States

| State | Description | Who Can Set |
|---|---|---|
| `TODO` | Created, not yet started | SUPER_ADMIN, ADMIN, TEAM_LEAD, EMPLOYEE (own tasks) |
| `IN_PROGRESS` | Actively being worked | Assignee (EMPLOYEE), TEAM_LEAD |
| `BLOCKED` | Cannot proceed — dependency or external blocker | Assignee, TEAM_LEAD |
| `IN_REVIEW` | Work submitted; awaiting reviewer approval | Assignee (EMPLOYEE) |
| `DONE` | Reviewed and accepted | TEAM_LEAD, ADMIN, SUPER_ADMIN |
| `CANCELLED` | Abandoned or made irrelevant | TEAM_LEAD, ADMIN, SUPER_ADMIN |
| `ARCHIVED` | Completed tasks older than 30 days | System (auto) or TEAM_LEAD (manual) |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| `TODO` | `IN_PROGRESS` | Assignee starts work | Assignee / TEAM_LEAD | Start timestamp recorded; notification to watchers |
| `TODO` | `CANCELLED` | Task no longer needed | TEAM_LEAD / ADMIN | Reason required; subtasks also cancelled |
| `IN_PROGRESS` | `BLOCKED` | Assignee flags blocker | Assignee | Blocker description required; TEAM_LEAD notified |
| `IN_PROGRESS` | `IN_REVIEW` | Assignee submits for review | Assignee | Reviewer notified (TEAM_LEAD or designated reviewer) |
| `IN_PROGRESS` | `DONE` | TEAM_LEAD accepts without formal review | TEAM_LEAD / ADMIN | — |
| `IN_PROGRESS` | `CANCELLED` | Task abandoned mid-work | TEAM_LEAD / ADMIN | Reason required |
| `BLOCKED` | `IN_PROGRESS` | Blocker resolved | Assignee / TEAM_LEAD | Blocker resolution note recorded |
| `BLOCKED` | `CANCELLED` | Blocker cannot be resolved | TEAM_LEAD / ADMIN | Reason required |
| `IN_REVIEW` | `DONE` | Reviewer accepts | TEAM_LEAD / ADMIN / SUPER_ADMIN | Completion timestamp; time entries locked for billing |
| `IN_REVIEW` | `IN_PROGRESS` | Reviewer requests changes | TEAM_LEAD / ADMIN | Review comment required; assignee notified |
| `DONE` | `IN_PROGRESS` | Reopened (bug found, scope change) | TEAM_LEAD / ADMIN | Reason required; audit log entry; linked time entries unlocked |
| `DONE` | `ARCHIVED` | 30 days elapsed (auto) | System | Task visible only in archived view |
| `CANCELLED` | `TODO` | Reinstated | TEAM_LEAD / ADMIN | Reason required |
| `ARCHIVED` | — | Terminal (no further transitions via UI) | — | SUPER_ADMIN can restore via admin panel |

### Blocker Flow

```
[Task: IN_PROGRESS]
       │
       │ Assignee flags blocker
       ▼
[BLOCKED state set]
[Assignee fills in]
  ├── Blocker type: DEPENDENCY / EXTERNAL / RESOURCE / UNCLEAR_REQUIREMENTS / OTHER
  ├── Linked blocking task (optional — creates a dependency edge)
  └── Blocker description (free text)

[TEAM_LEAD receives notification]
[Task appears in "Blocked Tasks" view on board]

       │
       │ Blocker resolved
       ▼
[Assignee or TEAM_LEAD marks blocker resolved]
[Resolution note required]
[Task → IN_PROGRESS]
[Blocker resolution logged in activity]
```

---

## 2. Subtask Lifecycle

Subtasks follow the same state machine as Tasks with these constraints:

- A subtask cannot be moved to `DONE` while its parent task is `CANCELLED`
- A parent task cannot be moved to `DONE` while any of its subtasks are in `TODO`, `IN_PROGRESS`, `BLOCKED`, or `IN_REVIEW` — the system warns the actor and requires explicit override confirmation
- Cancelling a parent task automatically cascades `CANCELLED` to all subtasks
- Subtasks do not have their own review cycle — the parent task's `IN_REVIEW → DONE` transition covers all subtasks

---

## 3. Time Entry Lifecycle

### State Machine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐
│  DRAFT   │───▶│ SUBMITTED│───▶│ APPROVED │───▶│ BILLED │
└──────────┘    └────┬─────┘    └──────────┘    └────────┘
                     │
                     ▼
                ┌──────────┐
                │ REJECTED │
                └──────────┘
```

### States

| State | Description |
|---|---|
| `DRAFT` | Logged but not yet submitted — visible only to the logger |
| `SUBMITTED` | Submitted to TEAM_LEAD for approval |
| `APPROVED` | Accepted; eligible for invoice line item import |
| `REJECTED` | Returned by TEAM_LEAD with a note |
| `BILLED` | Added to a client invoice; locked from further changes |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| — | `DRAFT` | Employee logs hours on a task | EMPLOYEE | Entry stored with date, hours, task, description |
| `DRAFT` | `SUBMITTED` | Employee submits for approval | EMPLOYEE | TEAM_LEAD notified |
| `DRAFT` | (deleted) | Employee deletes unsubmitted entry | EMPLOYEE | Soft-deleted |
| `SUBMITTED` | `APPROVED` | TEAM_LEAD approves | TEAM_LEAD / ADMIN | Entry locked; included in team hours report |
| `SUBMITTED` | `REJECTED` | TEAM_LEAD rejects | TEAM_LEAD / ADMIN | Rejection reason required; employee notified |
| `REJECTED` | `DRAFT` | Employee edits and resubmits | EMPLOYEE | Entry editable again |
| `APPROVED` | `BILLED` | Entry imported into invoice | ADMIN / SUPER_ADMIN | Entry locked; cannot be added to another invoice |
| `BILLED` | `APPROVED` | Invoice voided | System | Unlocked automatically when parent invoice is voided |

### Time Entry Validation Rules

- Minimum entry: 0.25 hours (15 minutes)
- Maximum single entry: 24 hours
- Cannot log time on a task that is `CANCELLED` or `ARCHIVED`
- Cannot log time for a future date
- Cannot log time for a date more than 30 days in the past without TEAM_LEAD override
- Multiple entries per day per task are permitted; they accumulate

---

## 4. Comment and Mention Workflow

### Comment Flow

```
[User types comment on a task]
       │
       ├── Contains @mention?
       │     Yes → parse mentioned usernames → resolve to user IDs
       │     No  → skip mention processing
       │
       ▼
[Comment saved to database]
       │
       ├── Notify task watchers (users who previously commented or are assigned)
       │
       └── For each @mentioned user:
             ├── Create in-app notification (Socket.IO — real-time)
             └── Queue email notification (BullMQ — async digest)
```

### Comment Rules

- Comments are immutable after 15 minutes of creation (soft rule — editable within 15 minutes, read-only after)
- SUPER_ADMIN and ADMIN can delete any comment
- TEAM_LEAD can delete comments within their team's tasks
- EMPLOYEE can delete only their own comments within 15 minutes
- Deleted comments show a "This comment was deleted" placeholder (not removed from the thread)
- Mentions only trigger notifications for users who have READ access to the task — mentioning a user outside the team generates no notification and no visibility

---

## 5. Recurring Task Workflow

### Setup Flow

```
[TEAM_LEAD or ADMIN creates a Recurring Task Template]
  ├── Template fields: title, description, project, assignee(s), priority, estimated hours
  ├── Recurrence rule:
  │     DAILY / WEEKLY / BIWEEKLY / MONTHLY / CUSTOM (cron expression)
  ├── Recurrence end: NEVER / ON_DATE / AFTER_N_OCCURRENCES
  └── First occurrence date

[Template saved → status: ACTIVE]
[BullMQ scheduler registers cron job for the recurrence rule]
```

### Execution Flow

```
[BullMQ job fires at scheduled time]
       │
       ▼
[System creates new Task from template]
  ├── Task.title = Template.title + " — {formatted date}"
  ├── Task.status = TODO
  ├── Task.assignee = Template.assignee (or rotates if rotation is configured)
  ├── Task.dueDate = occurrence date
  └── Task.recurringTemplateId = Template.id (for lineage tracking)

[Assignee notified of new task]
[Task appears in board and calendar]
```

### Recurring Task Template States

| State | Description |
|---|---|
| `ACTIVE` | Template generates tasks on schedule |
| `PAUSED` | No new tasks generated; existing instances unaffected |
| `ENDED` | End condition reached (date or count); no new tasks generated |
| `ARCHIVED` | Manually disabled; all future instances cancelled |

### Transitions

| From | To | Trigger |
|---|---|---|
| `ACTIVE` | `PAUSED` | Manual pause by TEAM_LEAD / ADMIN |
| `ACTIVE` | `ENDED` | End date reached or occurrence count hit |
| `PAUSED` | `ACTIVE` | Manual resume |
| `ACTIVE` / `PAUSED` | `ARCHIVED` | Manual archive |
| `ENDED` | `ACTIVE` | End condition removed and recurrence re-enabled |

---

## 6. Task Notification Events

| Event | Recipients | Channel |
|---|---|---|
| Task created and assigned | Assignee | In-app (real-time) + email |
| Task reassigned | New assignee, old assignee | In-app (real-time) + email |
| Task status changed | Assignee, TEAM_LEAD, watchers | In-app (real-time) |
| Task moved to IN_REVIEW | Designated reviewer | In-app (real-time) + email |
| Task DONE | Assignee, creator | In-app (real-time) |
| Task BLOCKED | TEAM_LEAD | In-app (real-time) + email |
| Time entry submitted | TEAM_LEAD | In-app (real-time) |
| Time entry approved/rejected | Submitting employee | In-app (real-time) + email |
| Comment added | Task watchers | In-app (real-time) |
| @mention in comment | Mentioned user | In-app (real-time) + email |
| Due date approaching (24h) | Assignee | In-app + email |
| Due date passed (overdue) | Assignee, TEAM_LEAD | In-app + email (daily until resolved) |
