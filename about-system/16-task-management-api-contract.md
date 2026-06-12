# Task Management — API Contract

**Date:** 2026-06-02  
**Base URL:** `/api/v1`  
**Auth:** Bearer JWT on all endpoints  
**Response envelope:** `{ success, statusCode, data, timestamp, requestId }`  
**Pagination:** `?page=1&limit=20&sortBy=created_at&sortOrder=desc`

---

## Standard Response Envelope

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-06-02T07:00:00.000Z",
  "requestId": "uuid"
}
```

## Standard Error Response

```json
{
  "success": false,
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Task not found",
  "timestamp": "...",
  "requestId": "uuid"
}
```

## Standard Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [ ... ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## Projects API

### POST `/projects`
Create a new project.

**Roles:** ADMIN, TEAM_LEAD

**Request Body**
```json
{
  "name": "Website Redesign",
  "description": "Q3 marketing site overhaul",
  "status": "active",
  "team_id": "uuid",
  "color": "#6366f1",
  "icon": "🚀",
  "start_date": "2026-07-01",
  "end_date": "2026-09-30",
  "visibility": "workspace"
}
```

**Validation**
- `name`: required, string, 1–200 chars
- `status`: optional, enum: `planning|active|on_hold|completed|cancelled`, default `active`
- `visibility`: optional, enum: `workspace|private|team`, default `workspace`
- `team_id`: optional, UUID, must exist in workspace
- `color`: optional, hex color string
- `start_date`, `end_date`: optional, ISO date, end must be after start

**Response 201**
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "name": "Website Redesign",
  "status": "active",
  "owner_id": "uuid",
  "team_id": "uuid",
  "color": "#6366f1",
  "icon": "🚀",
  "start_date": "2026-07-01",
  "end_date": "2026-09-30",
  "visibility": "workspace",
  "position": 0,
  "created_at": "...",
  "updated_at": "..."
}
```

**Errors**
- `400` Validation failure
- `403` Insufficient role

---

### GET `/projects`
List all workspace projects.

**Query Parameters**
| Param | Type | Description |
|---|---|---|
| `page` | int | default 1 |
| `limit` | int | default 20, max 100 |
| `status` | string | filter by status |
| `team_id` | uuid | filter by team |
| `search` | string | name search |
| `include_archived` | bool | default false |

**Response 200** — paginated list of project objects

---

### GET `/projects/:id`
Get project by ID with board count and stats.

**Response 200**
```json
{
  "id": "uuid",
  "name": "...",
  "board_count": 3,
  "task_stats": {
    "total": 45,
    "todo": 12,
    "in_progress": 20,
    "done": 13
  },
  "boards": [ ... ]
}
```

---

