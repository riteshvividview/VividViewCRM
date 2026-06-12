# Task Management — RBAC Permissions

**Date:** 2026-06-02  
**Status:** Planning  
**Roles:** SUPER_ADMIN · ADMIN · HR · TEAM_LEAD · EMPLOYEE

---

## Role Definitions (Task Management Context)

| Role | Task Management Scope |
|---|---|
| **SUPER_ADMIN** | Full access to all workspace data. Can impersonate any role. Bypasses all ownership checks. |
| **ADMIN** | Full project/board/sprint management. Can manage all tasks, delete anything, view all time reports. |
| **HR** | Read-only access to tasks and time entries for payroll/compliance purposes. Cannot create projects or boards. |
| **TEAM_LEAD** | Can create projects and boards within their team. Manages sprint lifecycle. Can assign/unassign team members. Views team-wide task data. |
| **EMPLOYEE** | Creates and manages own tasks. Can comment, track time on assigned tasks. Cannot see other employees' private tasks. |

---

## Permission Matrix

Legend: ✅ Full · 🔒 Own only · 👥 Team only · 📖 Read only · ❌ Denied

| Permission | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|:---:|
| **PROJECTS** | | | | | |
| Create project | ✅ | ✅ | ❌ | ✅ | ❌ |
| View all projects | ✅ | ✅ | ✅ | 👥 | 🔒¹ |
| Update project | ✅ | ✅ | ❌ | 👥 | ❌ |
| Archive project | ✅ | ✅ | ❌ | 👥 | ❌ |
| Delete project (hard) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **BOARDS** | | | | | |
| Create board | ✅ | ✅ | ❌ | ✅ | ❌ |
| View board | ✅ | ✅ | ✅ | 👥 | 🔒² |
| Update board settings | ✅ | ✅ | ❌ | 👥 | ❌ |
| Add/remove columns | ✅ | ✅ | ❌ | 👥 | ❌ |
| Reorder columns | ✅ | ✅ | ❌ | 👥 | ❌ |
| Archive board | ✅ | ✅ | ❌ | 👥 | ❌ |
| **SPRINTS** | | | | | |
| Create sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| View sprints | ✅ | ✅ | ✅ | 👥 | 🔒² |
| Update sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| Start sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| Complete sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| Cancel sprint | ✅ | ✅ | ❌ | ❌ | ❌ |
| View velocity report | ✅ | ✅ | 📖 | 👥 | ❌ |
| **TASKS** | | | | | |
| Create task (any board) | ✅ | ✅ | ❌ | ✅ | ✅³ |
| View all tasks | ✅ | ✅ | 📖 | 👥 | 🔒⁴ |
| Update any task | ✅ | ✅ | ❌ | 👥 | 🔒⁵ |
| Delete task | ✅ | ✅ | ❌ | 👥 | 🔒⁵ |
| Move task between columns | ✅ | ✅ | ❌ | ✅ | ✅⁵ |
| Add to sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| Remove from sprint | ✅ | ✅ | ❌ | 👥 | ❌ |
| Set story points | ✅ | ✅ | ❌ | ✅ | ❌ |
| **TASK ASSIGNMENT** | | | | | |
| Assign self to task | ✅ | ✅ | ❌ | ✅ | ✅ |
| Assign others to task | ✅ | ✅ | ❌ | 👥 | ❌ |
| Unassign others | ✅ | ✅ | ❌ | 👥 | ❌ |
| Watch/unwatch task | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SUBTASKS** | | | | | |
| Create subtask | ✅ | ✅ | ❌ | ✅ | ✅⁵ |
| Complete subtask | ✅ | ✅ | ❌ | ✅ | ✅⁵ |
| **COMMENTS** | | | | | |
| Add comment | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit own comment | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit any comment | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete own comment | ✅ | ✅ | ❌ | ✅ | ✅ |
| Delete any comment | ✅ | ✅ | ❌ | 👥 | ❌ |
| @mention users | ✅ | ✅ | ❌ | ✅ | ✅ |
| **TIME TRACKING** | | | | | |
| Track time (own tasks) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Track time (any task) | ✅ | ✅ | ❌ | 👥 | ❌ |
| Edit own time entries | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit others' time entries | ✅ | ✅ | ❌ | 👥 | ❌ |
| Delete own time entries | ✅ | ✅ | ❌ | ✅ | ✅ |
| Delete any time entry | ✅ | ✅ | ❌ | ❌ | ❌ |
| View team time report | ✅ | ✅ | 📖 | 👥 | ❌ |
| View workspace time report | ✅ | ✅ | 📖 | ❌ | ❌ |
| **LABELS** | | | | | |
| Create label | ✅ | ✅ | ❌ | ✅ | ❌ |
| Update label | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete label | ✅ | ✅ | ❌ | ❌ | ❌ |
| Apply label to task | ✅ | ✅ | ❌ | ✅ | ✅ |
| **RECURRENCE** | | | | | |
| Set recurrence on task | ✅ | ✅ | ❌ | ✅ | 🔒⁵ |
| Remove recurrence | ✅ | ✅ | ❌ | ✅ | 🔒⁵ |
| **ACTIVITY LOG** | | | | | |
| View task activity | ✅ | ✅ | 📖 | 👥 | 🔒⁴ |

