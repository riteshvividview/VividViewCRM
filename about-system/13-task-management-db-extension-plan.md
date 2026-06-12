# Task Management — Database Extension Plan

**Date:** 2026-06-02  
**Status:** Planning — DO NOT execute until approved  
**Rule:** Forward-only migrations. No DROP. No TRUNCATE. All new columns nullable.

---

## Part A — Extend Existing Table: `tasks`

### Purpose
Add columns to support project/board/sprint organization and proper task metadata without breaking existing CRM task usage.

### New Columns (all nullable, all with defaults)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `project_id` | UUID | NULL | Link to `task_projects` |
| `board_id` | UUID | NULL | Link to `task_boards` |
| `sprint_id` | UUID | NULL | Link to `task_sprints` |
| `column_id` | UUID | NULL | Link to `task_board_columns` |
| `position` | INTEGER | 0 | Sort order within column |
| `story_points` | INTEGER | NULL | Scrum velocity tracking |
| `start_date` | DATE | NULL | Task start date |
| `estimated_hours` | NUMERIC(6,2) | NULL | Time estimate |
| `completed_at` | TIMESTAMPTZ | NULL | Completion timestamp |

### SQL (safe — additive only)
```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.task_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.task_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.task_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES public.task_board_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS story_points INTEGER,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON public.tasks(board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON public.tasks(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON public.tasks(column_id, position) WHERE column_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at) WHERE completed_at IS NOT NULL;
```

### RLS Strategy
Inherits existing RLS on `tasks` table. No new policy needed.

---

## Part B — New Tables

---

### Table: `task_projects`

**Purpose:** Top-level container. Groups boards under a named initiative. Workspace-scoped.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `workspace_id` | UUID | NOT NULL, FK → workspaces | Isolation key |
| `name` | TEXT | NOT NULL | Project name |
| `description` | TEXT | | |
| `status` | TEXT | NOT NULL, default 'active' | planning/active/on_hold/completed/cancelled |
| `owner_id` | UUID | FK → auth.users | Project owner |
| `team_id` | UUID | FK → teams, nullable | Assigned team |
| `color` | TEXT | default '#6366f1' | UI color |
| `icon` | TEXT | | Emoji or icon name |
| `start_date` | DATE | | |
| `end_date` | DATE | | |
| `visibility` | TEXT | NOT NULL, default 'workspace' | workspace/private/team |
| `position` | INTEGER | NOT NULL, default 0 | Sort order |
| `archived_at` | TIMESTAMPTZ | | Soft archive |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_projects_workspace ON public.task_projects(workspace_id);
CREATE INDEX idx_task_projects_owner ON public.task_projects(owner_id);
CREATE INDEX idx_task_projects_status ON public.task_projects(workspace_id, status);
CREATE INDEX idx_task_projects_archived ON public.task_projects(workspace_id) WHERE archived_at IS NULL;
```

**Foreign Keys**
- `workspace_id` → `public.workspaces(id)` ON DELETE CASCADE
- `owner_id` → `auth.users(id)` ON DELETE SET NULL
- `team_id` → `public.teams(id)` ON DELETE SET NULL
- `created_by` → `auth.users(id)` ON DELETE SET NULL

**RLS Strategy**
```sql
-- Users see projects in their workspace
CREATE POLICY "workspace_isolation" ON public.task_projects
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()
  ));
```

---

### Table: `task_boards`

**Purpose:** Kanban or Scrum board within a project. Owns columns and sprints.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | NOT NULL, FK → task_projects | |
| `workspace_id` | UUID | NOT NULL, FK → workspaces | Denorm for RLS performance |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | | |
| `type` | TEXT | NOT NULL, default 'kanban' | kanban/scrum/list/timeline |
| `owner_id` | UUID | FK → auth.users | |
| `is_private` | BOOLEAN | default false | |
| `position` | INTEGER | default 0 | |
| `archived_at` | TIMESTAMPTZ | | |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_boards_project ON public.task_boards(project_id);
CREATE INDEX idx_task_boards_workspace ON public.task_boards(workspace_id);
CREATE INDEX idx_task_boards_active ON public.task_boards(project_id) WHERE archived_at IS NULL;
```

**RLS Strategy:** Same workspace isolation pattern as `task_projects`.

---

### Table: `task_board_columns`

