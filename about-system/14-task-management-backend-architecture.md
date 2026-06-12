# Task Management — NestJS Backend Architecture

**Date:** 2026-06-02  
**Status:** Planning  
**Backend:** NestJS 10 inside `backend/src/modules/tasks/`

---

## Module Structure

```
backend/src/modules/tasks/
├── tasks.module.ts                  ← Root TasksModule — registers all sub-modules
│
├── project/
│   ├── project.module.ts
│   ├── project.controller.ts
│   ├── project.service.ts
│   ├── project.repository.ts
│   └── dto/
│       ├── create-project.dto.ts
│       ├── update-project.dto.ts
│       └── project-response.dto.ts
│
├── board/
│   ├── board.module.ts
│   ├── board.controller.ts
│   ├── board.service.ts
│   ├── board.repository.ts
│   └── dto/
│       ├── create-board.dto.ts
│       ├── update-board.dto.ts
│       ├── create-column.dto.ts
│       ├── reorder-columns.dto.ts
│       └── board-response.dto.ts
│
├── sprint/
│   ├── sprint.module.ts
│   ├── sprint.controller.ts
│   ├── sprint.service.ts
│   ├── sprint.repository.ts
│   └── dto/
│       ├── create-sprint.dto.ts
│       ├── update-sprint.dto.ts
│       ├── start-sprint.dto.ts
│       └── sprint-response.dto.ts
│
├── task/
│   ├── task.module.ts
│   ├── task.controller.ts
│   ├── task.service.ts
│   ├── task.repository.ts
│   └── dto/
│       ├── create-task.dto.ts
│       ├── update-task.dto.ts
│       ├── move-task.dto.ts
│       ├── assign-task.dto.ts
│       ├── filter-tasks.dto.ts
│       └── task-response.dto.ts
│
├── comment/
│   ├── comment.module.ts
│   ├── comment.controller.ts
│   ├── comment.service.ts
│   ├── comment.repository.ts
│   └── dto/
│       ├── create-comment.dto.ts
│       ├── update-comment.dto.ts
│       └── comment-response.dto.ts
│
├── time-tracking/
│   ├── time-tracking.module.ts
│   ├── time-tracking.controller.ts
│   ├── time-tracking.service.ts
│   ├── time-tracking.repository.ts
│   └── dto/
│       ├── start-timer.dto.ts
│       ├── stop-timer.dto.ts
│       ├── create-time-entry.dto.ts
│       ├── update-time-entry.dto.ts
│       └── time-entry-response.dto.ts
│
├── label/
│   ├── label.module.ts
│   ├── label.controller.ts
│   ├── label.service.ts
│   └── dto/
│       ├── create-label.dto.ts
│       └── label-response.dto.ts
│
├── activity/
│   ├── activity.module.ts
│   ├── activity.service.ts        ← No controller — internal only
│   └── activity.repository.ts
│
└── recurrence/
    ├── recurrence.module.ts
    ├── recurrence.service.ts      ← BullMQ worker + scheduler
    ├── recurrence.processor.ts    ← BullMQ job processor
    └── dto/
        └── set-recurrence.dto.ts
```

---

## Module Registration in AppModule

```typescript
// backend/src/app.module.ts — add to imports[]
import { TasksModule } from '@modules/tasks/tasks.module';
// ...
imports: [
  // ...existing modules...
  TasksModule,
],
```

`TasksModule` is a feature module that self-registers all sub-modules. No individual sub-modules are registered in AppModule.

---

## Controllers

