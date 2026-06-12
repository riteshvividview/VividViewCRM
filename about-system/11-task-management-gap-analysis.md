# Task Management — Gap Analysis

**Date:** 2026-06-02  
**Status:** Planning  
**Scope:** Extend existing CRM schema with full Task Management capability

---

## 1. Existing Tables Audit

### `public.tasks` — Current State

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | ✅ |
| title | text NOT NULL | ✅ |
| description | text default '' | ✅ |
| status | text default 'todo' | ⚠️ Unvalidated string — no enum constraint |
| priority | text default 'medium' | ⚠️ Unvalidated string |
| due_date | date | ✅ |
| assignee_id | UUID → users | ✅ single assignee |
| assignee_name | text | ⚠️ Denormalized — stale if user renames |
| linked_entity_type | text | ✅ CRM link (lead/deal/contact) |
| linked_entity_id | UUID | ✅ |
| linked_entity_name | text | ⚠️ Denormalized |
| parent_task_id | UUID → tasks | ✅ Self-ref for subtasks |
| sub_tasks | jsonb default '[]' | ❌ JSON blob — not normalized |
| recurring_pattern | text | ⚠️ Free text string — no structured recurrence engine |
| tags | text[] | ⚠️ No label management, no workspace-scoped labels |
| created_by | UUID → users | ✅ |
| workspace_id | UUID → workspaces | ✅ |
| created_at | timestamptz | ✅ |
| updated_at | timestamptz | ✅ |

**Notable absences from tasks:** `board_id`, `project_id`, `sprint_id`, `column_id`, `position`, `story_points`, `start_date`, `estimated_hours`, `completed_at`

---

### Other Reusable Tables

| Table | What can be reused |
|---|---|
| `workspaces` | Workspace isolation — every new table inherits `workspace_id` |
| `teams` | Team assignment to projects/boards |
| `team_members` | Team membership → task watchers, board members |
| `notifications` | Notification delivery — task events emit into this table |
| `calendar_events` | Calendar sync — `linked_entity_type = 'task'` already supported |
| `users` (auth schema) | Assignee, creator, commenter, watcher references |
| `profiles` | Display name, avatar for task cards |

---

## 2. Gap Analysis — Feature vs. Schema

### Feature: Projects
- **Requirement:** Group boards under a named project with owner, status, dates, visibility
- **Existing:** Nothing
- **Gap:** Full new table required — `task_projects`

### Feature: Boards
- **Requirement:** Kanban/Scrum board with configurable columns, linked to project
- **Existing:** Nothing
- **Gap:** Full new table required — `task_boards` + `task_board_columns`

### Feature: Tasks (extended)
- **Requirement:** Tasks linked to board column, sprint, project; multiple assignees; story points; position ordering
- **Existing:** `tasks` table covers 40% — basic CRUD exists
- **Gap:** Needs new nullable columns added to `tasks`: `project_id`, `board_id`, `sprint_id`, `column_id`, `position`, `story_points`, `start_date`, `estimated_hours`, `completed_at`
- **Risk:** LOW — all additions are nullable ALTER TABLE ADD COLUMN

### Feature: Subtasks
- **Requirement:** Proper normalized subtask rows, not JSON blob
- **Existing:** `parent_task_id` FK exists (correct approach). `sub_tasks` JSON blob is legacy
- **Gap:** The FK is correct. New code must write subtasks as real rows, not into the JSON blob. The `sub_tasks` JSON blob column should be ignored by new code (deprecate without dropping)

### Feature: Comments & Mentions
- **Requirement:** Rich-text comments on tasks, @mention tracking with notifications
- **Existing:** Nothing
- **Gap:** New tables required — `task_comments`, `task_mentions`

### Feature: Activity Log
- **Requirement:** Audit trail of every change to a task (status, assignee, priority changes)
- **Existing:** `deal_activities` and `lead_activities` exist as a pattern — but no task equivalent
- **Gap:** New table — `task_activity_log` (follow the deal_activities pattern)

### Feature: Time Tracking
- **Requirement:** Start/stop timer per task, manual entry, reports
- **Existing:** Nothing
- **Gap:** New table — `task_time_entries`

### Feature: Recurring Tasks
- **Requirement:** Cron-based recurrence — daily/weekly/monthly/custom, with occurrence tracking
- **Existing:** `recurring_pattern` is a free-text string — unusable for scheduling
- **Gap:** New table — `task_recurrence_rules` (structured RRULE-like config)