**Purpose:** Configurable status columns per board (e.g., "To Do", "In Progress", "Done").

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `board_id` | UUID | NOT NULL, FK → task_boards | |
| `workspace_id` | UUID | NOT NULL | Denorm for RLS |
| `name` | TEXT | NOT NULL | |
| `color` | TEXT | default '#e5e7eb' | |
| `position` | INTEGER | NOT NULL | Column order |
| `is_done_column` | BOOLEAN | default false | Mark as terminal state |
| `task_limit` | INTEGER | | WIP limit (NULL = unlimited) |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_board_columns_board ON public.task_board_columns(board_id);
CREATE UNIQUE INDEX idx_task_board_columns_position ON public.task_board_columns(board_id, position);
```

**Foreign Keys**
- `board_id` → `task_boards(id)` ON DELETE CASCADE

---

### Table: `task_sprints`

**Purpose:** Time-boxed sprint for Scrum boards. Tasks are pulled in from backlog.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `board_id` | UUID | NOT NULL, FK → task_boards | |
| `workspace_id` | UUID | NOT NULL | |
| `name` | TEXT | NOT NULL | e.g., "Sprint 1" |
| `goal` | TEXT | | Sprint goal statement |
| `status` | TEXT | NOT NULL, default 'draft' | draft/active/completed/cancelled |
| `start_date` | DATE | | |
| `end_date` | DATE | | |
| `capacity_points` | INTEGER | | Team capacity |
| `velocity` | INTEGER | | Actual points completed (set at close) |
| `retrospective` | TEXT | | Retrospective notes |
| `completed_at` | TIMESTAMPTZ | | |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_sprints_board ON public.task_sprints(board_id);
CREATE INDEX idx_task_sprints_status ON public.task_sprints(board_id, status);
CREATE INDEX idx_task_sprints_active ON public.task_sprints(board_id) WHERE status = 'active';
```

**Constraint:** Only one active sprint per board at a time (enforced at application layer + partial unique index).
```sql
CREATE UNIQUE INDEX idx_task_sprints_one_active ON public.task_sprints(board_id) WHERE status = 'active';
```

---

### Table: `task_comments`

