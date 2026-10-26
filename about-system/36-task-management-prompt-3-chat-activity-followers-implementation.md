# Task Management — Prompt 3: Persisted Chat, Activity Log & Followers

Implements **Prompt 3** of the Bordigo-style (Breeze/Asana/Jira-like) overhaul of
the Action Items / Task Management module. This prompt replaces the
local-only, lost-on-close comment box in the task detail panel with a real,
persisted activity feed: every structural change to a task (status, priority,
due date, assignees, labels) plus every comment now lives in the database and
is visible to all task collaborators. It also adds a "Followers" (watchers)
mechanism so users can opt in to notifications-relevant tracking of a task.

Continues from [Prompt 1](34-task-management-prompt-1-foundation-implementation.md)
(multi-assignee foundation, which already started writing
`created`/`updated`/`assignee_added`/`assignee_removed` rows into
`task_activity_log`) and [Prompt 2](35-task-management-prompt-2-sidebar-ia-implementation.md)
(sidebar IA).

File sharing (attachments) — the third piece of the original "per-task chat
with file sharing, followers, activity log" requirement — is deferred to a
follow-up **Prompt 4**, since it requires a new `task_attachments` table and a
new Supabase Storage bucket (a SQL/dashboard handoff).

---

## 1. No SQL Migration

