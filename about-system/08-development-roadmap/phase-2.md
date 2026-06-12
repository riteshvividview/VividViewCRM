# Phase 2 — CRM + Task Management

## Phase Summary

| Attribute | Value |
|---|---|
| **Phase** | 2 of 6 (covers product Phases 2 and 3) |
| **Duration** | 8 weeks (4 × 2-week sprints) |
| **Overall Completion** | `░░░░░░░░░░` 0% |
| **Status** | Not Started |
| **Prerequisite** | Phase 1 fully complete |
| **Goal** | Deliver a fully operational CRM pipeline (Leads → Deals → Contacts → Companies → Campaigns → Mailing) and a complete Task Management system (Projects → Boards → Tasks → Time Tracking → Sprints) |

---

## Phase Completion Tracker

```
── CRM Backend ──────────────────────────────────────────
Lead Module (BE)              ░░░░░░░░░░   0%
Deal Module (BE)              ░░░░░░░░░░   0%
Contact Module (BE)           ░░░░░░░░░░   0%
Company Module (BE)           ░░░░░░░░░░   0%
Campaign Module (BE)          ░░░░░░░░░░   0%
Mailing Module (BE)           ░░░░░░░░░░   0%
CRM Activity Log (BE)         ░░░░░░░░░░   0%
CRM Reports (BE)              ░░░░░░░░░░   0%

── CRM Frontend ─────────────────────────────────────────
Leads UI                      ░░░░░░░░░░   0%
Deals / Pipeline UI           ░░░░░░░░░░   0%
Contacts UI                   ░░░░░░░░░░   0%
Companies UI                  ░░░░░░░░░░   0%
Campaigns & Mailing UI        ░░░░░░░░░░   0%
CRM Dashboard                 ░░░░░░░░░░   0%

── Tasks Backend ────────────────────────────────────────
Project Module (BE)           ░░░░░░░░░░   0%
Board & Column Module (BE)    ░░░░░░░░░░   0%
Task Module (BE)              ░░░░░░░░░░   0%
Comment & Mention (BE)        ░░░░░░░░░░   0%
Time Entry Module (BE)        ░░░░░░░░░░   0%
Sprint Module (BE)            ░░░░░░░░░░   0%
Recurring Task (BE)           ░░░░░░░░░░   0%
Task Notifications (BE)       ░░░░░░░░░░   0%

── Tasks Frontend ───────────────────────────────────────
Project List & Detail UI      ░░░░░░░░░░   0%
Kanban Board UI               ░░░░░░░░░░   0%
Task Detail Side Panel        ░░░░░░░░░░   0%
Sprint Board UI               ░░░░░░░░░░   0%
Time Tracking UI              ░░░░░░░░░░   0%
Calendar Sync UI              ░░░░░░░░░░   0%
─────────────────────────────────────────────────────────
PHASE 2 TOTAL                 ░░░░░░░░░░   0%
```

---

## Sprint 3 — Week 5–6: CRM Backend

### 2.1 Lead Module

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

**Backend endpoints:**
```
POST   /api/v1/leads
GET    /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
DELETE /api/v1/leads/:id
POST   /api/v1/leads/:id/convert
POST   /api/v1/leads/:id/activities
GET    /api/v1/leads/:id/activities
```

**Service tasks:**
- [ ] `LeadsService.create(dto, actorId, workspaceId)` — creates lead, writes CrmActivity `STATUS_CHANGED → NEW`, writes AuditLog `CREATE`
- [ ] `LeadsService.findAll(filters, pagination)` — workspace-scoped, role-filtered (TEAM_LEAD sees own team only), full-text search using pg_trgm
- [ ] `LeadsService.findOne(id)` — includes `assignedTo`, `team`, `campaign`, activity count, document count
- [ ] `LeadsService.update(id, dto)` — diff-based CrmActivity creation (only logs changed fields), AuditLog `UPDATE`
- [ ] `LeadsService.delete(id)` — soft-delete blocked if lead is CONVERTED (deal exists)
- [ ] `LeadsService.convert(id, dto)` — transactional: creates Deal + Contact + Company in one Prisma transaction; sets lead status CONVERTED; writes CrmActivity; AuditLog
- [ ] `LeadsService.createActivity(leadId, dto)` — manual activity log (NOTE_ADDED, CALL_LOGGED, etc.)
- [ ] `LeadsService.getActivities(leadId, pagination)` — chronological, paginated
- [ ] Status transition enforcement — service-layer state machine validation before any status update
- [ ] Disqualification reason required when status → DISQUALIFIED
- [ ] TEAM_LEAD scope enforcement — service checks `user.teamIds` includes lead's teamId; throws 403 if not

