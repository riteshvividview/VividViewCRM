# Task Management — Entity Relationship Diagram

**Date:** 2026-06-02  
**Status:** Planning  
**Schema:** `public` schema (extends existing Supabase DB)

---

## Entity Overview

| Entity | Table | Status |
|---|---|---|
| Workspace | `workspaces` | Existing — no change |
| User | `auth.users` | Existing — no change |
| Profile | `profiles` | Existing — no change |
| Team | `teams` | Existing — no change |
| Team Member | `team_members` | Existing — no change |
| Calendar Event | `calendar_events` | Existing — reused via entity link |
| Notification | `notifications` | Existing — reused with new types |
| **Project** | `task_projects` | **NEW** |
| **Board** | `task_boards` | **NEW** |
| **Board Column** | `task_board_columns` | **NEW** |
| **Sprint** | `task_sprints` | **NEW** |
| Task | `tasks` | Existing — extended |
| **Task Assignees** | `task_assignees` | **NEW** |
| **Task Watchers** | `task_watchers` | **NEW** |
| **Comment** | `task_comments` | **NEW** |
| **Mention** | `task_mentions` | **NEW** |
| **Activity Log** | `task_activity_log` | **NEW** |
| **Time Entry** | `task_time_entries` | **NEW** |
| **Recurrence Rule** | `task_recurrence_rules` | **NEW** |
| **Label** | `task_labels` | **NEW** |
| **Label Assignment** | `task_label_assignments` | **NEW** |
| **Attachment** | `task_attachments` | **NEW (deferred)** |

---

## Full ERD

```
┌─────────────────────────────────────────────────────────────────────┐
│                          workspaces                                 │
│  id · name · slug · owner_id → users · created_at                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ 1:N (workspace_id on every table)
           ┌─────────────┼──────────────────────────────────┐
           │             │                                  │
           ▼             ▼                                  ▼
   ┌───────────────┐  ┌───────────┐                ┌───────────────┐
   │ task_projects │  │   teams   │                │ task_labels   │
   │───────────────│  │───────────│                │───────────────│
   │ id (PK)       │  │ id (PK)   │                │ id (PK)       │
   │ workspace_id  │  │ name      │                │ workspace_id  │
   │ name          │  │ manager_id│                │ name          │
   │ description   │  │ ...       │                │ color         │
   │ status        │  └─────┬─────┘                │ created_by    │
   │ owner_id      │        │                      └───────┬───────┘
   │ team_id ──────┼────────┘                              │
   │ start_date    │                               ┌───────▼────────┐
   │ end_date      │                               │task_label_     │
   │ visibility    │                               │  assignments   │
   │ color         │                               │────────────────│
   │ position      │                               │ task_id → tasks│
   │ created_at    │                               │ label_id       │
   │ updated_at    │                               └────────────────┘
   │ deleted_at    │
   └───────┬───────┘
           │ 1:N
           ▼
   ┌───────────────┐
   │  task_boards  │
   │───────────────│
   │ id (PK)       │
   │ project_id    │◄───────────────────────────────────────────────┐
   │ workspace_id  │                                                │
   │ name          │                                                │
   │ type          │ (kanban | scrum | list | timeline)             │
   │ description   │                                                │
   │ owner_id      │                                                │
   │ is_private    │                                                │
   │ position      │                                                │
   │ created_at    │                                                │
   │ updated_at    │                                                │
   └───────┬───────┘                                                │
           │ 1:N                                                    │
    ┌──────┴──────────────┐                                         │
    ▼                     ▼                                         │
┌──────────────┐   ┌─────────────────┐                             │
│task_board_   │   │  task_sprints   │                             │
│  columns     │   │─────────────────│                             │
│──────────────│   │ id (PK)         │                             │
│ id (PK)      │   │ board_id        │─────────────────────────────┘
│ board_id     │   │ workspace_id    │
│ name         │   │ name            │
│ color        │   │ goal            │
│ position     │   │ status          │
│ is_done_col  │   │ start_date      │
│ task_limit   │   │ end_date        │
│ created_at   │   │ capacity_points │
│ updated_at   │   │ velocity        │
└──────┬───────┘   │ retrospective   │
       │           │ created_by      │
       │           │ created_at      │
       │           │ updated_at      │
       │           └────────┬────────┘
       │                    │
       └────────┬───────────┘
                │ board_id, column_id, sprint_id
                ▼
┌───────────────────────────────────────────────────────────────┐
│                           tasks                               │
│  (EXISTING TABLE — extended with new nullable columns)        │
│───────────────────────────────────────────────────────────────│
│ id (PK)                                                       │
│ workspace_id → workspaces                                     │
│ title                                                         │
│ description                                                   │
│ status           (todo|in_progress|in_review|blocked|done)    │
│ priority         (none|low|medium|high|urgent)                │
│ due_date                                                      │
│ assignee_id → users    (primary assignee, kept for compat)    │
│ linked_entity_type / linked_entity_id / linked_entity_name    │
│ parent_task_id → tasks (subtask hierarchy)                    │
│ sub_tasks        JSONB  ⚠️ deprecated — ignored by new code    │
│ recurring_pattern text  ⚠️ deprecated — use recurrence_rules  │
│ tags             text[]                                       │
│ created_by → users                                            │
│ created_at / updated_at                                       │
│ ── NEW COLUMNS (all nullable) ─────────────────────────────── │
│ project_id → task_projects                                    │
│ board_id   → task_boards                                      │
│ sprint_id  → task_sprints                                     │
│ column_id  → task_board_columns                               │
│ position           integer (ordering within column)           │
│ story_points       integer                                    │
│ start_date         date                                       │
│ estimated_hours    numeric(6,2)                               │
│ completed_at       timestamptz                                │
└─────┬─────────────────────────────────────────────────────────┘
      │ task_id FK from all child tables below
      │
  ┌───┴───────────────────────────────────────────────────┐
  │                                                       │
  ▼                                                       ▼
┌─────────────────┐  ┌──────────────────┐   ┌────────────────────┐
│ task_assignees  │  │  task_watchers   │   │ task_recurrence_   │
│─────────────────│  │──────────────────│   │   rules            │
│ id (PK)         │  │ id (PK)          │   │────────────────────│
│ task_id         │  │ task_id          │   │ id (PK)            │
│ user_id         │  │ user_id          │   │ task_id            │
│ assigned_at     │  │ created_at       │   │ frequency          │
│ assigned_by     │  │                  │   │ interval_value     │
│ UNIQUE(task,usr)│  │ UNIQUE(task,usr) │   │ days_of_week       │
└─────────────────┘  └──────────────────┘   │ day_of_month       │
                                             │ month_of_year      │
  ▼                                          │ end_type           │
┌─────────────────────────────────┐          │ end_date           │
│       task_comments             │          │ end_after_count    │
│─────────────────────────────────│          │ next_run_at        │
│ id (PK)                         │          │ last_run_at        │
│ task_id                         │          │ created_at         │
│ workspace_id                    │          └────────────────────┘
│ author_id → users               │
│ body       (rich text / MD)     │  ▼
│ parent_comment_id → comments    │ ┌────────────────────────┐
│ edited_at                       │ │   task_time_entries    │
│ deleted_at                      │ │────────────────────────│
│ created_at / updated_at         │ │ id (PK)                │
└──────┬──────────────────────────┘ │ task_id                │
       │ 1:N                        │ workspace_id           │
       ▼                            │ user_id                │
┌─────────────────┐                 │ started_at             │
│ task_mentions   │                 │ ended_at               │
│─────────────────│                 │ duration_minutes       │
│ id (PK)         │                 │ description            │
│ comment_id      │                 │ is_billable            │
│ task_id         │                 │ created_at             │
│ mentioned_user  │                 │ updated_at             │
│ created_at      │                 └────────────────────────┘
└─────────────────┘
                              ▼
                    ┌─────────────────────────┐
                    │    task_activity_log    │
                    │─────────────────────────│
                    │ id (PK)                 │
                    │ task_id                 │
                    │ workspace_id            │
                    │ actor_id → users        │
                    │ action                  │
                    │ field_name              │
                    │ old_value  jsonb        │
                    │ new_value  jsonb        │
                    │ created_at              │
                    └─────────────────────────┘
```

