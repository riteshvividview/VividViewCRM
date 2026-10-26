# Task Management — Prompt 1: Foundation (Multi-Assignee, Labels, Reporter, Time Tracking)

Implements **Prompt 1 (Foundation)** of the Bordigo-style (Breeze/Asana/Jira-like)
overhaul of the Action Items / Task Management module
(`app/dashboard/actions/page.tsx`). This prompt replaces the legacy
single-assignee, NestJS-backed task model with a direct-Supabase, multi-assignee
data model and rewires every task UI component (table, board, list, detail
panel, quick-add) to use it.

Concretely, this prompt delivers the requirement that *"a team leader can
assign a task to a team, a single member, or a group of members — or a normal
employee can assign a task to another employee"* (team assignment expands to
every `team_members` row at write time), plus the **Type** (labels),
**Reporter**, **Est. Time** and **Logged Time** columns/fields called for in
the target Tasks-tab layout.

Out of scope for this prompt (deferred to later prompts in the roadmap):
sidebar IA reorg ("My work" / "All projects" / "Teams"), per-task chat with
file sharing and a persisted activity feed, subtask persistence, and
GEON biometric integration (Prompt 3, on hold per prior direction).

---

## 1. SQL Migration (run manually in Supabase SQL Editor)

The junction tables used by this prompt (`task_assignees`, `task_watchers`,
`task_label_assignments`, `task_labels`, `task_projects`, `task_boards`, etc.)
already existed in the database from an earlier migration (see doc 13,
db-extension-plan) and **already have RLS enabled** — but
`task_assignees`, `task_watchers`, and `task_label_assignments` had **no
policies defined**, meaning any non-service-role client is fully denied
access to them. The Task API routes added in this prompt use the
service-role admin client (which bypasses RLS) so this didn't block the
backend, but it leaves these tables locked down for any future direct-client
access and is inconsistent with every other `task_*` table. This patch adds
the missing policies, mirroring the existing `tasks` table's own predicate
(`workspace_id in profiles` OR `assignee_id = auth.uid()` OR
`created_by = auth.uid()`), joined through `task_id`:

```sql
CREATE POLICY "task_assignees_workspace_isolation"
  ON public.task_assignees FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
         OR assignee_id = auth.uid()
         OR created_by = auth.uid()
    )
  );

CREATE POLICY "task_watchers_workspace_isolation"
  ON public.task_watchers FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
         OR assignee_id = auth.uid()
         OR created_by = auth.uid()
    )
  );

CREATE POLICY "task_label_assignments_workspace_isolation"
  ON public.task_label_assignments FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE workspace_id IN (SELECT workspace_id FROM public.profiles WHERE user_id = auth.uid())
         OR assignee_id = auth.uid()
         OR created_by = auth.uid()
    )
  );
```

#### Orphaned-row check

The `tasks.workspace_id` column is nullable, and any row with
`workspace_id IS NULL` would be invisible under the policy above (and under
the new `/api/tasks` routes, which always filter on
`eq("workspace_id", ctx.workspaceId)`). Run as a read-only check:

```sql
SELECT id, title, created_by, workspace_id
FROM public.tasks
WHERE workspace_id IS NULL;
```

If this returns rows, backfill `workspace_id` from the creator's profile
(`UPDATE public.tasks t SET workspace_id = p.workspace_id FROM public.profiles
p WHERE p.user_id = t.created_by AND t.workspace_id IS NULL;`) or delete them
if they're stale test data — to be decided once the output is known.

---

## 2. API Routes (`app/api/tasks/`)

All routes use `getAuthContext()` (resolves `user_id` → `workspace_id`/`role`
via `profiles`) and the service-role `adminClient()`, with manual
`.eq("workspace_id", ctx.workspaceId)` enforcement on every query.