### ProjectController
`@Controller('projects')` | `@UseGuards(JwtAuthGuard, RolesGuard)`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/projects` | ADMIN, TEAM_LEAD | Create project |
| GET | `/projects` | All | List workspace projects |
| GET | `/projects/:id` | All | Get project by ID |
| PATCH | `/projects/:id` | ADMIN, TEAM_LEAD, owner | Update project |
| DELETE | `/projects/:id` | ADMIN | Archive project |
| GET | `/projects/:id/boards` | All | Get boards in project |
| GET | `/projects/:id/stats` | All | Project stats (task counts, velocity) |

### BoardController
`@Controller('boards')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/boards` | ADMIN, TEAM_LEAD | Create board |
| GET | `/boards/:id` | All | Get board with columns |
| PATCH | `/boards/:id` | ADMIN, TEAM_LEAD, owner | Update board |
| DELETE | `/boards/:id` | ADMIN | Archive board |
| POST | `/boards/:id/columns` | ADMIN, TEAM_LEAD | Add column |
| PATCH | `/boards/:id/columns/reorder` | ADMIN, TEAM_LEAD | Reorder columns |
| DELETE | `/boards/:boardId/columns/:columnId` | ADMIN | Delete column |
| GET | `/boards/:id/tasks` | All | Board tasks (grouped by column) |

### SprintController
`@Controller('sprints')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/boards/:boardId/sprints` | ADMIN, TEAM_LEAD | Create sprint |
| GET | `/boards/:boardId/sprints` | All | List sprints |
| PATCH | `/sprints/:id` | ADMIN, TEAM_LEAD | Update sprint |
| POST | `/sprints/:id/start` | ADMIN, TEAM_LEAD | Start sprint |
| POST | `/sprints/:id/complete` | ADMIN, TEAM_LEAD | Complete sprint |
| GET | `/sprints/:id/velocity` | All | Velocity report |

### TaskController
`@Controller('tasks')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tasks` | All | Create task |
| GET | `/tasks` | All | List tasks (filterable) |
| GET | `/tasks/:id` | All | Get task with details |
| PATCH | `/tasks/:id` | All (owner/assignee) | Update task |
| DELETE | `/tasks/:id` | ADMIN, TEAM_LEAD, creator | Soft delete |
| POST | `/tasks/:id/move` | All | Move task to column |
| POST | `/tasks/:id/assignees` | TEAM_LEAD+ | Assign users |
| DELETE | `/tasks/:id/assignees/:userId` | TEAM_LEAD+ | Unassign user |
| POST | `/tasks/:id/watch` | All | Subscribe to task |
| DELETE | `/tasks/:id/watch` | All | Unsubscribe |
| POST | `/tasks/:id/labels` | All | Apply label |
| DELETE | `/tasks/:id/labels/:labelId` | All | Remove label |
| GET | `/tasks/:id/activity` | All | Activity log |
| GET | `/tasks/:id/subtasks` | All | Get subtasks |

### CommentController
`@Controller('tasks/:taskId/comments')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tasks/:taskId/comments` | All | Add comment |
| GET | `/tasks/:taskId/comments` | All | List comments |
| PATCH | `/comments/:id` | Author only | Edit comment |
| DELETE | `/comments/:id` | Author or ADMIN | Soft delete |

### TimeTrackingController
`@Controller('time-entries')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tasks/:taskId/timer/start` | All | Start timer |
| POST | `/tasks/:taskId/timer/stop` | All | Stop timer |
| GET | `/time-entries/running` | All | Get current running timer |
| POST | `/tasks/:taskId/time-entries` | All | Manual time entry |
| PATCH | `/time-entries/:id` | Owner only | Update entry |
| DELETE | `/time-entries/:id` | Owner or ADMIN | Delete entry |
| GET | `/tasks/:taskId/time-entries` | All | Time entries for task |
| GET | `/time-entries/report` | ADMIN, TEAM_LEAD | Team time report |

### LabelController
`@Controller('labels')`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/labels` | ADMIN, TEAM_LEAD | Create label |
| GET | `/labels` | All | Workspace labels |
| PATCH | `/labels/:id` | ADMIN, TEAM_LEAD | Update label |
| DELETE | `/labels/:id` | ADMIN | Delete label |

---

## Services

### ProjectService
```typescript
class ProjectService {
  create(dto, user): Promise<Project>
  findAll(workspaceId, filters): Promise<PaginatedResponse<Project>>
  findById(id, workspaceId): Promise<Project>
  update(id, dto, user): Promise<Project>
  archive(id, user): Promise<void>
  getStats(id, workspaceId): Promise<ProjectStats>
  // Emits: 'project.created', 'project.updated', 'project.archived'
}
```