**DTOs:**
- [ ] `CreateLeadDto` — all fields with class-validator decorators (from API contract)
- [ ] `UpdateLeadDto` — all optional version of CreateLeadDto
- [ ] `ConvertLeadDto`
- [ ] `LeadFiltersDto` — query params DTO
- [ ] `LeadResponseDto` — serialized shape (excludes workspaceId)
- [ ] `CreateCrmActivityDto`

**Definition of Done:** All endpoints return correct data; convert creates all three records atomically; TEAM_LEAD cannot access other team's leads (403); activity log appended correctly on every mutation.

---

### 2.2 Deal Module

**Estimate:** 2.5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST   /api/v1/deals
GET    /api/v1/deals
GET    /api/v1/deals/:id
PATCH  /api/v1/deals/:id
DELETE /api/v1/deals/:id
POST   /api/v1/deals/:id/win
POST   /api/v1/deals/:id/lose
GET    /api/v1/deals/:id/activities
POST   /api/v1/deals/:id/activities
```

**Service tasks:**
- [ ] `DealsService.win(id, dto)` — sets status WON, closedAt, finalValue; optionally creates Project (calls ProjectsService in Tasks module); optionally creates Invoice draft; writes CrmActivity + AuditLog
- [ ] `DealsService.lose(id, dto)` — requires lossReason from enum; updates revenue reporting data
- [ ] Deal status transitions enforced (cannot go directly NEW → WON)
- [ ] WON deals cannot be soft-deleted — must be reopened first (SUPER_ADMIN only)
- [ ] Deal → Project creation is a cross-module call: `ProjectsService.createFromDeal(deal)`
- [ ] Probability field auto-set based on stage if not manually overridden:
  - QUALIFICATION: 20%, PROPOSAL: 40%, NEGOTIATION: 70%, WON: 100%, LOST: 0%
- [ ] Revenue roll-up: on WON, aggregate workspace revenue metric in Redis (for dashboard)

---

### 2.3 Contact and Company Modules

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints (same CRUD pattern):**
```
POST / GET / GET:id / PATCH / DELETE  for both /contacts and /companies
```

- [ ] Contact unique email per workspace (soft-enforced — warn in response, don't block)
- [ ] Company archive blocked if open deals exist — return list of blocking deals
- [ ] Contact archive blocked if open deals exist
- [ ] `CompaniesService.findOne` includes embedded contacts list (first 5, with count)
- [ ] Auto-create Company stub during lead conversion if company name exists but no Company record

---

### 2.4 Campaign and Mailing Modules

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Campaign endpoints:**
```
POST / GET / GET:id / PATCH / DELETE / POST:id/launch
```

**Mailing endpoints:**
```
POST / GET / GET:id / PATCH
POST /:id/send
GET  /:id/recipients
```

- [ ] `MailingService.send(id, dto)` — validates REVIEW status; locks recipient list; schedules BullMQ job (`campaign-send`) for immediate or scheduled dispatch
- [ ] `CampaignSendProcessor` — BullMQ worker; calls Brevo API in batches of 500 recipients per call
- [ ] Brevo webhook endpoint: `POST /api/v1/webhooks/brevo` — updates MailingRecipient delivery stats (opened, clicked, bounced)
- [ ] Rate limiting on Brevo API calls: respects Brevo's per-minute rate limit
- [ ] Mailing status machine enforced: cannot send from DRAFT (must be REVIEW first)
- [ ] Failed sends: increment `totalBounced`, flag mailing as FAILED if bounce rate > 20%

---

### 2.5 CRM Reports

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
GET /api/v1/crm/reports/pipeline
GET /api/v1/crm/reports/lead-sources
GET /api/v1/crm/reports/revenue
```

