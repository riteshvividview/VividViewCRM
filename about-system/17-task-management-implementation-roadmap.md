# Task Management — Implementation Roadmap

**Date:** 2026-06-02  
**Status:** Planning  
**Total Estimated Duration:** 8 weeks  
**Prerequisite:** Auth module must be complete before Phase 2

---

## Phase 1 — Database Extensions
**Duration:** 3–4 days  
**Who:** Backend engineer (DBA role)  
**Output:** All new tables live in Supabase, schema.prisma updated

### Tasks
- [ ] Create `task_projects` table + indexes + RLS
- [ ] Create `task_boards` table + indexes + RLS
- [ ] Create `task_board_columns` table + indexes
- [ ] Create `task_sprints` table + indexes (includes one-active-per-board constraint)
- [ ] `ALTER TABLE tasks` — add 9 new nullable columns
- [ ] Create `task_labels` table
- [ ] Create `task_comments` table + indexes
- [ ] Create `task_mentions` table + indexes
- [ ] Create `task_activity_log` table + REVOKE UPDATE/DELETE
- [ ] Create `task_time_entries` table + indexes + one-running-per-user constraint
- [ ] Create `task_recurrence_rules` table + indexes
- [ ] Create `task_label_assignments` junction table
- [ ] Create `task_assignees` junction table
- [ ] Create `task_watchers` junction table
- [ ] Run `npx prisma db pull` to regenerate schema.prisma
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Verify TypeScript compiles with zero errors

### You Must Do
1. Execute each SQL block from `13-task-management-db-extension-plan.md` in the Supabase SQL editor
2. Follow the migration execution order in that document exactly
3. After all tables are created, run: `cd backend && npx prisma db pull && npx prisma generate`
4. Commit the updated `schema.prisma` and regenerated client

---

## Phase 2 — NestJS Modules (Foundation)
**Duration:** 3–4 days  
**Depends on:** Phase 1 complete, Auth module complete

### Tasks
- [ ] Create `backend/src/modules/tasks/tasks.module.ts` (root module)
- [ ] Create `ProjectModule` — controller, service, repository, DTOs
- [ ] Create `BoardModule` — controller, service, repository, DTOs (includes column management)
- [ ] Create `SprintModule` — controller, service, repository, DTOs
- [ ] Create `TaskModule` — controller, service, repository, DTOs
- [ ] Create `LabelModule` — controller, service, DTOs
- [ ] Register `TasksModule` in `AppModule`
- [ ] Write unit tests for each service (happy path)
- [ ] Verify Swagger UI shows all new endpoints at `/api/docs`

---

## Phase 3 — Services (Business Logic)
**Duration:** 5–6 days  
**Depends on:** Phase 2

### 3A — Core Task Operations
- [ ] `TaskService.create()` — creates task, syncs assignees to `task_assignees`, emits WebSocket
- [ ] `TaskService.update()` — partial update, auto-sets `completed_at`, logs to `task_activity_log`
- [ ] `TaskService.move()` — updates `column_id` + `position`, reorders siblings, emits `task.moved`
- [ ] `TaskService.findAll()` — filtering, sorting, pagination, EMPLOYEE scope enforcement
- [ ] `TaskService.findById()` — enriched response with assignees, labels, subtask count, time summary
- [ ] `ActivityService.log()` — async write to `task_activity_log` (called from TaskService)

### 3B — Comments and Mentions
- [ ] `CommentService.create()` — save comment, parse @mentions, notify mentioned users
- [ ] `CommentService` — threading (parent_comment_id), soft delete
- [ ] `MentionService` — extract @refs from comment body, create `task_mentions` rows
- [ ] Integration: comment creation → notification → WebSocket event

### 3C — Sprint Management
- [ ] `SprintService.start()` — validates one-active-per-board rule, moves backlog tasks in
- [ ] `SprintService.complete()` — computes velocity, handles incomplete tasks per user choice
- [ ] Sprint backlog management — task assignment to sprint / removal

### 3D — Time Tracking
- [ ] `TimeTrackingService.startTimer()` — checks for existing running timer, creates entry
- [ ] `TimeTrackingService.stopTimer()` — sets `ended_at`, computes `duration_minutes`
- [ ] `TimeTrackingService.createManual()` — validates overlap, creates complete entry
- [ ] `TimeTrackingService.getReport()` — grouped aggregation query

### 3E — Recurrence Engine
- [ ] `RecurrenceService.setRule()` — validates rule, computes `next_run_at`, saves
- [ ] `RecurrenceService.processRecurrence()` — creates new task from template, updates `next_run_at`
- [ ] `RecurrenceProcessor` — BullMQ job handler on `recurring-tasks` queue
- [ ] BullMQ delayed job scheduling — re-schedules after each occurrence

---

## Phase 4 — Permissions and Guards
**Duration:** 2 days  
**Depends on:** Phase 3

- [ ] Implement `TaskOwnershipGuard` — EMPLOYEE access check
- [ ] Implement `BoardAccessGuard` — private board visibility
- [ ] Implement `TeamScopeGuard` — TEAM_LEAD team boundary
- [ ] Implement `CommentAuthorGuard` — edit own comment only
- [ ] Apply guards to all task management controllers
- [ ] Test EMPLOYEE role — cannot see other users' tasks
- [ ] Test TEAM_LEAD role — can only manage own team's boards
- [ ] Test HR role — read-only access confirmed
- [ ] Write E2E tests for permission boundary cases

---

