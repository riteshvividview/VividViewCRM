# Task Management — Prompt 2: Sidebar IA ("My work" / "All projects" / "Teams")

Implements **Prompt 2 (Sidebar IA)** of the Bordigo-style (Breeze/Asana/Jira-like)
overhaul of the Action Items / Task Management module. This prompt restructures
navigation within `/dashboard/actions/*` into the target Bordigo information
architecture — **My work** (Tasks + Calendar), **All projects** (list + per-project
workspace), and **Teams** (list + per-team workspace) — while reusing the
multi-assignee data model, API surface, and components delivered in
[Prompt 1](34-task-management-prompt-1-foundation-implementation.md).

This is a **frontend-only** prompt: no new tables, columns, or API routes were
needed. "All projects" and "Teams" are populated from the existing
`/api/tasks/projects` and `/api/tasks/members` endpoints, and project/team
workspaces are simply the same task table/board/list/timeline views, pre-filtered
by `project_id` or by team membership.

Out of scope for this prompt (deferred to later prompts in the roadmap):
persisted per-task chat with file sharing and activity feed, subtask
persistence, and Start/Log timer + `task_time_entries` integration.

---

## 1. No SQL Migration

This prompt is purely a frontend navigation/IA restructure. It reuses the
`task_projects` and `teams`/`team_members` data already exposed by the
Prompt 1 API routes (`GET /api/tasks/projects`, `GET /api/tasks/members`). The
only new write path is project creation (`POST /api/tasks/projects`, which
already existed from Prompt 1) wired up to a "New Project" dialog.

---

## 2. Shared State: TasksProvider / useTasksContext

**New: `modules/tasks/context/tasks-context.tsx`**

Every page under `/dashboard/actions/*` previously called `useTasks()`
independently and rendered its own `<TaskDetailPanel>`/`<QuickAddTask>`. With
multiple sibling routes (Tasks, Calendar, Projects, Teams) now sharing one
sidebar, that state needed to be hoisted once. `TasksProvider` wraps the whole
`/dashboard/actions` route tree and exposes via `useTasksContext()`:

- `tasks`, `loading`, `currentUserId` — from `useTasks()`
- `members`, `teams`, `labels`, `projects` — fetched once from
  `/api/tasks/members`, `/api/tasks/labels`, `/api/tasks/projects`