- [ ] Pipeline summary: `GROUP BY status` with SUM(value) and COUNT — single Prisma `groupBy` query
- [ ] Lead source breakdown: conversion rate per source (converted leads / total leads per source)
- [ ] Revenue report: WON deals grouped by month — Prisma `groupBy` on `closedAt` with `year` + `month` extraction
- [ ] All reports respect TEAM_LEAD scope filter (only their team's data)
- [ ] Report endpoints paginate and accept `from`/`to` date range params

---

## Sprint 4 — Week 7–8: CRM Frontend

### 2.6 CRM Dashboard

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] KPI row: Open Leads, Pipeline Value, Won This Month, Conversion Rate
- [ ] Revenue line chart: 12-month actual vs target (using Recharts via Shadcn Charts)
- [ ] Pipeline funnel horizontal bar chart: deals by stage with value
- [ ] Recent activity feed: last 10 CRM activities across all leads/deals
- [ ] Quick action: "Add Lead" button shortcut
- [ ] All widgets use TanStack Query with skeleton loading states

---

### 2.7 Leads UI

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Lead List page** (`/leads`):
  - Responsive: card view on mobile, table view on tablet+
  - Columns (desktop): Name, Company, Status badge, Source, Assigned To, Created At, Actions
  - Filters: status, source, assigned to, team, date range — all in a filter popover
  - Search: debounced 300ms, queries `search` param
  - Sort: by created date, name (click column header)
  - Pagination: page controls + per-page selector
  - "Convert" quick action on qualified leads
  - Empty state with "Add Lead" CTA
  - Skeleton loading on initial load

- [ ] **Lead Detail page** (`/leads/:id`):
  - Page header: name, status badge, back button on mobile
  - Action buttons: Edit, Convert (if QUALIFIED), Disqualify, Delete (with confirm)
  - Mobile: tabbed (Details | Activity | Documents)
  - Desktop: two-column (details + activity feed side-by-side)
  - Field display: all lead fields with copy-to-clipboard on email/phone
  - Activity feed: chronological, with activity type icon + actor avatar
  - Log activity form (inline at bottom of activity feed)
  - Documents section: upload + list attached files

- [ ] **Create Lead dialog/page** (`/leads/new`):
  - React Hook Form + Zod schema validation
  - All fields per API contract
  - Campaign attribution dropdown
  - Team + assignee dropdowns (filtered by role)
  - Submit creates lead and redirects to detail page or closes dialog

- [ ] **Edit Lead**: same form, pre-populated

- [ ] **Lead Conversion flow**:
  - Multi-step dialog: Confirm deal → Create/link contact → Create/link company
  - Preview of what will be created before confirming
  - On success: redirect to new deal page

---

### 2.8 Deals / Pipeline UI

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Pipeline Board view** (`/deals`):
  - Kanban columns: Qualification | Proposal | Negotiation | Won | Lost
  - Each column: deal cards with value, contact name, close date, probability badge
  - Drag-and-drop between columns (using `@dnd-kit/core`)
  - Mobile: horizontal scroll with snap; one column visible at a time
  - Column totals: deal count + total value in column header
  - Filter bar: assignee, team, value range, date range
  - "Add Deal" button per column
  - Lost/Won columns read-only (cannot drag into them — use dedicated actions)

- [ ] **Deal List view** (toggle from board):
  - Table with sortable columns
  - Status filter chips

- [ ] **Deal Detail page** (`/deals/:id`):
  - Deal header: title, value, status, probability ring chart
  - Win / Lose action buttons (with confirmation dialog)
  - Won dialog: final value, close date, create project toggle
  - Lost dialog: loss reason dropdown + note
  - Contact + Company cards with links to their pages
  - Activity feed (same component as leads)
  - Linked project chip (if project created from deal)
  - Linked invoices list

- [ ] **Win Flow**: triggers project creation with template selection
- [ ] **Value formatting**: all monetary values use `Intl.NumberFormat('en-IN')` with ₹ prefix

---

### 2.9 Contacts and Companies UI

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Contacts page** (`/contacts`): table/card list with search, status filter
- [ ] **Contact detail** (`/contacts/:id`): profile card, linked company, linked deals list, activity feed
- [ ] **Companies page** (`/companies`): list with industry filter
- [ ] **Company detail** (`/companies/:id`): company info, contacts list, deals list
- [ ] Cross-linking: clicking contact from a deal opens contact detail; vice versa

---