**Purpose:** Rich-text comments on tasks. Supports threaded replies (1 level deep).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `workspace_id` | UUID | NOT NULL | |
| `author_id` | UUID | NOT NULL, FK → auth.users | |
| `body` | TEXT | NOT NULL | Markdown or rich text |
| `parent_comment_id` | UUID | FK → task_comments, nullable | Reply threading |
| `edited_at` | TIMESTAMPTZ | | |
| `deleted_at` | TIMESTAMPTZ | | Soft delete |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_comments_task ON public.task_comments(task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_task_comments_author ON public.task_comments(author_id);
CREATE INDEX idx_task_comments_parent ON public.task_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
```

---

### Table: `task_mentions`

**Purpose:** Index of @mentions within comments for fast notification queries.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `comment_id` | UUID | NOT NULL, FK → task_comments | |
| `task_id` | UUID | NOT NULL, FK → tasks | Denorm for faster queries |
| `workspace_id` | UUID | NOT NULL | |
| `mentioned_user_id` | UUID | NOT NULL, FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_mentions_user ON public.task_mentions(mentioned_user_id);
CREATE INDEX idx_task_mentions_comment ON public.task_mentions(comment_id);
CREATE UNIQUE INDEX idx_task_mentions_unique ON public.task_mentions(comment_id, mentioned_user_id);
```

---

### Table: `task_activity_log`

**Purpose:** Immutable audit trail of every change to a task (no UPDATE, no DELETE).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `workspace_id` | UUID | NOT NULL | |
| `actor_id` | UUID | FK → auth.users | NULL = system |
| `action` | TEXT | NOT NULL | See action enum |
| `field_name` | TEXT | | Which field changed |
| `old_value` | JSONB | | Previous value |
| `new_value` | JSONB | | New value |
| `metadata` | JSONB | default '{}' | Extra context |
| `created_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_activity_task ON public.task_activity_log(task_id, created_at DESC);
CREATE INDEX idx_task_activity_actor ON public.task_activity_log(actor_id);
CREATE INDEX idx_task_activity_workspace ON public.task_activity_log(workspace_id, created_at DESC);
```

**RLS Strategy:** INSERT only for authenticated workspace members. No UPDATE or DELETE allowed.
```sql
REVOKE UPDATE, DELETE ON public.task_activity_log FROM authenticated;
```

---

### Table: `task_time_entries`

**Purpose:** Time tracking per task per user. Supports running timer and manual entry.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `workspace_id` | UUID | NOT NULL | |
| `user_id` | UUID | NOT NULL, FK → auth.users | |
| `started_at` | TIMESTAMPTZ | NOT NULL | |
| `ended_at` | TIMESTAMPTZ | | NULL = timer still running |
| `duration_minutes` | INTEGER | | Computed on stop; or manual |
| `description` | TEXT | | What was worked on |
| `is_billable` | BOOLEAN | default false | |
| `is_manual` | BOOLEAN | default false | Manual entry vs. timer |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_time_entries_task ON public.task_time_entries(task_id);
CREATE INDEX idx_task_time_entries_user ON public.task_time_entries(user_id, started_at DESC);
CREATE INDEX idx_task_time_entries_running ON public.task_time_entries(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_task_time_entries_workspace ON public.task_time_entries(workspace_id, started_at DESC);
```

**Constraint:** Only one running timer per user (enforced at app layer + partial unique index):
```sql
CREATE UNIQUE INDEX idx_task_time_entries_one_running ON public.task_time_entries(user_id) WHERE ended_at IS NULL;
```

---

### Table: `task_recurrence_rules`

**Purpose:** Structured recurrence configuration for recurring tasks. Replaces the `tasks.recurring_pattern` text field.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `task_id` | UUID | UNIQUE, NOT NULL, FK → tasks | 1:1 |
| `workspace_id` | UUID | NOT NULL | |
| `frequency` | TEXT | NOT NULL | daily/weekly/monthly/yearly/custom |
| `interval_value` | INTEGER | NOT NULL, default 1 | Every N units |
| `days_of_week` | INTEGER[] | | 0=Sun … 6=Sat |
| `day_of_month` | INTEGER | | 1-31 |
| `month_of_year` | INTEGER | | 1-12 |
| `end_type` | TEXT | NOT NULL, default 'never' | never/on_date/after_count |
| `end_date` | DATE | | |
| `end_after_count` | INTEGER | | |
| `occurrences_created` | INTEGER | NOT NULL, default 0 | |
| `next_run_at` | TIMESTAMPTZ | | For BullMQ scheduler |
| `last_run_at` | TIMESTAMPTZ | | |
| `is_paused` | BOOLEAN | default false | |
| `created_at` | TIMESTAMPTZ | default now() | |
| `updated_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE UNIQUE INDEX idx_task_recurrence_task ON public.task_recurrence_rules(task_id);
CREATE INDEX idx_task_recurrence_next_run ON public.task_recurrence_rules(next_run_at) WHERE is_paused = false;
```

---

### Table: `task_labels`

**Purpose:** Workspace-scoped named labels with colors. Reusable across tasks.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `workspace_id` | UUID | NOT NULL, FK → workspaces | |
| `name` | TEXT | NOT NULL | |
| `color` | TEXT | NOT NULL, default '#6366f1' | Hex color |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |

**Indexes**
```sql
CREATE INDEX idx_task_labels_workspace ON public.task_labels(workspace_id);
CREATE UNIQUE INDEX idx_task_labels_name ON public.task_labels(workspace_id, name);
```

---

### Table: `task_label_assignments`

**Purpose:** Many-to-many junction — labels applied to tasks.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `label_id` | UUID | NOT NULL, FK → task_labels | |
| `assigned_at` | TIMESTAMPTZ | default now() | |
| `assigned_by` | UUID | FK → auth.users | |

**Primary Key:** `(task_id, label_id)`

**Indexes**
```sql
CREATE INDEX idx_task_label_assignments_label ON public.task_label_assignments(label_id);
CREATE INDEX idx_task_label_assignments_task ON public.task_label_assignments(task_id);
```

---

### Table: `task_assignees`

**Purpose:** Many-to-many multi-assignee support. The existing `tasks.assignee_id` is kept for backward compatibility with the CRM view.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `user_id` | UUID | NOT NULL, FK → auth.users | |
| `assigned_at` | TIMESTAMPTZ | default now() | |
| `assigned_by` | UUID | FK → auth.users | |

**Primary Key:** `(task_id, user_id)`

**Indexes**
```sql
CREATE INDEX idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX idx_task_assignees_task ON public.task_assignees(task_id);
```

---

### Table: `task_watchers`

**Purpose:** Users subscribed to a task for notifications (without being assignee).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `task_id` | UUID | NOT NULL, FK → tasks | |
| `user_id` | UUID | NOT NULL, FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |

**Primary Key:** `(task_id, user_id)`

**Indexes**
```sql
CREATE INDEX idx_task_watchers_user ON public.task_watchers(user_id);
```

---

### Table: `task_attachments` _(Deferred — requires R2)_

**Purpose:** Files attached to tasks. Deferred until Cloudflare R2 is configured.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `task_id` | UUID → tasks | |
| `workspace_id` | UUID | |
| `uploaded_by` | UUID → users | |
| `file_name` | TEXT | Original filename |
| `file_key` | TEXT | R2 storage key |
| `file_url` | TEXT | Signed/public URL |
| `mime_type` | TEXT | |
| `file_size_bytes` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

**Activation:** Uncomment and migrate when R2 env vars are configured.

---

## Workspace Isolation Strategy (All Tables)

Every new table follows this pattern:
1. Column `workspace_id UUID NOT NULL` with FK → `workspaces(id)` ON DELETE CASCADE
2. All read queries must include `WHERE workspace_id = $currentWorkspaceId`
3. Supabase RLS policy: user must belong to the workspace (via `profiles.workspace_id`)

Standard RLS template:
```sql
ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table_name}_workspace_isolation" ON public.{table_name}
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
```

---

## Migration Execution Order

Dependencies must be created in this order:

```
1. task_projects          (depends on: workspaces, users)
2. task_boards            (depends on: task_projects)
3. task_board_columns     (depends on: task_boards)
4. task_sprints           (depends on: task_boards)
5. ALTER TABLE tasks      (depends on: task_projects, task_boards, task_board_columns, task_sprints)
6. task_labels            (depends on: workspaces)
7. task_comments          (depends on: tasks)
8. task_mentions          (depends on: task_comments, tasks)
9. task_activity_log      (depends on: tasks)
10. task_time_entries     (depends on: tasks)
11. task_recurrence_rules (depends on: tasks)
12. task_label_assignments (depends on: tasks, task_labels)
13. task_assignees        (depends on: tasks)
14. task_watchers         (depends on: tasks)
15. task_attachments      (DEFERRED — skip until R2 configured)
```