| Route | Methods | Purpose |
|---|---|---|
| `_lib/helpers.ts` | — | `adminClient()`, `getAuthContext()`, `isHR()` |
| `_lib/serialize.ts` | — | `TASK_SELECT` column list + `attachRelations()` — joins `task_assignees`, `task_label_assignments`, and `created_by`/`assignee_id` profiles onto raw task rows (no FK to `profiles`, so PostgREST can't embed these — done manually) |
| `/api/tasks` | `GET`, `POST` | List (filters: `status`, `assignee_id`, `project_id`, `board_id`, `search`, `limit`) and create. `POST` accepts `assignee_ids[]` and/or `team_id` (expanded to every `team_members` row — the team-assignment requirement) and `label_ids[]`, writes to `task_assignees`/`task_label_assignments`, and logs a `task_activity_log` "created" entry. Also sets legacy `assignee_id`/`assignee_name` to the first assignee for backward compatibility. |
| `/api/tasks/[id]` | `GET`, `PATCH`, `DELETE` | Single-task read/update/delete, scoped to workspace. `PATCH` whitelists `PATCHABLE_FIELDS` (incl. `estimated_hours`, `actual_hours`, `position`, `story_points`, dates) and auto-sets/clears `completed_at` on status transitions to/from `done`; logs `task_activity_log` "updated". `DELETE` cascades manual cleanup across `task_assignees`, `task_watchers`, `task_label_assignments`, `task_comments`, `task_mentions`, `task_activity_log`, `task_time_entries`, `task_recurrence_rules` before deleting the task row. |
| `/api/tasks/[id]/assignees` | `POST`, `DELETE` | `POST` adds assignees — either explicit `user_ids[]` or every member of `team_id` (skips duplicates), logs `assignee_added`. `DELETE` removes one `user_id`, logs `assignee_removed`. Both return the fully re-serialized task. |
| `/api/tasks/[id]/labels` | `POST`, `DELETE` | `POST` upserts a `task_label_assignments` row (`ON CONFLICT (task_id, label_id) DO NOTHING`) after verifying the label belongs to the workspace; `DELETE` removes the assignment. Returns the re-serialized task. |
| `/api/tasks/labels` | `GET`, `POST` | List/create workspace `task_labels` (`id, name, color`). |
| `/api/tasks/projects` | `GET`, `POST` | List (non-archived, ordered by `position`) / create `task_projects`. |
| `/api/tasks/members` | `GET` | Returns workspace `profiles` (id/full_name/avatar_url/role) **and** `teams` with `member_ids` (via `team_members`) — feeds the `AssigneePicker`'s Members + Teams sections. |

---

## 3. Types & Hooks

**`modules/tasks/types.ts`** — `Task` gained:
- `assignees: TaskMember[]` (new `TaskMember { id, full_name, avatar_url }`)
- `reporter: TaskMember | null` (derived from `created_by`, read-only)
- `labels: TaskLabel[]` (new `TaskLabel { id, name, color }`)
- `project: TaskProjectRef | null`, `board: TaskBoardRef | null`
- `estimated_hours: number | null`, `actual_hours: number | null`
- New `TaskTeam { id, name, member_ids }` for team-assignment pickers
- `assignee_id` / `assignee_name` retained as `@deprecated` for backward compatibility

**`modules/tasks/hooks/use-tasks.ts`** — fully rewritten off the dead NestJS
`tasksApi` to call the new routes directly:
- `fetchTasks`, `addTask` (accepts `assignee_ids`/`team_id`/`label_ids` via
  `AddTaskInput`), `updateTask`, `deleteTask`, `refreshTask` — all with
  optimistic local state + server-state reconciliation/rollback on error
- New: `addAssignees(id, { user_ids?, team_id? })`, `removeAssignee(id, userId)`,
  `addLabel(id, labelId)`, `removeLabel(id, labelId)` — each returns the
  updated `Task` from the server

---

## 4. New & Updated UI Components

**New:**
- `modules/tasks/components/assignee-picker.tsx` — `AssigneeAvatar` (single
  avatar), `AssigneeStack` (compact overlapping avatars, used in
  table/board/list), and `AssigneePicker` (full add/remove dropdown with
  separate **Teams** and **Members** sections — selecting a team adds every
  member of that team as an individual assignee)
- `modules/tasks/components/label-picker.tsx` — colored-chip label add/remove
  UI for the **Type** field

**Updated:**
- `task-table.tsx` — new column order: select → done → title → status →
  **Type** (label chips) → due date → **Assignee(s)** (`AssigneeStack`) →
  **Est. Time** → **Logged Time** → **Create In** (project/board name) → priority
- `task-board.tsx` — card footer now shows label chips + `AssigneeStack`
  (replaces the old single `assignee_name` badge)
- `task-list.tsx` — row assignee badge replaced with `AssigneeStack`;
  "group by assignee" now fans a task out under each of its `assignees`
- `task-detail-panel.tsx` — properties panel reordered/expanded: Status →
  **Type** (`LabelPicker`) → Priority → Due Date → **Assignee(s)**
  (`AssigneePicker`, supports adding by team or by individual members) →
  **Reporter** (read-only, from `created_by`) → **Est. Time** (editable
  `estimated_hours`) → **Logged Time** (read-only `actual_hours`)
- `quick-add-task.tsx` — added an **Assign** row using `AssigneePicker`;
  submits `assignee_ids[]` with the new task
- `app/dashboard/actions/page.tsx` — fetches `members`/`teams` (from
  `/api/tasks/members`) and `labels` (from `/api/tasks/labels`); wires the new
  `addAssignees`/`removeAssignee`/`addLabel`/`removeLabel` handlers into the
  detail panel; "My Tasks" filter now checks `assignees.some(a => a.id ===
  currentUserId)`; bulk-assign dropdown now lists real workspace members

---

## 5. Removed

- `lib/api-client.ts` — deleted the dead `tasksApi` export (zero remaining
  references anywhere in the codebase; the legacy NestJS task endpoints it
  pointed to are unused)
- `FALLBACK_ASSIGNEES` hardcoded arrays in `task-detail-panel.tsx` and
  `app/dashboard/actions/page.tsx` — replaced by real `members`/`teams` from
  `/api/tasks/members`

---

## 6. Verification

`tsc --noEmit -p tsconfig.json` shows zero new errors in any `app/`,
`modules/`, `lib/`, or `components/` file touched by this prompt. All
remaining `tsc` errors are pre-existing and confined to `backend/` (legacy
NestJS, broken path aliases, TS-version-incompatible decorators) — unrelated
to and untouched by this work.

---

## 7. Completion

**Prompt 1 (Foundation): 100%** of its defined scope — multi-assignee data
model (individual + team-level), labels/Type, Reporter, project/board refs,
Est./Logged time fields, full API surface, and every Tasks-tab UI component
(table, board, list, detail panel, quick-add) rewired to match.

**Remaining for the overall Bordigo-style transformation** (future prompts,
not started):
- Sidebar IA reorg — "My work" (Tasks/Calendar), "All projects", "Teams"
- Persisted per-task chat with file sharing + activity log (currently
  local-only comments in the detail panel)
- Subtask persistence (currently stored in the `sub_tasks` jsonb column but
  not exposed via dedicated API)
- Start/Log timer UI + `task_time_entries` integration for "Scheduled work" /
  "Logged time table"