### 2.10 Campaigns and Mailing UI

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Campaigns list** with status badges
- [ ] **Campaign detail**: linked mailings list, lead attribution
- [ ] **Mailing composer** (`/mailings/new`):
  - Subject line input
  - Rich text HTML editor (use `@tiptap/react` or `react-quill`)
  - Recipient list: upload CSV or select contacts
  - Preview mode: renders HTML as email preview
  - Send / Schedule toggle
- [ ] **Mailing stats page**: open rate, click rate, bounce rate with donut chart
- [ ] **Recipient list** table with per-recipient delivery status

---

## Sprint 5 — Week 9–10: Task Management Backend

### 2.11 Project Module

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST / GET / GET:id / PATCH / DELETE
GET/POST/DELETE  /projects/:id/members
```

- [ ] `ProjectsService.create(dto)` — creates project, creates default board with 4 columns (TODO, IN_PROGRESS, IN_REVIEW, DONE), creates project member entry for teamLead
- [ ] `ProjectsService.createFromDeal(deal)` — called by DealsService on deal win; sets dealId, clientId; team from deal team
- [ ] `ProjectsService.complete(id)` — completion checklist: checks for open tasks, unbilled time entries, unpaid invoices; returns warnings list or completes
- [ ] `ProjectsService.addMember(projectId, userId)` — scope check: TEAM_LEAD can only add own team members
- [ ] `ProjectsService.removeMember(projectId, userId)` — checks for open tasks; returns task list if blocked; or reassigns on confirmation
- [ ] Project status transitions enforced; CANCELLED cascades soft-delete to all tasks
- [ ] Project completion: auto-archives DONE tasks, generates completion report
- [ ] Notification: team members notified on project status changes

---

### 2.12 Board and Column Module

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
GET/POST             /projects/:id/boards
PATCH/DELETE         /boards/:id
POST                 /boards/:id/columns
PATCH/DELETE         /boards/columns/:id
```

- [ ] Column count limit: max 8 per board — enforced at service layer
- [ ] Terminal columns (DONE, CANCELLED) cannot be renamed
- [ ] Column deletion blocked if tasks exist in it
- [ ] Column reorder: accepts ordered array of column IDs; updates `order` field
- [ ] `mappedStatus` field maps column to canonical TaskStatus for state machine compliance

---

### 2.13 Task Module

**Estimate:** 4 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST / GET / GET:id / PATCH / DELETE
POST /:id/block
POST /:id/unblock
GET/POST/PATCH/DELETE /:id/comments/:commentId
GET/POST/DELETE /:id/watchers
```

- [ ] `TasksService.create(dto)` — validates project membership for assignee (TEAM_LEAD scope), validates parent task depth (max 1 level), sets initial order
- [ ] `TasksService.update(id, dto)` — status transition state machine; role-based field locks (EMPLOYEE cannot change assignee/dueDate/priority); watcher notifications on status change
- [ ] `TasksService.block(id, dto)` — sets isBlocked=true, blockerType, blockerDescription; TEAM_LEAD notified
- [ ] `TasksService.unblock(id, dto)` — requires resolutionNote; sets blockerResolvedAt, isBlocked=false
- [ ] `TasksService.delete(id)` — blocked if BILLED time entries exist; cascades cancel to subtasks
- [ ] Subtask DONE guard: parent task moving to DONE triggers subtask completion check; returns incomplete subtask list; actor must confirm override
- [ ] **Comment service**:
  - `createComment(taskId, dto)` — parses @mentions from content; creates TaskMention records; emits Socket.IO `task.mentioned` per mentioned user; adds commenter to watchers; notifies all watchers with `task.comment_added`
  - `updateComment` — blocked after 15 minutes; returns 403 with time-expired message
  - `deleteComment` — soft-delete; content → null; actor logged
- [ ] **Watcher service**: add/remove watchers; watcher receives notifications for task updates
- [ ] All task mutations: Socket.IO `task.status_changed` emitted to `board:{boardColumnId}` room for live Kanban updates
- [ ] Task search: `search` param uses pg_trgm full-text on title + description

---

### 2.14 Time Entry Module

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST / GET / GET:id / PATCH / DELETE
POST /:id/submit
POST /:id/approve
POST /:id/reject
```

