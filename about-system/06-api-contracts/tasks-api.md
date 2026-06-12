# Tasks API — VividCRM

## Scope Rules

- `SUPER_ADMIN` / `ADMIN` — full access to all projects, boards, tasks, time entries
- `TEAM_LEAD` — access scoped to projects their team owns and tasks within those projects
- `EMPLOYEE` — read projects they are members of; read/update tasks assigned to them; create/manage their own time entries

---

## Projects

---

### POST `/api/v1/projects`

Create a new project.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType  // CLIENT | INTERNAL | MAINTENANCE — default CLIENT

  @IsOptional()
  @IsUUID()
  dealId?: string  // link to won deal

  @IsOptional()
  @IsUUID()
  contactId?: string

  @IsOptional()
  @IsUUID()
  teamId?: string

  @IsOptional()
  @IsUUID()
  teamLeadId?: string  // project owner

  @IsOptional()
  @IsISO8601()
  startDate?: string

  @IsOptional()
  @IsISO8601()
  endDate?: string
}
```

**Response `201`:**
```json
{
  "id": "proj_abc",
  "name": "Website Redesign",
  "status": "PLANNING",
  "type": "CLIENT",
  "dealId": "deal_xyz",
  "team": { "id": "team_1", "name": "Dev Team" },
  "teamLead": { "id": "user_1", "firstName": "Arjun", "lastName": "Nair" },
  "startDate": "2025-07-01T00:00:00.000Z",
  "endDate": "2025-09-30T00:00:00.000Z",
  "createdAt": "2025-06-01T10:00:00.000Z",
  "boards": [
    {
      "id": "board_1",
      "name": "Main Board",
      "columns": [
        { "id": "col_1", "name": "To Do", "mappedStatus": "TODO", "order": 0 },
        { "id": "col_2", "name": "In Progress", "mappedStatus": "IN_PROGRESS", "order": 1 },
        { "id": "col_3", "name": "In Review", "mappedStatus": "IN_REVIEW", "order": 2 },
        { "id": "col_4", "name": "Done", "mappedStatus": "DONE", "order": 3 }
      ]
    }
  ]
}
```

**Side Effects:**
- Default board with 4 columns auto-created
- `dealId` validated: deal must be in `WON` status
- `teamLeadId` notified

---

### GET `/api/v1/projects`

**Permission:** `SUPER_ADMIN`, `ADMIN` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → member-of only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | `ProjectStatus` | Filter by status |
| `type` | `ProjectType` | CLIENT / INTERNAL / MAINTENANCE |
| `teamId` | string | Filter by team |
| `dealId` | string | Linked deal |
| `search` | string | Name search |

**Response `200`:** Paginated list. Each project: `id`, `name`, `status`, `type`, `team`, `teamLead`, `startDate`, `endDate`, `_count.tasks`, `_count.members`.

---

### GET `/api/v1/projects/:id`

**Permission:** As above, with member check for EMPLOYEE

**Response `200`:** Full project with `members[]`, `boards[]`, `sprints[]` summary, `_count`.

---

### PATCH `/api/v1/projects/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own projects

**Request Body:**
```ts
class UpdateProjectDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus
  @IsOptional() @IsUUID() teamLeadId?: string
  @IsOptional() @IsISO8601() startDate?: string
  @IsOptional() @IsISO8601() endDate?: string
}
```

**Validation:**
- Status transition must follow the defined state machine
- Completing a project (`status: COMPLETED`) triggers a completion checklist validation — returns warning list if incomplete tasks exist

---

### DELETE `/api/v1/projects/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`

Soft-delete. Blocked if project has open invoices.

---

### GET `/api/v1/projects/:id/members`

**Permission:** Project members + ADMIN + SUPER_ADMIN

**Response `200`:**
```json
{
  "data": [
    {
      "userId": "user_1",
      "user": { "id": "user_1", "firstName": "Arjun", "lastName": "Nair", "role": "TEAM_LEAD" },
      "joinedAt": "2025-06-01T10:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/v1/projects/:id/members`

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team's project, team-scoped users only

**Request Body:**
```ts
class AddProjectMemberDto {
  @IsUUID()
  userId: string
}
```

**Response `201`:** ProjectMember object.