- `addTask`, `updateTask`, `deleteTask`, `addAssignees` — mutation handlers
  (the latter newly exposed for `TaskWorkspace`'s bulk-assign action)
- `openTask`, `openQuickAdd`, `refreshProjects`

It also renders the singleton `<TaskDetailPanel>` and `<QuickAddTask>` (driven
by internal `selectedTask`/`panelOpen`/`quickAddOpen` state) and owns the
global **"T"** quick-add hotkey — moved here from the old page-level effect so
it works on every Tasks-module route, not just `/dashboard/actions`.

---

## 3. New Sidebar Navigation

**New: `modules/tasks/components/tasks-sidebar.tsx`**

A secondary, Tasks-module-scoped sidebar (separate from the main CRM sidebar)
rendering three sections:

- **My work** — links to `/dashboard/actions` (Tasks) and
  `/dashboard/actions/calendar` (Calendar)
- **All projects** — link to `/dashboard/actions/projects`, plus up to 8
  project shortcuts (from `useTasksContext().projects`)
- **Teams** — link to `/dashboard/actions/teams`, plus up to 8 team shortcuts
  (from `useTasksContext().teams`)

Active route highlighting via `usePathname()`. Hidden on small screens
(`hidden md:flex`) to avoid competing with the main dashboard sidebar on
mobile.

**New: `app/dashboard/actions/layout.tsx`**

Wraps every route under `/dashboard/actions/*` in `<TasksProvider>` and lays
out `<TasksSidebar>` alongside the page content in a two-column flex layout.

> Note: this is a *Tasks-module* "Teams" view, distinct from the existing
> Sales Teams & Targets page at `/dashboard/teams`
> (`modules/teams/`). It surfaces `teams`/`team_members` (the same tables used
> for team-level task assignment in Prompt 1) as a task-filtering lens, not a
> CRM sales-team management page.

---

## 4. Reusable Workspace + Refactored "My work / Tasks"

**New: `modules/tasks/components/task-workspace.tsx`**

Extracted from the old `app/dashboard/actions/page.tsx`: the filter chips
(All / My Tasks / Overdue / Due Today), search box, bulk-assign/bulk-delete
toolbar, list group-by selector, board/table/timeline/list view switcher, and
the conditional `TaskBoard`/`TaskTable`/`TaskTimeline`/`TaskList` render. Takes
a pre-scoped `tasks: Task[]` prop and reads `members`, `updateTask`,
`deleteTask`, `addTask`, `addAssignees`, `openTask`, `loading` from
`useTasksContext()`. This is the shared "task list workspace" reused by Tasks,
each project page, and each team page.

**Rewritten: `app/dashboard/actions/page.tsx`** ("My work / Tasks")

Now a thin page: `<RoleDashboardStrip />` + `<PageHeader>` (title, task count,
quick-add button) + `<TaskWorkspace tasks={tasks} />`. All toolbar/view logic,
state, and the detail panel/quick-add modal moved to `TaskWorkspace` and
`TasksProvider` respectively.

---

## 5. New "My work / Calendar"

**New: `modules/tasks/components/task-calendar.tsx`**

A month-grid calendar (cell/week generation patterned after
`modules/calendar/components/calendar-month.tsx`), placing each task as a
chip on its `due_date`, colored by `STATUS_CONFIG` (todo/in-progress/waiting/done).
Clicking a task chip opens the shared `TaskDetailPanel` via `onTaskClick`.

**New: `app/dashboard/actions/calendar/page.tsx`**

`PageHeader` ("Calendar") + month navigation (Today / prev / next) +
`<TaskCalendar>`, fed `tasks.filter(t => t.due_date)` from
`useTasksContext()`.

---

## 6. New "All projects"

**New: `app/dashboard/actions/projects/page.tsx`**

Grid of project cards (color swatch, name, description, task count computed
from `tasks.filter(t => t.project_id === p.id)`, status badge), each linking
to its detail page. A "New Project" button opens a `Dialog` (name,
description, color swatch picker) that `POST`s to `/api/tasks/projects` and
calls `refreshProjects()` on success.

**New: `app/dashboard/actions/projects/[id]/page.tsx`**

`PageHeader` (project name, description/color) + `<TaskWorkspace
tasks={tasks.filter(t => t.project_id === params.id)} />`.

---

## 7. New "Teams"

**New: `app/dashboard/actions/teams/page.tsx`**

Grid of team cards (name, member count, task count — tasks where any
assignee's id is in the team's `member_ids`), each linking to its detail page.
Data comes from `useTasksContext().teams` (from `/api/tasks/members`).

**New: `app/dashboard/actions/teams/[id]/page.tsx`**

`PageHeader` (team name, member names) + `<TaskWorkspace
tasks={tasks.filter(t => t.assignees.some(a => team.member_ids.includes(a.id)))} />`.

---

## 8. Verification

`tsc --noEmit -p tsconfig.json` shows zero new errors in any `app/`,
`modules/`, `lib/`, or `components/` file touched by this prompt (filtered to
`^(modules/tasks|app/dashboard/actions)`: no output). All remaining `tsc`
errors are pre-existing and confined to `backend/` (legacy NestJS, broken path
aliases, TS-version-incompatible decorators) — unrelated to and untouched by
this work.

The existing dev server (port 3000) compiled all new routes
(`/dashboard/actions`, `/dashboard/actions/calendar`,
`/dashboard/actions/projects`, `/dashboard/actions/teams`) with no build
errors (307 redirects to login for unauthenticated requests — expected, no
500s).

---

## 9. Completion

**Prompt 2 (Sidebar IA): 100%** of its defined scope — `TasksProvider` shared
state, "My work" (Tasks + Calendar), "All projects" (list + detail), and
"Teams" (list + detail), all reusing Prompt 1's multi-assignee data model and
API.

**Remaining for the overall Bordigo-style transformation** (future prompts,
not started):
- Persisted per-task chat with file sharing + activity log (currently
  local-only comments in the detail panel)
- Subtask persistence (currently stored in the `sub_tasks` jsonb column but
  not exposed via dedicated API)
- Start/Log timer UI + `task_time_entries` integration for "Scheduled work" /
  "Logged time table"