### BoardService
```typescript
class BoardService {
  create(dto, user): Promise<Board>
  findById(id, workspaceId): Promise<BoardWithColumns>
  update(id, dto, user): Promise<Board>
  archive(id, user): Promise<void>
  addColumn(boardId, dto, user): Promise<BoardColumn>
  reorderColumns(boardId, dto, user): Promise<BoardColumn[]>
  deleteColumn(boardId, columnId, user): Promise<void>
  getTasksByColumn(boardId, workspaceId): Promise<Record<string, Task[]>>
  // Emits WebSocket: board.updated, column.reordered
}
```

### SprintService
```typescript
class SprintService {
  create(boardId, dto, user): Promise<Sprint>
  findAll(boardId, workspaceId): Promise<Sprint[]>
  findActive(boardId, workspaceId): Promise<Sprint | null>
  start(sprintId, user): Promise<Sprint>
  complete(sprintId, user): Promise<SprintCompletionResult>  // returns unfinished task list
  getVelocity(sprintId, workspaceId): Promise<VelocityReport>
  // Enforcement: only 1 active sprint per board at a time
}
```

### TaskService
```typescript
class TaskService {
  create(dto, user): Promise<Task>
  findAll(workspaceId, filters, pagination): Promise<PaginatedResponse<Task>>
  findById(id, workspaceId): Promise<TaskDetail>
  update(id, dto, user): Promise<Task>
  delete(id, user): Promise<void>
  move(id, dto, user): Promise<Task>              // change column, reorder position
  assign(id, userIds, assigner): Promise<void>
  unassign(id, userId, assigner): Promise<void>
  watch(id, userId): Promise<void>
  unwatch(id, userId): Promise<void>
  applyLabel(id, labelId, user): Promise<void>
  removeLabel(id, labelId, user): Promise<void>
  // Depends on: ActivityService, NotificationService, WebSocketService
}
```

### CommentService
```typescript
class CommentService {
  create(taskId, dto, author): Promise<Comment>
  findAll(taskId, workspaceId, pagination): Promise<PaginatedResponse<Comment>>
  update(commentId, dto, author): Promise<Comment>
  delete(commentId, actor): Promise<void>
  parseMentions(body: string): string[]  // extract @user refs
  // On create: calls ActivityService, NotificationService for each mention
}
```

### TimeTrackingService
```typescript
class TimeTrackingService {
  startTimer(taskId, userId): Promise<TimeEntry>
  stopTimer(userId): Promise<TimeEntry>
  getRunningTimer(userId): Promise<TimeEntry | null>
  createManual(taskId, dto, user): Promise<TimeEntry>
  update(entryId, dto, user): Promise<TimeEntry>
  delete(entryId, user): Promise<void>
  getTaskEntries(taskId, workspaceId): Promise<TimeEntry[]>
  getReport(workspaceId, filters): Promise<TimeReport>
  // Enforcement: one running timer per user (DB constraint + service check)
}
```

### ActivityService _(internal — no HTTP controller)_
```typescript
class ActivityService {
  log(params: ActivityLogParams): Promise<void>
  // Called by TaskService, CommentService, SprintService on every mutation
  // Writes to task_activity_log — async, non-blocking
}
```

### RecurrenceService
```typescript
class RecurrenceService {
  setRule(taskId, dto, user): Promise<RecurrenceRule>
  removeRule(taskId, user): Promise<void>
  computeNextRun(rule: RecurrenceRule): Date
  processRecurrence(rule: RecurrenceRule): Promise<Task>  // called by BullMQ job
}
```

---

## Repositories

All repositories extend `BaseRepository<T, TCreate, TUpdate>` from `@shared/repositories/base.repository`.

| Repository | Table | Key Methods |
|---|---|---|
| `ProjectRepository` | task_projects | findAllByWorkspace, findWithBoardCount |
| `BoardRepository` | task_boards | findWithColumns, findByProject |
| `SprintRepository` | task_sprints | findActive, findByBoard |
| `TaskRepository` | tasks | findAllWithFilters, findByBoard, findByAssignee, findSubtasks |
| `CommentRepository` | task_comments | findByTask (paginated), findWithReplies |
| `TimeEntryRepository` | task_time_entries | findRunning, findByTask, sumByUser |
| `ActivityRepository` | task_activity_log | findByTask, findByActor |