### PATCH `/projects/:id`
Update project. **Roles:** ADMIN, TEAM_LEAD (own team's project)

**Request Body** — partial, any fields from create body

---

### DELETE `/projects/:id`
Archive project (soft delete via `archived_at`). **Roles:** ADMIN

---

## Boards API

### POST `/boards`
Create board within a project.

**Request Body**
```json
{
  "project_id": "uuid",
  "name": "Sprint Board",
  "type": "scrum",
  "description": "",
  "is_private": false
}
```

**Validation**
- `project_id`: required, UUID, must exist in workspace
- `name`: required, 1–150 chars
- `type`: optional, enum: `kanban|scrum|list|timeline`, default `kanban`

**Response 201** — board object with default columns created automatically:
```
kanban defaults: ["To Do", "In Progress", "In Review", "Done"]
scrum defaults:  ["Backlog", "To Do", "In Progress", "In Review", "Done"]
```

---

### GET `/boards/:id`
Get board with columns, active sprint, and task counts per column.

**Response 200**
```json
{
  "id": "uuid",
  "name": "Sprint Board",
  "type": "scrum",
  "columns": [
    { "id": "uuid", "name": "To Do", "position": 0, "task_count": 8, "task_limit": null }
  ],
  "active_sprint": { "id": "uuid", "name": "Sprint 3", "end_date": "2026-06-15" },
  "task_count": 45
}
```

---

### GET `/boards/:id/tasks`
Get all tasks on this board, grouped by column.

**Query Parameters**
| Param | Type | Description |
|---|---|---|
| `sprint_id` | uuid | filter by sprint (default: active sprint) |
| `assignee_id` | uuid | filter by assignee |
| `priority` | string | filter by priority |
| `label_id` | uuid | filter by label |

**Response 200**
```json
{
  "columns": {
    "column-uuid-1": {
      "column": { "id": "...", "name": "To Do" },
      "tasks": [ ... ]
    }
  }
}
```

---

### POST `/boards/:id/columns`
Add a new column to board. **Roles:** ADMIN, TEAM_LEAD

**Request Body**
```json
{ "name": "QA Review", "color": "#f59e0b", "position": 3, "task_limit": 5 }
```

---

### PATCH `/boards/:id/columns/reorder`
Reorder all columns. **Roles:** ADMIN, TEAM_LEAD

**Request Body**
```json
{ "order": ["uuid1", "uuid2", "uuid3"] }
```

---

## Sprints API

### POST `/boards/:boardId/sprints`
Create sprint. **Roles:** ADMIN, TEAM_LEAD

**Request Body**
```json
{
  "name": "Sprint 4",
  "goal": "Complete checkout flow",
  "start_date": "2026-06-16",
  "end_date": "2026-06-30",
  "capacity_points": 40
}
```

**Validation**
- `name`: required, 1–100 chars
- `end_date` > `start_date` required
- `capacity_points`: optional, positive integer

---

### POST `/sprints/:id/start`
Start a sprint. Only one active sprint per board. **Roles:** ADMIN, TEAM_LEAD

**Errors**
- `409` Another sprint is already active on this board

---

### POST `/sprints/:id/complete`
Complete sprint. Returns list of incomplete tasks for backlog handling.

**Request Body**
```json
{ "move_incomplete_to": "backlog" }
```
`move_incomplete_to`: `backlog` | `next_sprint` | `column_id`

**Response 200**
```json
{
  "sprint": { "velocity": 32, "completed_at": "..." },
  "incomplete_tasks": [ ... ],
  "moved_to": "backlog"
}
```

---

## Tasks API

### POST `/tasks`
Create task.

**Request Body**
```json
{
  "title": "Implement login page",
  "description": "Use existing design tokens",
  "status": "todo",
  "priority": "high",
  "project_id": "uuid",
  "board_id": "uuid",
  "sprint_id": "uuid",
  "column_id": "uuid",
  "assignee_id": "uuid",
  "assignee_ids": ["uuid1", "uuid2"],
  "due_date": "2026-06-15",
  "start_date": "2026-06-08",
  "story_points": 5,
  "estimated_hours": 8,
  "label_ids": ["uuid"],
  "tags": ["frontend", "auth"],
  "parent_task_id": null,
  "linked_entity_type": "lead",
  "linked_entity_id": "uuid"
}
```

**Validation**
- `title`: required, 1–500 chars
- `status`: optional, enum: `todo|in_progress|in_review|blocked|done|cancelled`
- `priority`: optional, enum: `none|low|medium|high|urgent`
- `story_points`: optional, 0–999
- `estimated_hours`: optional, 0–9999.99
- If `board_id` provided, `column_id` required

---

### GET `/tasks`
List tasks with filters.

**Query Parameters**
| Param | Type | Description |
|---|---|---|
| `project_id` | uuid | filter by project |
| `board_id` | uuid | filter by board |
| `sprint_id` | uuid | filter by sprint |
| `column_id` | uuid | filter by column |
| `assignee_id` | uuid | filter by assignee |
| `status` | string | comma-separated statuses |
| `priority` | string | comma-separated priorities |
| `label_ids` | string | comma-separated label UUIDs |
| `due_before` | date | |
| `due_after` | date | |
| `is_overdue` | bool | |
| `has_no_assignee` | bool | |
| `parent_task_id` | uuid | get subtasks of task |
| `search` | string | full-text search on title/description |
| `page` | int | |
| `limit` | int | max 100 |
| `sortBy` | string | `created_at|due_date|priority|updated_at|position` |
| `sortOrder` | string | `asc|desc` |

---

### GET `/tasks/:id`
Get full task detail.

**Response 200**
```json
{
  "id": "uuid",
  "title": "...",
  "status": "in_progress",
  "priority": "high",
  "assignees": [ { "id": "uuid", "full_name": "...", "avatar_url": "..." } ],
  "watchers": [ ... ],
  "labels": [ { "id": "uuid", "name": "Bug", "color": "#ef4444" } ],
  "subtasks": {
    "total": 3,
    "completed": 1,
    "items": [ ... ]
  },
  "time_tracked_minutes": 240,
  "comment_count": 5,
  "project": { "id": "uuid", "name": "..." },
  "board": { "id": "uuid", "name": "..." },
  "sprint": { "id": "uuid", "name": "Sprint 3" },
  "column": { "id": "uuid", "name": "In Progress" },
  "story_points": 5,
  "estimated_hours": 8.0,
  "created_at": "...",
  "updated_at": "..."
}
```

---

### PATCH `/tasks/:id`
Update task fields. Partial update.

**Special Behaviors**
- Setting `status = 'done'` automatically sets `completed_at = now()`
- Changing `assignee_id` triggers `task_assigned` notification
- Changes are written to `task_activity_log` automatically

---

### POST `/tasks/:id/move`
Move task to a different column (drag-drop).

**Request Body**
```json
{
  "column_id": "uuid",
  "position": 2,
  "sprint_id": "uuid"
}
```

---

### POST `/tasks/:id/assignees`
Add assignees to task. **Roles:** TEAM_LEAD+

**Request Body**
```json
{ "user_ids": ["uuid1", "uuid2"] }
```

---

### POST `/tasks/:id/watch` / DELETE `/tasks/:id/watch`
Subscribe/unsubscribe from task notifications. Any role.

---

### GET `/tasks/:id/activity`
Get activity log for task.

**Response 200** — paginated list
```json
{
  "items": [
    {
      "id": "uuid",
      "action": "status_changed",
      "field_name": "status",
      "old_value": "todo",
      "new_value": "in_progress",
      "actor": { "full_name": "...", "avatar_url": "..." },
      "created_at": "..."
    }
  ]
}
```

---

## Comments API

### POST `/tasks/:taskId/comments`
Add comment.

**Request Body**
```json
{
  "body": "Looks good! @john can you review the auth flow?",
  "parent_comment_id": null
}
```

**Validation**
- `body`: required, 1–10000 chars
- Mentions parsed from `@username` or `@uuid` format

**Side Effects**
- Mentions trigger `task_mentioned` notification to each @user
- Assignees and watchers receive `task_commented` notification
- Activity log entry created

---

### GET `/tasks/:taskId/comments`
List comments.

**Response 200** — threaded structure
```json
{
  "items": [
    {
      "id": "uuid",
      "body": "Looks good! ...",
      "author": { "full_name": "...", "avatar_url": "..." },
      "replies": [ ... ],
      "edited_at": null,
      "created_at": "..."
    }
  ]
}
```

---

### PATCH `/comments/:id`
Edit comment. **Author only.**

**Request Body**
```json
{ "body": "Updated comment text" }
```

---

### DELETE `/comments/:id`
Soft delete (sets `deleted_at`, body replaced with "[deleted]" in response).

---

## Time Tracking API

### POST `/tasks/:taskId/timer/start`
Start running timer for current user.

**Errors**
- `409` User already has a running timer (one active timer per user)

**Response 201**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "user_id": "uuid",
  "started_at": "2026-06-02T07:30:00Z",
  "ended_at": null,
  "duration_minutes": null,
  "is_billable": false
}
```

---

### POST `/tasks/:taskId/timer/stop`
Stop current running timer.

**Response 200**
```json
{
  "id": "uuid",
  "started_at": "...",
  "ended_at": "...",
  "duration_minutes": 47
}
```

---

### GET `/time-entries/running`
Get current user's running timer (if any). Returns `null` if none.

---

### POST `/tasks/:taskId/time-entries`
Manual time entry.

**Request Body**
```json
{
  "started_at": "2026-06-02T08:00:00Z",
  "ended_at": "2026-06-02T10:30:00Z",
  "description": "Worked on login UI",
  "is_billable": true
}
```

**Validation**
- `started_at` required
- `ended_at` required (manual entry must have end time)
- `ended_at` must be after `started_at`
- Cannot overlap with existing entries for same user

---

### GET `/time-entries/report`
Time report by user/task/date range. **Roles:** ADMIN, TEAM_LEAD, HR

**Query Parameters**
| Param | Type |
|---|---|
| `user_id` | uuid |
| `project_id` | uuid |
| `from_date` | ISO date |
| `to_date` | ISO date |
| `is_billable` | bool |

**Response 200**
```json
{
  "total_minutes": 4320,
  "billable_minutes": 3600,
  "by_user": [
    { "user_id": "uuid", "full_name": "...", "minutes": 1200 }
  ],
  "by_project": [
    { "project_id": "uuid", "name": "...", "minutes": 2000 }
  ],
  "by_day": [
    { "date": "2026-06-01", "minutes": 480 }
  ]
}
```

---

## Labels API

### POST `/labels`
Create workspace label. **Roles:** ADMIN, TEAM_LEAD

**Request Body**
```json
{ "name": "Bug", "color": "#ef4444" }
```

**Validation**
- `name`: required, 1–50 chars, unique within workspace
- `color`: required, valid hex color

---

### GET `/labels`
List all workspace labels.

---

## Filtering Strategy

All list endpoints support:
- **Exact match:** `?status=todo` or `?status=todo,in_progress` (comma-separated)
- **Date range:** `?due_after=2026-06-01&due_before=2026-06-30`
- **Boolean flags:** `?is_overdue=true`, `?has_no_assignee=true`
- **Full-text search:** `?search=login+page` (searches title and description using PostgreSQL `ILIKE`)
- **Pagination:** `?page=1&limit=20`
- **Sorting:** `?sortBy=due_date&sortOrder=asc`

## Pagination Strategy

All paginated responses use cursor-free offset pagination:
- Default: `page=1, limit=20`
- Max limit: `100`
- Response includes `meta.total`, `meta.totalPages`, `meta.hasNextPage`, `meta.hasPrevPage`
- `sortBy` defaults to `created_at`, `sortOrder` defaults to `desc`

---

## Common Error Codes

| HTTP | Code | When |
|---|---|---|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | Insufficient role or not resource owner |
| 404 | NOT_FOUND | Resource doesn't exist or not in workspace |
| 409 | CONFLICT | Duplicate (e.g., active sprint exists, timer already running) |
| 422 | UNPROCESSABLE | Business rule violation (e.g., end_date before start_date) |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Unexpected server error |