---

## Cardinalities

| Relationship | Type | Via |
|---|---|---|
| Workspace → Projects | 1:N | `task_projects.workspace_id` |
| Project → Boards | 1:N | `task_boards.project_id` |
| Board → Columns | 1:N | `task_board_columns.board_id` |
| Board → Sprints | 1:N | `task_sprints.board_id` |
| Task → Project | N:1 | `tasks.project_id` |
| Task → Board | N:1 | `tasks.board_id` |
| Task → Column | N:1 | `tasks.column_id` |
| Task → Sprint | N:1 | `tasks.sprint_id` |
| Task → Task (subtask) | N:1 | `tasks.parent_task_id` |
| Task → Assignees | M:N | `task_assignees` |
| Task → Watchers | M:N | `task_watchers` |
| Task → Comments | 1:N | `task_comments.task_id` |
| Comment → Comments (replies) | 1:N | `task_comments.parent_comment_id` |
| Comment → Mentions | 1:N | `task_mentions.comment_id` |
| Task → Activity | 1:N | `task_activity_log.task_id` |
| Task → Time Entries | 1:N | `task_time_entries.task_id` |
| Task → Labels | M:N | `task_label_assignments` |
| Task → Recurrence | 1:1 | `task_recurrence_rules.task_id` |
| Task → Calendar | 1:1 optional | `calendar_events` via `linked_entity_type='task'` |

---

## Enum Values (application-level)

### task_status
`todo` · `in_progress` · `in_review` · `blocked` · `done` · `cancelled`

### task_priority
`none` · `low` · `medium` · `high` · `urgent`

### board_type
`kanban` · `scrum` · `list` · `timeline`

### project_status
`planning` · `active` · `on_hold` · `completed` · `cancelled`

### sprint_status
`draft` · `active` · `completed` · `cancelled`

### recurrence_frequency
`daily` · `weekly` · `monthly` · `yearly` · `custom`

### time_entry_status
`running` · `paused` · `completed`

### activity_action
`created` · `updated` · `status_changed` · `priority_changed` · `assigned` · `unassigned` · `commented` · `attachment_added` · `due_date_changed` · `sprint_changed` · `moved`