- [ ] `TimeEntriesService.create(dto)` — validates date range (not future, not > 30 days past without override), validates hours (0.25 increments, max 24), validates task status (not CANCELLED/ARCHIVED), validates EMPLOYEE owns or is assigned to task
- [ ] `TimeEntriesService.submit(id)` — transitions DRAFT → SUBMITTED; notifies TEAM_LEAD
- [ ] `TimeEntriesService.approve(id)` — transitions SUBMITTED → APPROVED; notifies submitter; unlocks for invoice import
- [ ] `TimeEntriesService.reject(id, dto)` — transitions SUBMITTED → REJECTED; reason required; notifies submitter; entry becomes DRAFT again
- [ ] BILLED entries: locked from all mutations — editing a BILLED entry throws 409
- [ ] Weekly timesheet view: `GET /api/v1/time-entries?userId=&dateFrom=&dateTo=` — groups by day

---

### 2.15 Sprint Module

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:**
```
POST/GET         /projects/:id/sprints
GET/PATCH/DELETE /sprints/:id
POST             /sprints/:id/start
POST             /sprints/:id/complete
```

- [ ] `SprintsService.start(id)` — validates only one ACTIVE sprint per project; transitions PLANNED → ACTIVE; notifies all sprint members
- [ ] `SprintsService.complete(id, dto)` — processes `incompleteTaskDispositions` in a transaction: move to backlog (unset sprintId), move to next sprint (set sprintId), or cancel; sets completedAt, completionRate; notifies TEAM_LEAD
- [ ] Sprint velocity metrics populated on completion: `plannedPoints` (count of tasks), `completedPoints` (count of DONE tasks), `carryOverCount`
- [ ] Sprint delete: only DRAFT or PLANNED; returns tasks to backlog

---

### 2.16 Recurring Task Template Module

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

**Endpoints:** CRUD on `/recurring-templates`

- [ ] `RecurringTasksService.generate(templateId)` — creates Task from template fields; increments `occurrenceCount`; updates `lastGeneratedAt` and `nextGenerateAt`; checks end condition (endDate or maxOccurrences)
- [ ] BullMQ `recurring-tasks` queue processor: runs every minute; queries templates where `nextGenerateAt <= now()` and `status = ACTIVE`
- [ ] Cron expression parsing for CUSTOM frequency (using `node-cron` or `croner` library)
- [ ] Template PAUSE: stops BullMQ scheduling, preserves existing task instances
- [ ] Template ARCHIVE: all future BullMQ jobs cancelled; status → ARCHIVED

---

## Sprint 6 — Week 11–12: Task Management Frontend

### 2.17 Project List and Detail UI

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Projects page** (`/projects`):
  - Grid cards: project name, type badge, team, progress bar (done/total tasks), end date, status badge
  - Filters: status, team, type
  - "New Project" dialog

- [ ] **Project detail** (`/projects/:id`):
  - Header: name, status, team, deal link
  - Sub-navigation tabs: Board | List | Sprint | Members | Time | Settings
  - Member management: add/remove with search
  - Project completion flow: checklist modal before completing

---

### 2.18 Kanban Board UI

**Estimate:** 4 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `BoardView` component — horizontal scroll container with snap
- [ ] `KanbanColumn` component:
  - Column header: name, WIP limit indicator (red when exceeded), task count, add task button
  - Droppable zone (dnd-kit)
  - Empty column: dashed border "Drop tasks here"

- [ ] `TaskCard` component:
  - Title (truncated to 2 lines)
  - Priority indicator (left border colour)
  - Assignee avatar (right)
  - Due date (red if overdue, amber if within 24h)
  - Labels (coloured chips, max 3 visible)
  - Comment count + time logged icons
  - Blocked indicator: red ⚠ badge
  - Draggable handle

- [ ] **Drag and drop** (`@dnd-kit/sortable`):
  - Drag task card between columns
  - On drop: optimistic update (move card visually), then PATCH status
  - On error: revert to original column + toast error
  - Vertical reorder within column

- [ ] **Add Task inline** (bottom of column): quick task form with title + Enter to save
- [ ] **Real-time board** (Socket.IO): `board.task_moved` event updates board without full refetch
- [ ] **Board settings** (column management): add/rename/reorder/delete columns

---

### 2.19 Task Detail Side Panel

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] Opens as right-side panel (480px) on desktop; bottom sheet (90vh) on mobile
- [ ] **Task metadata section**:
  - Title (inline edit on click)
  - Description (rich text via Tiptap, inline edit)
  - Status selector (dropdown)
  - Priority selector
  - Assignee picker (searchable user dropdown)
  - Due date (date picker)
  - Sprint selector
  - Labels (multi-select with colour chips)
  - Estimated hours