### Feature: Sprint Management
- **Requirement:** Sprint with start/end date, capacity, velocity, backlog
- **Existing:** Nothing
- **Gap:** New table — `task_sprints`

### Feature: Team Assignment
- **Requirement:** Projects/boards assigned to teams; tasks can have multiple assignees
- **Existing:** `teams` + `team_members` exist — can be referenced via FK
- **Gap:** New junction table — `task_assignees` (many-to-many) and `task_board_members`

### Feature: Watchers / Followers
- **Requirement:** Users subscribe to a task for notifications without being the assignee
- **Existing:** Nothing
- **Gap:** New table — `task_watchers`

### Feature: Labels
- **Requirement:** Workspace-scoped labels with colors, reusable across tasks
- **Existing:** `tasks.tags` is an unstructured text array
- **Gap:** New table — `task_labels` + `task_label_assignments`

### Feature: Attachments
- **Requirement:** Files attached to tasks (R2 storage)
- **Existing:** Nothing
- **Gap:** New table — `task_attachments` (references R2 key; deferred until R2 implemented)

### Feature: Calendar Sync
- **Requirement:** Task due_date appears in calendar; tasks linkable to calendar_events
- **Existing:** `calendar_events.linked_entity_type` already supports `'task'` as a value. `tasks.linked_entity_type` supports `'calendar_event'`
- **Gap:** No new table needed. API layer must create/update `calendar_events` when task due_date is set. **Fully reusable.**

### Feature: Notifications
- **Requirement:** Notify assignee on assignment, @mentions, due-date reminders, comment replies
- **Existing:** `notifications` table exists and is already used by CRM
- **Gap:** No new table — new notification types are added by inserting rows with `type = 'task_assigned'` etc.

---

## 3. Summary — Reusable vs. New

### Fully Reusable (no changes)
- `workspaces` — isolation
- `notifications` — add new task notification types
- `calendar_events` — add events with `linked_entity_type = 'task'`
- `teams` + `team_members` — reference in board/project membership
- `profiles` — display info

### Partially Reusable (extend with new columns)
- `tasks` — add 9 new nullable columns (safe ALTER TABLE)

### New Tables Required (10 tables)

| Table | Purpose |
|---|---|
| `task_projects` | Project entity — groups boards |
| `task_boards` | Board (Kanban/Scrum) within a project |
| `task_board_columns` | Configurable columns per board |
| `task_sprints` | Sprint management |
| `task_comments` | Comments on tasks |
| `task_mentions` | @mention index per comment |
| `task_activity_log` | Audit trail per task |
| `task_time_entries` | Time tracking sessions |
| `task_recurrence_rules` | Structured recurrence config |
| `task_labels` | Workspace-scoped labels |
| `task_label_assignments` | Many-to-many label ↔ task |
| `task_watchers` | Task watcher subscriptions |
| `task_assignees` | Multi-assignee (supplements single assignee) |
| `task_attachments` | File attachments (deferred — requires R2) |

**Total new tables: 14** (12 active now, `task_attachments` deferred)

---

## 4. Relationship Diagram

```
workspaces
    │
    ├── task_projects ──────────────── teams
    │       │
    │       ├── task_boards ──────── task_board_columns
    │       │       │
    │       │       └── task_sprints
    │       │
    │       └── [tasks].project_id
    │
    └── tasks (extended)
            │
            ├── tasks (parent_task_id → self, subtasks)
            ├── task_comments ──── task_mentions
            ├── task_activity_log
            ├── task_time_entries
            ├── task_labels ←── task_label_assignments
            ├── task_watchers
            ├── task_assignees
            ├── task_recurrence_rules
            └── task_attachments (deferred)
```

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| ALTER TABLE on `tasks` (production data) | MEDIUM | All new columns nullable with defaults — zero downtime |
| `sub_tasks` JSON blob vs normalized rows | LOW | Deprecate silently; new code ignores blob, writes real rows |
| `assignee_name` denormalization becoming stale | LOW | New code reads from `profiles` via JOIN; ignore the denorm column |
| `recurring_pattern` string format undefined | LOW | New `task_recurrence_rules` table owns scheduling; old column kept but ignored |
| Calendar sync complexity | LOW | Reuse `calendar_events`; task service creates events on save |
| RLS policy conflicts with new tables | MEDIUM | All new tables mirror CRM RLS pattern: `workspace_id` isolation |