---

## DTOs

### CreateTaskDto
```typescript
class CreateTaskDto {
  @IsString() @MaxLength(500)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(TaskStatus)
  status?: TaskStatus;  // default: todo

  @IsOptional() @IsEnum(TaskPriority)
  priority?: TaskPriority;  // default: medium

  @IsOptional() @IsUUID()
  project_id?: string;

  @IsOptional() @IsUUID()
  board_id?: string;

  @IsOptional() @IsUUID()
  sprint_id?: string;

  @IsOptional() @IsUUID()
  column_id?: string;

  @IsOptional() @IsUUID()
  parent_task_id?: string;

  @IsOptional() @IsUUID()
  assignee_id?: string;

  @IsOptional() @IsArray() @IsUUID({ each: true })
  assignee_ids?: string[];

  @IsOptional() @IsDateString()
  due_date?: string;

  @IsOptional() @IsDateString()
  start_date?: string;

  @IsOptional() @IsInt() @Min(0)
  story_points?: number;

  @IsOptional() @IsNumber() @Min(0)
  estimated_hours?: number;

  @IsOptional() @IsArray() @IsUUID({ each: true })
  label_ids?: string[];

  @IsOptional() @IsString()
  linked_entity_type?: string;

  @IsOptional() @IsUUID()
  linked_entity_id?: string;
}
```

### FilterTasksDto
```typescript
class FilterTasksDto extends PaginationDto {
  project_id?: string;
  board_id?: string;
  sprint_id?: string;
  column_id?: string;
  assignee_id?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  label_ids?: string[];
  due_before?: string;
  due_after?: string;
  is_overdue?: boolean;
  has_no_assignee?: boolean;
  search?: string;  // searches title + description
}
```

### MoveTaskDto
```typescript
class MoveTaskDto {
  @IsUUID()
  column_id: string;

  @IsInt() @Min(0)
  position: number;

  @IsOptional() @IsUUID()
  sprint_id?: string;
}
```

---

## Events (WebSocket via WebSocketService)

| Event | Room | Payload | Trigger |
|---|---|---|---|
| `task.created` | `board:{boardId}` | task object | Task created on board |
| `task.updated` | `board:{boardId}` | task patch | Any task field updated |
| `task.moved` | `board:{boardId}` | task_id, from_column, to_column | Column change |
| `task.deleted` | `board:{boardId}` | task_id | Soft delete |
| `task.assigned` | `user:{userId}` | task summary | User assigned to task |
| `comment.created` | `board:{boardId}` | comment object | New comment |
| `mention.received` | `user:{userId}` | comment + task | User @mentioned |
| `sprint.started` | `workspace:{id}` | sprint object | Sprint activated |
| `sprint.completed` | `workspace:{id}` | sprint + stats | Sprint closed |
| `board.column_reordered` | `board:{boardId}` | columns array | Column drag |
| `timer.started` | `user:{userId}` | time_entry | Timer started |
| `timer.stopped` | `user:{userId}` | time_entry | Timer stopped |

---

## Guards and Permissions

### TaskOwnershipGuard
```typescript
// Applied to PATCH/DELETE task routes — checks user is creator, assignee, or ADMIN/TEAM_LEAD
@Injectable()
class TaskOwnershipGuard implements CanActivate {
  canActivate(ctx): boolean {
    const user = req.user;
    const task = req.task; // pre-fetched in interceptor
    return user.role >= TEAM_LEAD || task.created_by === user.id || isAssignee(task, user.id);
  }
}
```

### ProjectMemberGuard
Checks user belongs to the workspace that owns the project. Applied to all project/board/sprint routes.

---

## Notification Triggers (via `notifications` table + WebSocket)

| Event | Notified Users | Notification Type |
|---|---|---|
| Task assigned | New assignee | `task_assigned` |
| Task due tomorrow | Assignees, watchers | `task_due_soon` |
| Comment on task | Assignees, watchers | `task_commented` |
| @mention in comment | Mentioned users | `task_mentioned` |
| Task moved to Done | Creator | `task_completed` |
| Sprint starting | Board members | `sprint_starting` |
| Task overdue | Assignees | `task_overdue` |