- [ ] **Blocker section** (shown when isBlocked=true):
  - Red alert card with blocker type + description
  - "Resolve Blocker" button → resolution note dialog

- [ ] **Subtasks section**:
  - Inline list with checkboxes (clicking TODO → DONE)
  - "Add subtask" input at bottom
  - Count: `3 / 5 completed`

- [ ] **Comments section**:
  - Chronological thread with author avatar + relative timestamp
  - Edit / delete (author, within 15 minutes — shows countdown)
  - Deleted comments: `[This comment was deleted]` placeholder
  - Comment composer with @mention autocomplete (type `@` → shows team member list)
  - Mention: highlighted in blue, triggers notification

- [ ] **Time entries section**:
  - Log time form: date, hours, description, billable toggle
  - List of own entries with submit/approve status
  - "Submit all" bulk action for TEAM_LEAD

- [ ] **Watchers section**: avatar stack, click to manage

- [ ] **Activity log** (collapsible): status changes, assignee changes, creation event

---

### 2.20 Sprint Board UI

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Sprint list** (within project): sprint cards with dates, status, velocity
- [ ] **Sprint Planning view**: backlog on left, sprint on right; drag tasks between them
- [ ] **Sprint active view**: Kanban filtered to current sprint's tasks only
- [ ] **Sprint completion flow**: dialog with incomplete task disposition (move to backlog / next sprint / cancel)
- [ ] **Velocity chart**: bar chart of story points completed per sprint

---

### 2.21 Time Tracking UI

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] **Timesheet page** (`/time-tracking`):
  - Weekly grid view: rows = tasks, columns = days of week
  - "Log time" dialog: task selector, date, hours, description
  - Submit all pending entries button
  - TEAM_LEAD view: own team's entries with approve/reject inline actions

- [ ] **My Time page** (EMPLOYEE dashboard widget):
  - Current week total
  - Log time quick form
  - Today's entries

---

## Phase 2 Completion Criteria

| Criterion | Verified |
|---|---|
| Lead CRUD complete with status transitions enforced | ☐ |
| Lead conversion creates Deal + Contact + Company atomically | ☐ |
| TEAM_LEAD cannot access other team's CRM data | ☐ |
| Deal win flow creates project correctly | ☐ |
| Campaign send dispatches to Brevo, Brevo webhook updates stats | ☐ |
| Kanban board loads, tasks visible in correct columns | ☐ |
| Drag-and-drop between columns updates task status | ☐ |
| Real-time board: second browser sees drag update without refresh | ☐ |
| @mention in comment creates notification for mentioned user | ☐ |
| Time entry submit notifies TEAM_LEAD; approve/reject works | ☐ |
| Sprint start/complete flow works end-to-end | ☐ |
| Recurring task generates correctly on schedule | ☐ |
| Mobile Kanban board: horizontal scroll visible, usable | ☐ |
| Task detail panel opens on mobile as bottom sheet | ☐ |
| All TypeScript compiles; ESLint passes | ☐ |

---

## Phase 2 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drag-and-drop library conflicts with SSR (Next.js) | High | Medium | Use `@dnd-kit` (SSR-safe); wrap DndContext in dynamic import with `ssr: false` |
| Real-time board updates race condition (two users move same card) | Medium | High | Optimistic update with server reconciliation; last-write-wins with timestamp |
| Brevo API rate limiting during campaign send | Medium | Medium | Batch sends (500 per call); queue with 1-second delay between batches |
| Time entry BILLED lock creates UX friction | Low | Low | Clear messaging: "This entry is billed — contact your admin to make changes" |
| @mention resolution slow for large workspaces (100+ users) | Low | Medium | Cache user list in TanStack Query; client-side filter after initial fetch |

---

## Phase 2 → Phase 3 Handoff

Phase 3 (HRMS + Invoice) can begin when:
1. Full CRM pipeline (Leads → Deals → Contacts → Companies) operational
2. Campaign send and Brevo webhook working
3. Project + Board + Kanban + Task management complete
4. Time entry approval flow (DRAFT → SUBMITTED → APPROVED → BILLED) operational
5. Sprint management working end-to-end
6. Socket.IO real-time board updates live
7. All mobile responsive layouts verified on iPhone SE