## Phase 5 — Real-time (WebSocket)
**Duration:** 2 days  
**Depends on:** Phase 3, Auth module (for valid JWT)

- [ ] Wire all task events to `WebSocketService.emitToBoard()`
- [ ] `task.created` → board room
- [ ] `task.updated` → board room
- [ ] `task.moved` → board room (includes old/new column info)
- [ ] `task.deleted` → board room
- [ ] `comment.created` → board room
- [ ] `task.assigned` → user room
- [ ] `mention.received` → user room
- [ ] `sprint.started` / `sprint.completed` → workspace room
- [ ] `board.column_reordered` → board room
- [ ] `timer.started` / `timer.stopped` → user room
- [ ] Test with Postman WebSocket client or custom test client
- [ ] Due-date reminder BullMQ job — scans tasks due tomorrow, emits `task_due_soon` notifications

---

## Phase 6 — Frontend Integration
**Duration:** 2 weeks  
**Depends on:** Phase 5 (all APIs available)  
**Design Rule:** Mobile-first, Tablet second, Desktop third

### Responsive Strategy

```
Mobile  (< 640px):   Single column view. Task list only. Slide-in detail panel.
Tablet  (640–1024px): Two-column. Project sidebar + task list. Board as scrollable columns.
Desktop (> 1024px):  Full Kanban/Scrum board. Drag-and-drop columns. Fixed sidebar.
```

### 6A — Project & Board Views
- [ ] Projects list page (mobile: cards, desktop: table)
- [ ] Board view — Kanban column layout (Tailwind grid, horizontal scroll on mobile)
- [ ] Board task card — compact (title, priority, assignee avatar, due date, label dots)
- [ ] Board filters bar (assignee, status, priority, label, search)
- [ ] Project stats dashboard (task counts, velocity sparkline)

### 6B — Task Detail
- [ ] Task detail — full-screen modal on mobile, right-side panel on desktop
- [ ] Inline editing for title, description, priority, due date
- [ ] Assignee multi-select picker
- [ ] Label picker (color chips)
- [ ] Subtask list with completion checkboxes
- [ ] Activity log feed (timeline style)

### 6C — Comments
- [ ] Comment thread — markdown rendering
- [ ] @mention autocomplete input (type `@` → dropdown of workspace users)
- [ ] Reply threading (collapse/expand)
- [ ] Edit/delete own comments

### 6D — Time Tracking
- [ ] Timer widget — floating/sticky on mobile, toolbar item on desktop
- [ ] Start/stop with running indicator (pulsing dot)
- [ ] Manual time entry form
- [ ] Per-task time summary

### 6E — Sprint Management
- [ ] Sprint board header with days remaining + progress bar
- [ ] Start/complete sprint actions
- [ ] Backlog view (list of unassigned sprint tasks)
- [ ] Velocity chart (bar chart per sprint)

### 6F — Real-time Updates
- [ ] Socket.IO client connecting to `/notifications`
- [ ] Board room subscription on open
- [ ] Optimistic UI updates (task move before server ack)
- [ ] Toast notification for @mentions and assignments

---

## Phase 7 — Testing
**Duration:** 3–4 days  
**Parallel with:** Phase 6

### Unit Tests
- [ ] `ProjectService` — create, findAll with filters, archive
- [ ] `TaskService` — create, update, move, EMPLOYEE scope filtering
- [ ] `SprintService` — start (conflict check), complete (velocity calc), incomplete task handling
- [ ] `TimeTrackingService` — start (one running), stop, overlap validation
- [ ] `CommentService` — @mention parsing, notification trigger
- [ ] `RecurrenceService` — next_run_at computation for each frequency type

### Integration / E2E Tests
- [ ] `POST /projects` → board is created with default columns
- [ ] `POST /tasks` → activity log entry created
- [ ] `PATCH /tasks/:id` (status → done) → completed_at set automatically
- [ ] `POST /timer/start` → `POST /timer/start` returns 409
- [ ] `POST /sprints/:id/start` → second start returns 409
- [ ] `POST /sprints/:id/complete` → incomplete tasks handled correctly
- [ ] EMPLOYEE cannot see other user's tasks
- [ ] TEAM_LEAD cannot manage another team's board

### Load Testing
- [ ] 100 concurrent users submitting task updates on same board
- [ ] WebSocket: 50 concurrent clients subscribed to board room

---

## Overall Completion After Task Management

```
Phase 1 — Backend Foundation     ██████████  90%  (auth module still needed)
Task Management                  ░░░░░░░░░░   0%  (starts now)
Phase 3 — HRMS                   ░░░░░░░░░░   0%
Phase 4 — Invoice                ░░░░░░░░░░   0%
──────────────────────────────────────────────────
OVERALL PROJECT (after TM done)  ████░░░░░░  ~35%
```

---

## Dependencies Summary

```
Auth Module              ← Must be built FIRST (gates JWT on all task APIs)
     │
     ▼
Phase 1: DB Extensions   ← Run SQL in Supabase, pull schema, generate Prisma client
     │
     ▼
Phase 2: NestJS Modules  ← Scaffold all modules, controllers, services
     │
     ▼
Phase 3: Business Logic  ← Services, activity log, recurrence, time tracking
     │
     ├── Phase 4: Guards & Permissions (can overlap with Phase 3)
     │
     ▼
Phase 5: WebSocket       ← Wire events, test real-time
     │
     ▼
Phase 6: Frontend        ← Consume APIs, Kanban UI, mobile-first
     │
     ▼
Phase 7: Testing         ← Can start unit tests in Phase 3, E2E in Phase 6
```