**Validation:**
- User must be active in workspace
- TEAM_LEAD: user must be in their team

---

### DELETE `/api/v1/projects/:id/members/:userId`

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own project

**Validation:** If user has open tasks, returns a 409 with task list — caller must reassign or cancel tasks first.

---

## Boards and Columns

---

### GET `/api/v1/projects/:id/boards`

**Permission:** Project members + ADMIN + SUPER_ADMIN

**Response `200`:** All boards for the project, each with `columns[]` and task counts per column.

---

### POST `/api/v1/projects/:id/boards`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own project)

**Request Body:**
```ts
class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string
}
```

---

### PATCH `/api/v1/boards/:boardId`

Rename board or reorder columns.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own project)

**Request Body:**
```ts
class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  columnOrder?: string[]  // ordered array of column IDs
}
```

---

### POST `/api/v1/boards/:boardId/columns`

Add a new column to a board.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateBoardColumnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string

  @IsOptional()
  @IsEnum(TaskStatus)
  mappedStatus?: TaskStatus  // default IN_PROGRESS

  @IsOptional()
  @IsInt()
  @Min(1)
  wipLimit?: number
}
```

**Validation:** Max 8 columns per board.

---

### PATCH `/api/v1/boards/columns/:columnId`

**Request Body:** `name`, `wipLimit`, `mappedStatus` (all optional).

---

### DELETE `/api/v1/boards/columns/:columnId`

**Validation:** Column must be empty (no tasks in it).

---

## Tasks

---

### POST `/api/v1/tasks`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own project); `EMPLOYEE` (own project membership only)

**Request Body:**
```ts
class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority  // LOW | MEDIUM | HIGH | URGENT

  @IsOptional()
  @IsUUID()
  projectId?: string

  @IsOptional()
  @IsUUID()
  boardColumnId?: string

  @IsOptional()
  @IsUUID()
  sprintId?: string

  @IsOptional()
  @IsUUID()
  assigneeId?: string

  @IsOptional()
  @IsISO8601()
  dueDate?: string

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(999)
  estimatedHours?: number

  @IsOptional()
  @IsUUID()
  parentTaskId?: string

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  labelIds?: string[]
}
```

**Response `201`:** Full task object.

**Validation:**
- `projectId` must exist and not be CANCELLED/ARCHIVED
- `assigneeId` must be an active project member
- `parentTaskId` — the parent must not itself be a subtask (max one level of nesting)
- `labelIds` — all must exist in workspace
- TEAM_LEAD: `assigneeId` must be in their team
- EMPLOYEE: can only create tasks in their project membership; cannot assign to others

---

### GET `/api/v1/tasks`

**Permission:** `SUPER_ADMIN`, `ADMIN` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → assigned to self

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `projectId` | string | Filter by project |
| `sprintId` | string | Filter by sprint |
| `assigneeId` | string | Filter by assignee |
| `status` | `TaskStatus` | Filter by status |
| `priority` | `TaskPriority` | Filter by priority |
| `isBlocked` | boolean | Blocked tasks only |
| `parentTaskId` | string | Get subtasks of a parent |
| `labelIds` | string[] | Filter by labels (OR logic) |
| `dueBefore` | date | Due before date |
| `dueAfter` | date | Due after date |
| `search` | string | Title search |
| `boardColumnId` | string | Tasks in a board column |

**Response `200`:** Paginated tasks list. Each task includes `assignee`, `project`, `sprint`, `labels[]`, `_count.subtasks`, `_count.comments`, `_count.timeEntries`.

---

### GET `/api/v1/tasks/:id`

**Permission:** Same scope as list.

**Response `200`:**
```json
{
  "id": "task_abc",
  "title": "Implement login page",
  "description": "Build the login form with JWT flow.",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "isBlocked": false,
  "blockerType": null,
  "blockerDescription": null,
  "dueDate": "2025-07-10T00:00:00.000Z",
  "estimatedHours": 8,
  "startedAt": "2025-06-15T09:00:00.000Z",
  "completedAt": null,
  "project": { "id": "proj_abc", "name": "Website Redesign" },
  "sprint": { "id": "sprint_1", "name": "Sprint 1" },
  "boardColumn": { "id": "col_2", "name": "In Progress" },
  "assignee": { "id": "user_1", "firstName": "Arjun", "lastName": "Nair" },
  "createdBy": { "id": "user_2", "firstName": "Jane", "lastName": "Smith" },
  "parentTaskId": null,
  "labels": [{ "id": "label_1", "name": "Frontend", "color": "#3b82f6" }],
  "recurringTemplateId": null,
  "_count": { "subtasks": 2, "comments": 4, "timeEntries": 3, "watchers": 2 },
  "totalLoggedHours": 6.5,
  "createdAt": "2025-06-01T10:00:00.000Z",
  "updatedAt": "2025-06-15T09:00:00.000Z"
}
```

---

### PATCH `/api/v1/tasks/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own team); `EMPLOYEE` → status, comments, time entries only (not assignee or due date)