---

## Footnotes

¹ Employees can view public projects only (`visibility = 'workspace'`). Private and team-scoped projects are hidden unless they are an assignee/watcher on a task within the project.

² Employees can view boards they have an active task on (assigned or watching). Private boards are hidden.

³ Employees can create tasks within boards they have access to. They cannot create tasks on boards they cannot view.

⁴ Employees see tasks where: they are the creator, the assignee, or a watcher. Other employees' tasks are hidden.

⁵ Own/assigned tasks only — employees can mutate tasks they created or are assigned to.

---

## Guards Implementation Plan

### RolesGuard (existing)
Already implemented in the backend foundation. Reads `@Roles()` decorator.

```typescript
// Example usage on project creation
@Post()
@Roles(Role.ADMIN, Role.TEAM_LEAD)
create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {}
```

### WorkspaceScopeGuard (existing pattern — apply to all routes)
Every task management route requires the requesting user to belong to the target workspace. Enforced at DB level (RLS) and at service level.

### TaskOwnershipGuard (new)
```typescript
// Applies to PATCH /tasks/:id and DELETE /tasks/:id for EMPLOYEE role
// Allows if: user.role >= TEAM_LEAD OR task.created_by === user.id OR user is assignee
```

### BoardAccessGuard (new)
```typescript
// Checks user can see the board (not private, or user has a task on it)
// Applies to: GET /boards/:id, GET /boards/:id/tasks
```

### CommentAuthorGuard (new)
```typescript
// For PATCH /comments/:id — only comment author or ADMIN can edit
```

### TeamScopeGuard (new for TEAM_LEAD)
```typescript
// Validates that the resource (project/board/sprint) belongs to a team the TEAM_LEAD manages
// Uses team_members table: SELECT 1 FROM team_members WHERE team_id = $teamId AND user_id = $userId AND role = 'manager'
```

---

## Permission Enforcement Layers

| Layer | Mechanism | Covers |
|---|---|---|
| **Route** | `@Roles()` decorator + `RolesGuard` | Coarse role check (can this role even hit this endpoint?) |
| **Guard** | Custom guards (Ownership, Board Access) | Resource-level ownership check |
| **Service** | Manual check in service method | Complex logic (e.g., TEAM_LEAD can only manage their team's boards) |
| **Database** | Supabase RLS policies | Last line — workspace isolation (every query filtered by workspace_id) |

---

## HR Role — Special Case

HR can read tasks and time entries for payroll and compliance auditing but cannot participate in task management. HR access is read-only and workspace-scoped.

HR can:
- `GET /tasks` (read all — for compliance)
- `GET /time-entries/report` (workforce time data)
- `GET /sprints/:id/velocity` (team productivity)

HR cannot:
- Create, update, or delete any task management entity
- Comment on tasks
- Track time
- Manage projects, boards, or sprints