This prompt is **purely additive on the application layer**. The tables it
reads and writes — `task_comments`, `task_mentions`, `task_activity_log`, and
`task_watchers` — already exist with RLS enabled and workspace-isolation
policies (`task_comments_workspace_isolation`,
`task_mentions_workspace_isolation`, `task_activity_log_workspace_isolation`,
`task_watchers_workspace_isolation` — the last added by Prompt 1's SQL patch).
No columns, tables, or policies were added.

---

## 2. New API Routes

**New: `app/api/tasks/[id]/activity/route.ts`** — `GET`

Returns the task's `task_activity_log` rows (newest first) plus a `profiles`
map resolving every referenced user id (the actor of each entry, and any
`user_id`/`user_ids` embedded in `new_value`/`old_value` for
assignee-change entries) to `{id, full_name, avatar_url}`. This lets the
client render "Jane assigned Bob" without extra round-trips.

**Fixed: `app/api/tasks/[id]/labels/route.ts`**

`POST` (add label) and `DELETE` (remove label) previously didn't write to
`task_activity_log` — a gap left over from Prompt 1. Both now insert
`label_added` / `label_removed` rows with `new_value: {label_id, label_name}`.

**New: `app/api/tasks/[id]/comments/route.ts`** — `GET`, `POST`

- `GET` lists non-deleted `task_comments` for the task (oldest first), each
  with the author's profile resolved (`{id, full_name, avatar_url}`).
- `POST` inserts a comment (`{task_id, workspace_id, author_id, body}`), then
  scans the body for `@Full Name` mentions against the workspace's
  `profiles`. Each match gets a `task_mentions` row
  (`{comment_id, task_id, workspace_id, mentioned_user_id}`) and an in-app
  notification (`type: "mention"`, linking to the task, via the new
  `app/api/tasks/_lib/notify.ts` helper — a copy of the existing
  `notifyUsers` helper from the HRMS attendance module, scoped into the tasks
  API so the two feature areas don't reach into each other's `_lib` folders).

**New: `app/api/tasks/[id]/comments/[commentId]/route.ts`** — `DELETE`

Soft-deletes a comment (`deleted_at = now()`). Only the comment's author or an
HR/admin (`isHR(ctx.role)`) may delete.

**New: `app/api/tasks/[id]/watchers/route.ts`** — `GET`, `POST`, `DELETE`

Lists/adds/removes rows in `task_watchers`, defaulting to the current user
(`ctx.userId`) when no `user_id` is given in the body. Every response returns
the full resolved watcher list (`TaskMember[]`) so the UI can update in one
round-trip.

---

## 3. New UI Components

**New: `modules/tasks/components/task-activity-feed.tsx`**

`TaskActivityFeed` fetches `/api/tasks/[id]/activity` and
`/api/tasks/[id]/comments` in parallel, merges both into one
chronologically-sorted timeline, and renders:

- **Activity entries** as compact gray system lines — e.g. "Jane changed
  status to In Progress", "Bob assigned Alice", "Priya added the "Bug" label"
  — via a `formatActivity()` humanizer that switches on `action` and
  pretty-prints `new_value` (status/priority via `STATUS_CONFIG`/
  `PRIORITY_CONFIG`, dates via `toLocaleDateString`, assignee/label ids via the
  `profiles` map from the activity endpoint).
- **Comments** as chat-style rows (avatar, author name, timestamp, body),
  reusing `AssigneeAvatar`. The comment's own author sees a hover delete
  button.

A `Textarea` composer at the bottom posts new comments (Enter to send,
Shift+Enter for newline) and optimistically appends the server-returned
comment to the list.

Accepts a `refreshKey` prop — `TaskDetailPanel` passes a digest of
`status|priority|due_date|estimated_hours|assignee ids|label ids`, so the feed
re-fetches whenever one of those changes from elsewhere in the panel (picking
up the activity-log row that change just wrote).

**New: `modules/tasks/components/task-followers.tsx`**

`TaskFollowers` fetches `/api/tasks/[id]/watchers`, renders an `AssigneeStack`
of follower avatars plus a "Follow"/"Following" toggle button for the current
user (`POST`/`DELETE` to the watchers endpoint with no body, defaulting to
self).

---

## 4. TaskDetailPanel Changes

**Modified: `modules/tasks/components/task-detail-panel.tsx`**

- Removed the local `comments`/`TaskComment` state, the old `addComment()`
  handler, and the inline "Comments" section (everything that was lost on
  close/reopen).
- Added a new `currentUserId: string | null` prop (threaded through from
  `useTasksContext()` via `TasksProvider`).
- Added a **Followers** row to the properties list (below Reporter):
  `<TaskFollowers taskId={task.id} currentUserId={currentUserId} />`.
- Replaced the old Comments section with
  `<TaskActivityFeed taskId={task.id} currentUserId={currentUserId} refreshKey={...} />`.

**Modified: `modules/tasks/context/tasks-context.tsx`**

`<TaskDetailPanel>` now receives `currentUserId={currentUserId}` (already
available from `useTasks()`).

**Modified: `modules/tasks/types.ts`**

- `TaskComment` redefined to match the persisted shape:
  `{id, task_id, body, author: TaskMember | null, parent_comment_id, edited_at, created_at}`
  (was previously `{id, task_id, author: string, content, created_at}`, which
  never matched the database).
- Old unused `TaskActivity` type removed; replaced with
  `TaskActivityEntry` (`{id, action, field_name, old_value, new_value, metadata, actor_id, created_at}`)
  matching `task_activity_log`, plus a `TaskActivityAction` union for the
  known action strings.

---

## 5. Verification

`tsc --noEmit -p tsconfig.json` filtered to
`^(modules/tasks|app/api/tasks|app/dashboard/actions)`: no output — zero new
errors in any file touched by this prompt.

---

## 6. Completion

**Prompt 3 (Persisted Chat, Activity Log & Followers): 100%** of its defined
scope (excluding file attachments, split out as Prompt 4):

- ✅ Persisted activity log — read endpoint + humanized feed UI, plus the
  `label_added`/`label_removed` write-gap fix
- ✅ Persisted per-task chat — list/create/soft-delete comments,
  `@mention` parsing → `task_mentions` + `notifications` (`type: "mention"`)
- ✅ Followers — watch/unwatch a task, avatar stack + toggle in the detail
  panel

**Remaining for the overall Bordigo-style transformation** (future prompts,
not started):
- **Prompt 4** — File attachments: new `task_attachments` table + new private
  Supabase Storage bucket (SQL/dashboard handoff required), upload/list/delete
  API, "Attachments" section in the detail panel
- Subtask persistence via dedicated API (currently the `sub_tasks` jsonb
  column)
- Start/Log timer UI + `task_time_entries` integration for "Scheduled work" /
  "Logged time table"