**Request Body:**
```ts
class UpdateTaskDto {
  @IsOptional() @IsString() @MaxLength(500) title?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority
  @IsOptional() @IsUUID() assigneeId?: string
  @IsOptional() @IsUUID() boardColumnId?: string
  @IsOptional() @IsUUID() sprintId?: string
  @IsOptional() @IsISO8601() dueDate?: string
  @IsOptional() @IsNumber() @Min(0.25) estimatedHours?: number
  @IsOptional() @IsBoolean() isBlocked?: boolean
  @IsOptional() @IsEnum(BlockerType) blockerType?: BlockerType
  @IsOptional() @IsString() blockerDescription?: string
  @IsOptional() @IsString() blockerResolutionNote?: string  // required when isBlocked: false after being true
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) labelIds?: string[]
  @IsOptional() @IsInt() @Min(0) order?: number
}
```

**Validation:**
- Status transition must follow the state machine
- `isBlocked: false` requires `blockerResolutionNote`
- Cannot move to `DONE` via PATCH if subtasks are not completed — returns warning
- EMPLOYEE: cannot change `assigneeId`, `dueDate`, `priority`, `sprintId`

---

### DELETE `/api/v1/tasks/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own team)

Soft-delete. Cannot delete a task with `BILLED` time entries.

---

### POST `/api/v1/tasks/:id/block`

Mark a task as blocked with reason.

**Permission:** Assignee (EMPLOYEE), `TEAM_LEAD`, `ADMIN`, `SUPER_ADMIN`

**Request Body:**
```ts
class BlockTaskDto {
  @IsEnum(BlockerType)
  blockerType: BlockerType

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  blockerDescription: string

  @IsOptional()
  @IsUUID()
  blockerTaskId?: string  // linked blocking task
}
```

---

### POST `/api/v1/tasks/:id/unblock`

Resolve a blocker and return task to IN_PROGRESS.

**Request Body:**
```ts
class UnblockTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionNote: string
}
```

---

## Task Comments

---

### GET `/api/v1/tasks/:id/comments`

**Permission:** Project members + ADMIN + SUPER_ADMIN

**Response `200`:**
```json
{
  "data": [
    {
      "id": "comment_1",
      "content": "This will need the design file first. @arjun can you check?",
      "isEdited": false,
      "isDeleted": false,
      "author": { "id": "user_2", "firstName": "Jane", "lastName": "Smith", "avatarUrl": null },
      "mentions": [{ "userId": "user_1", "firstName": "Arjun" }],
      "createdAt": "2025-06-15T10:30:00.000Z"
    }
  ],
  "meta": { "total": 4, "page": 1, "limit": 50, "totalPages": 1 }
}
```

---

### POST `/api/v1/tasks/:id/comments`

**Permission:** Project members + ADMIN + SUPER_ADMIN

**Request Body:**
```ts
class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[]
}
```

**Response `201`:** Comment object with mentions.

**Side Effects:**
- Notifications dispatched to `@mentioned` users (in-app + email)
- Task watchers notified (in-app only)
- Commenter added to watchers list (if not already)

---

### PATCH `/api/v1/tasks/:id/comments/:commentId`

**Permission:** Comment author (within 15 minutes of creation); `SUPER_ADMIN`

**Request Body:**
```ts
class UpdateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[]
}
```

**Validation:** Returns 403 if caller is the author but more than 15 minutes have passed.

---

### DELETE `/api/v1/tasks/:id/comments/:commentId`

**Permission:** Author (within 15 min), `TEAM_LEAD` (own team), `ADMIN`, `SUPER_ADMIN`

Sets `isDeleted: true`. Content replaced with null. Comment remains in thread as `"[deleted]"`.

---

## Task Watchers

---

### GET `/api/v1/tasks/:id/watchers`

**Permission:** Project members + ADMIN

**Response `200`:** Array of user summaries.

---

### POST `/api/v1/tasks/:id/watchers`

**Permission:** Any project member (watch/unwatch themselves); `TEAM_LEAD`+ (add others)

**Request Body:**
```ts
class AddWatcherDto {
  @IsUUID()
  userId: string
}
```

---

### DELETE `/api/v1/tasks/:id/watchers/:userId`

**Permission:** The watcher themselves, or `TEAM_LEAD`+.

---

## Time Entries

---

### POST `/api/v1/time-entries`

**Permission:** `EMPLOYEE`, `TEAM_LEAD`, `ADMIN`, `SUPER_ADMIN`

**Request Body:**
```ts
class CreateTimeEntryDto {
  @IsUUID()
  taskId: string

  @IsOptional()
  @IsUUID()
  projectId?: string  // auto-derived from task if omitted

  @IsISO8601()
  @IsDateString()
  date: string  // YYYY-MM-DD format

  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean  // default true

  @IsOptional()
  @IsNumber()
  @Min(0)
  billableRate?: number
}
```

**Response `201`:** TimeEntry object.

**Validation:**
- `date` — cannot be in the future; cannot be more than 30 days in the past without TEAM_LEAD permission
- `taskId` — must not be CANCELLED or ARCHIVED
- `hours` — increments of 0.25 (15 minutes); maximum 24 per entry
- EMPLOYEE: `taskId` must be assigned to them or in their project membership
- Multiple entries per task per day are permitted; they accumulate

---

### GET `/api/v1/time-entries`

**Permission:** `SUPER_ADMIN`, `ADMIN` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → own entries only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `taskId` | string | Filter by task |
| `projectId` | string | Filter by project |
| `userId` | string | Filter by user |
| `status` | `TimeEntryStatus` | DRAFT / SUBMITTED / APPROVED / REJECTED / BILLED |
| `isBillable` | boolean | Billable entries only |
| `dateFrom` | date | Date range start |
| `dateTo` | date | Date range end |

**Response `200`:** Paginated entries with `task`, `project`, `user` embedded.

---

### GET `/api/v1/time-entries/:id`
### PATCH `/api/v1/time-entries/:id`

PATCH only allowed when status is `DRAFT` or `REJECTED`. Same shape as CreateTimeEntryDto (all optional).

---

### DELETE `/api/v1/time-entries/:id`

**Permission:** Owner (when DRAFT only); `TEAM_LEAD`+ (when DRAFT or REJECTED)

Cannot delete `BILLED` entries.

---

### POST `/api/v1/time-entries/:id/submit`

Move entry from DRAFT to SUBMITTED.

**Permission:** Entry owner

**Request Body:** None.

**Response `200`:** Updated time entry with `status: "SUBMITTED"`.

**Side Effects:** TEAM_LEAD notified.

---

### POST `/api/v1/time-entries/:id/approve`

**Permission:** `TEAM_LEAD` (own team entries), `ADMIN`, `SUPER_ADMIN`

**Request Body:** None.

**Side Effects:** Entry owner notified.

---

### POST `/api/v1/time-entries/:id/reject`

**Permission:** `TEAM_LEAD` (own team), `ADMIN`, `SUPER_ADMIN`

**Request Body:**
```ts
class RejectTimeEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string
}
```

**Side Effects:** Entry owner notified with reason; entry reverts to DRAFT.

---

## Sprints

---

### POST `/api/v1/projects/:projectId/sprints`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own project)

**Request Body:**
```ts
class CreateSprintDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  goal?: string

  @IsOptional()
  @IsISO8601()
  startDate?: string

  @IsOptional()
  @IsISO8601()
  endDate?: string
}
```

---

### GET `/api/v1/projects/:projectId/sprints`

**Permission:** Project members + ADMIN + SUPER_ADMIN

**Query Parameters:** `status`

---

### GET `/api/v1/sprints/:id`

Includes sprint tasks, completion metrics.

---

### PATCH `/api/v1/sprints/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:** `name`, `goal`, `startDate`, `endDate` (all optional). Status transitions via dedicated actions.

---

### POST `/api/v1/sprints/:id/start`

Move sprint from PLANNED to ACTIVE.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Validation:** Only one ACTIVE sprint allowed per project at a time.

**Response `200`:** Updated sprint object.

---

### POST `/api/v1/sprints/:id/complete`

Close an active sprint.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CompleteSprintDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncompleteTaskDispositionDto)
  incompleteTaskDispositions: IncompleteTaskDispositionDto[]
}

class IncompleteTaskDispositionDto {
  @IsUUID()
  taskId: string

  @IsEnum(['BACKLOG', 'NEXT_SPRINT', 'CANCEL'])
  action: string

  @IsOptional()
  @IsUUID()
  nextSprintId?: string  // required when action = NEXT_SPRINT
}
```

**Response `200`:**
```json
{
  "sprint": { "id": "sprint_1", "status": "COMPLETED", "completedAt": "..." },
  "report": {
    "plannedTaskCount": 12,
    "completedTaskCount": 9,
    "carryOverCount": 2,
    "cancelledCount": 1,
    "completionRate": 75
  }
}
```

---

### DELETE `/api/v1/sprints/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

Only allowed when status is `DRAFT` or `PLANNED`. Tasks are returned to backlog.

---

## Recurring Task Templates

---

### POST `/api/v1/recurring-templates`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateRecurringTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsUUID()
  projectId?: string

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  estimatedHours?: number

  @IsOptional()
  @IsUUID()
  assigneeId?: string

  @IsEnum(RecurringFrequency)
  frequency: RecurringFrequency

  @IsOptional()
  @IsString()
  cronExpression?: string  // required when frequency = CUSTOM

  @IsISO8601()
  startDate: string

  @IsOptional()
  @IsISO8601()
  endDate?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number
}
```

---

### GET `/api/v1/recurring-templates`

**Query Parameters:** `status`, `projectId`, standard pagination.

---

### PATCH `/api/v1/recurring-templates/:id`

Includes `status` field to pause/resume/archive.

---

### DELETE `/api/v1/recurring-templates/:id`

Sets status to ARCHIVED. Future scheduled jobs cancelled.

---

## Task Labels

---

### POST `/api/v1/task-labels`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateTaskLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string

  @IsOptional()
  @IsHexColor()
  color?: string  // default: #94a3b8
}
```

---

### GET `/api/v1/task-labels`

All labels for the workspace.

---

### DELETE `/api/v1/task-labels/:id`

**Permission:** `SUPER_ADMIN`, `ADMIN`

Removes label from all tasks (cascades via junction table).

---

## Reports (Tasks)

---

### GET `/api/v1/tasks/reports/workload`

Team workload summary — tasks per assignee.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Query Parameters:** `teamId`, `projectId`, `status`

**Response `200`:**
```json
{
  "data": [
    {
      "user": { "id": "user_1", "firstName": "Arjun", "lastName": "Nair" },
      "taskCounts": {
        "TODO": 3,
        "IN_PROGRESS": 4,
        "BLOCKED": 1,
        "IN_REVIEW": 2
      },
      "totalEstimatedHours": 48,
      "totalLoggedHours": 32
    }
  ]
}
```

---

### GET `/api/v1/tasks/reports/time-summary`

Time logged summary by project / user / date range.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team; `EMPLOYEE` → own only

**Query Parameters:** `projectId`, `userId`, `dateFrom`, `dateTo`, `isBillable`

**Response `200`:**
```json
{
  "totalHours": 128.5,
  "billableHours": 96.0,
  "nonBillableHours": 32.5,
  "byUser": [
    { "userId": "user_1", "name": "Arjun Nair", "hours": 64.0, "billable": 48.0 }
  ],
  "byProject": [
    { "projectId": "proj_abc", "name": "Website Redesign", "hours": 96.0 }
  ]
}
```
