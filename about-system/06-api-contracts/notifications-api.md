# Notifications API — VividCRM

## Architecture

Notifications are delivered through two channels:

| Channel | Technology | Latency | Use Case |
|---|---|---|---|
| **In-app (real-time)** | Socket.IO over WebSocket | < 200ms | Task updates, @mentions, approval events |
| **Email** | Brevo via BullMQ async queue | < 2 min | Formal notifications: leave approved, payslip ready, invoice sent |

Every notification record is persisted in the `notifications` table regardless of channel so the in-app notification centre always has complete history.

---

## REST Endpoints

---

### GET `/api/v1/notifications`

Fetch the notification feed for the authenticated user.

**Permission:** Any authenticated user (own notifications only — no cross-user access regardless of role)

**Query Parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `isRead` | boolean | — | Filter unread (`false`) or read (`true`) only |
| `module` | string | — | CRM / TASKS / HRMS / INVOICE / SYSTEM |
| `page` | number | 1 | Page number |
| `limit` | number | 25 | Max 100 |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "notif_abc",
      "type": "TASK_ASSIGNED",
      "title": "New task assigned to you",
      "body": "Arjun Nair assigned you to \"Implement login page\" in Website Redesign.",
      "module": "TASKS",
      "resourceType": "task",
      "resourceId": "task_abc",
      "isRead": false,
      "readAt": null,
      "createdAt": "2025-06-16T09:15:00.000Z"
    },
    {
      "id": "notif_xyz",
      "type": "LEAVE_APPROVED",
      "title": "Leave approved",
      "body": "Your Earned Leave application for Jul 10 – Jul 14 has been approved.",
      "module": "HRMS",
      "resourceType": "leave_application",
      "resourceId": "leave_1",
      "isRead": true,
      "readAt": "2025-06-15T14:00:00.000Z",
      "createdAt": "2025-06-15T11:30:00.000Z"
    }
  ],
  "meta": {
    "total": 48,
    "page": 1,
    "limit": 25,
    "totalPages": 2,
    "unreadCount": 12
  }
}
```

---

### GET `/api/v1/notifications/unread-count`

Lightweight endpoint for the notification badge. Returns only the count.

**Permission:** Any authenticated user

**Response `200`:**
```json
{ "unreadCount": 12 }
```

---

### PATCH `/api/v1/notifications/:id/read`

Mark a single notification as read.

**Permission:** Notification owner only

**Request Body:** None.

**Response `200`:**
```json
{
  "id": "notif_abc",
  "isRead": true,
  "readAt": "2025-06-16T10:00:00.000Z"
}
```

**Validation:** Notification must belong to the authenticated user.

---

### PATCH `/api/v1/notifications/read-all`

Mark all unread notifications as read for the authenticated user.

**Permission:** Any authenticated user

**Request Body:**
```ts
class ReadAllNotificationsDto {
  @IsOptional()
  @IsString()
  module?: string  // if provided: mark only that module's notifications as read
}
```

**Response `200`:**
```json
{ "markedRead": 12 }
```

---

### DELETE `/api/v1/notifications/:id`

Delete a specific notification.

**Permission:** Notification owner only

**Response `200`:**
```json
{ "message": "Notification deleted." }
```

---

### DELETE `/api/v1/notifications`

Bulk-delete all read notifications older than a threshold.

**Permission:** Any authenticated user

**Request Body:**
```ts
class BulkDeleteNotificationsDto {
  @IsOptional()
  @IsISO8601()
  olderThan?: string  // delete read notifications older than this date; default: 30 days ago
}
```

**Response `200`:**
```json
{ "deleted": 34 }
```

---

## Notification Preferences

---

### GET `/api/v1/notifications/preferences`

Get the authenticated user's notification preference configuration.

**Permission:** Any authenticated user (own preferences only)

**Response `200`:**
```json
{
  "userId": "user_1",
  "preferences": {
    "TASK_ASSIGNED":       { "inApp": true,  "email": true  },
    "TASK_STATUS_CHANGED": { "inApp": true,  "email": false },
    "TASK_DUE_SOON":       { "inApp": true,  "email": true  },
    "TASK_OVERDUE":        { "inApp": true,  "email": true  },
    "TASK_COMMENTED":      { "inApp": true,  "email": false },
    "TASK_MENTIONED":      { "inApp": true,  "email": true  },
    "TASK_BLOCKED":        { "inApp": true,  "email": true  },
    "LEAVE_SUBMITTED":     { "inApp": true,  "email": true  },
    "LEAVE_APPROVED":      { "inApp": true,  "email": true  },
    "LEAVE_REJECTED":      { "inApp": true,  "email": true  },
    "LEAVE_CANCELLED":     { "inApp": true,  "email": true  },
    "ATTENDANCE_ABSENT":   { "inApp": true,  "email": true  },
    "PAYSLIP_READY":       { "inApp": true,  "email": true  },
    "INVOICE_SENT":        { "inApp": true,  "email": true  },
    "INVOICE_VIEWED":      { "inApp": true,  "email": false },
    "INVOICE_PAID":        { "inApp": true,  "email": true  },
    "INVOICE_OVERDUE":     { "inApp": true,  "email": true  },
    "PROJECT_ADDED":       { "inApp": true,  "email": false },
    "SPRINT_STARTED":      { "inApp": true,  "email": true  },
    "APPROVAL_REQUIRED":   { "inApp": true,  "email": true  },
    "APPROVAL_ESCALATED":  { "inApp": true,  "email": true  }
  },
  "updatedAt": "2025-06-01T09:00:00.000Z"
}
```

---

### PATCH `/api/v1/notifications/preferences`

Update preference overrides. Only the fields provided are updated (partial merge).

**Permission:** Any authenticated user

**Request Body:**
```ts
class UpdateNotificationPreferencesDto {
  @IsObject()
  @ValidateNested()
  preferences: Record<string, NotificationChannelPreferenceDto>
}

class NotificationChannelPreferenceDto {
  @IsBoolean()
  inApp: boolean

  @IsBoolean()
  email: boolean
}
```

**Example Request:**
```json
{
  "preferences": {
    "TASK_COMMENTED": { "inApp": true, "email": true },
    "ATTENDANCE_ABSENT": { "inApp": false, "email": false }
  }
}
```

**Response `200`:** Full updated preferences object (same as GET response).

---

## Notification Type Reference

All notification types with their trigger conditions and default channels:

### CRM Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `LEAD_ASSIGNED` | Lead assigned to user | New assignee | Yes |
| `LEAD_STATUS_CHANGED` | Lead status transitions | Assignee | No |
| `DEAL_ASSIGNED` | Deal assigned to user | New assignee | Yes |
| `DEAL_WON` | Deal marked WON | Assignee, ADMIN | Yes |
| `DEAL_LOST` | Deal marked LOST | Assignee, ADMIN | Yes |
| `DEAL_STALE` | No activity on deal for 7 days | Assignee | Yes |

### Task Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `TASK_ASSIGNED` | Task assigned to user | New assignee | Yes |
| `TASK_REASSIGNED` | Task assignee changed | Old + new assignee | Yes |
| `TASK_STATUS_CHANGED` | Task status transitions | Assignee, watchers | No |
| `TASK_DUE_SOON` | Due date within 24h | Assignee | Yes |
| `TASK_OVERDUE` | Due date passed, not DONE | Assignee, TEAM_LEAD | Yes (daily) |
| `TASK_COMMENTED` | Comment added | Task watchers | No |
| `TASK_MENTIONED` | @mention in comment | Mentioned user | Yes |
| `TASK_BLOCKED` | Task marked BLOCKED | TEAM_LEAD | Yes |
| `TASK_UNBLOCKED` | Blocker resolved | Assignee, watchers | No |
| `TASK_IN_REVIEW` | Task moved to IN_REVIEW | Designated reviewer | Yes |
| `TASK_DONE` | Task marked DONE | Creator, assignee | No |
| `TIME_ENTRY_SUBMITTED` | Time entry submitted for approval | TEAM_LEAD | In-app |
| `TIME_ENTRY_APPROVED` | Time entry approved | Submitter | In-app |
| `TIME_ENTRY_REJECTED` | Time entry rejected | Submitter | Yes |

### Project Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `PROJECT_ADDED` | Added as project member | New member | No |
| `PROJECT_REMOVED` | Removed from project | Removed member | No |
| `PROJECT_STATUS_CHANGED` | Project status changes | TEAM_LEAD, ADMIN | Yes |
| `PROJECT_ON_HOLD` | Project placed on hold | All members | Yes |
| `PROJECT_COMPLETED` | Project completed | All members | Yes |
| `SPRINT_STARTED` | Sprint activated | All sprint members | Yes |
| `SPRINT_COMPLETED` | Sprint closed | TEAM_LEAD, ADMIN | No |
| `SPRINT_OVERDUE` | Sprint end date passed | TEAM_LEAD | Yes (daily) |

### HRMS Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `EMPLOYEE_ONBOARDING_TASK` | Onboarding task assigned | Assigned user | Yes |
| `ATTENDANCE_ABSENT` | Marked absent (end of day) | Employee, TEAM_LEAD | Yes |
| `ATTENDANCE_LATE` | Clock-in after shift + grace | Employee, TEAM_LEAD | No |
| `REGULARISATION_SUBMITTED` | Regularisation submitted | HR | In-app |
| `REGULARISATION_APPROVED` | Regularisation approved | Employee | Yes |
| `REGULARISATION_REJECTED` | Regularisation rejected | Employee | Yes |
| `SHIFT_CHANGED` | Shift assignment changed | Employee | Yes |
| `HOLIDAY_DECLARED` | New holiday added | All employees | Yes |
| `LEAVE_SUBMITTED` | Leave application submitted | L1 approver | Yes |
| `LEAVE_L1_PENDING` | Awaiting L1 approval | TEAM_LEAD | Yes |
| `LEAVE_L2_PENDING` | Awaiting L2 approval | HR | Yes |
| `LEAVE_APPROVED` | Leave fully approved | Employee | Yes |
| `LEAVE_REJECTED` | Leave rejected | Employee | Yes |
| `LEAVE_CANCELLED` | Approved leave cancelled | Employee, TEAM_LEAD | Yes |
| `LEAVE_BALANCE_LOW` | Balance < 2 days | Employee | Yes |
| `LEAVE_APPROVAL_ESCALATED` | Approval escalated | New approver, original | Yes |
| `PAYSLIP_READY` | Payslip distributed | Employee | Yes (with attachment) |
| `PAYROLL_CORRECTION` | Post-approval payroll edit | HR, SUPER_ADMIN | Yes |
| `SALARY_REVISED` | Salary structure changed | Employee (configurable) | Email |
| `PROBATION_REVIEW_DUE` | 14 days before probation end | HR, TEAM_LEAD | Yes |
| `PERFORMANCE_REVIEW_STARTED` | Review cycle opened | Employee, manager | Yes |
| `EXIT_INITIATED` | Exit process started | Employee, TEAM_LEAD, HR | Yes |
| `EXIT_TASK_DUE` | Exit checklist item due | Assigned actor | Yes |

### Invoice Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `INVOICE_APPROVED` | Invoice approved | Creator | No |
| `INVOICE_SENT` | Invoice sent to client | Creator, ADMIN | In-app |
| `INVOICE_VIEWED` | Client opened invoice | Creator, ADMIN | No |
| `INVOICE_PAYMENT_RECEIVED` | Payment logged | Creator, ADMIN | Yes |
| `INVOICE_PAID` | Invoice fully paid | Creator, ADMIN | Yes |
| `INVOICE_OVERDUE_D1` | Due date passed (day 1) | ADMIN | Yes |
| `INVOICE_OVERDUE_D7` | 7 days overdue | ADMIN | Yes |
| `INVOICE_OVERDUE_D15` | 15 days overdue | ADMIN, SUPER_ADMIN | Yes |
| `INVOICE_OVERDUE_D30` | 30 days overdue (escalation) | ADMIN, SUPER_ADMIN | Yes |
| `INVOICE_VOIDED` | Invoice voided | ADMIN, SUPER_ADMIN | Yes |
| `CREDIT_NOTE_ISSUED` | Credit note created | ADMIN | Yes |

### Approval Notifications

| Type | Trigger | Default Recipients | Email? |
|---|---|---|---|
| `APPROVAL_REQUIRED` | Approval request created | Assigned approver | Yes |
| `APPROVAL_GRANTED` | Request approved | Submitter + next-level approver | Yes |
| `APPROVAL_REJECTED` | Request rejected | Submitter, prior approvers | Yes |
| `APPROVAL_ESCALATED` | Escalation triggered | New approver, old approver | Yes |
| `APPROVAL_EXPIRING_SOON` | < 4h before SLA breach | Current approver | Yes |
| `APPROVAL_EXPIRED` | SLA breach, auto-expired | Submitter, all approvers | Yes |
| `DELEGATION_ACTIVATED` | Delegation starts | Delegate | Yes |
| `DELEGATION_ENDED` | Delegation period ends | Delegate, delegator | No |

---

## WebSocket — Real-Time Events

### Connection

```
wss://{host}/api/v1/ws?token={accessToken}
```

The access token is validated on connection. Expired tokens are rejected with a `4001` close code. Clients must reconnect with a refreshed token.

### Namespaces and Rooms

```
/notifications  →  user-specific room: user:{userId}
```

On connection, the server automatically subscribes the socket to the authenticated user's room. No client-side room join required.

### Server → Client Events

All events follow this envelope:

```json
{
  "event": "notification.new",
  "data": {
    "id": "notif_abc",
    "type": "TASK_ASSIGNED",
    "title": "New task assigned to you",
    "body": "Arjun Nair assigned you to \"Implement login page\".",
    "module": "TASKS",
    "resourceType": "task",
    "resourceId": "task_abc",
    "isRead": false,
    "createdAt": "2025-06-16T09:15:00.000Z"
  }
}
```

| Event Name | Trigger |
|---|---|
| `notification.new` | New notification created for this user |
| `notification.read` | A notification was marked read (syncs across tabs) |
| `notification.read_all` | All notifications marked read |
| `notification.deleted` | A notification was deleted |
| `task.status_changed` | Task status updated (for task board real-time updates) |
| `task.assigned` | Task reassigned to/from this user |
| `task.comment_added` | New comment on a task the user is watching |
| `task.mentioned` | User was @mentioned in a comment |
| `board.task_moved` | Task moved to a different board column (for live board sync) |
| `sprint.activated` | Sprint goes ACTIVE |
| `leave.status_changed` | Leave application status changed |
| `approval.required` | New approval request assigned to this user |
| `approval.action_taken` | An approval the user submitted was acted on |
| `payslip.ready` | Payslip available for download |
| `invoice.payment_received` | Payment logged on an invoice (ADMIN only) |

### Client → Server Events

| Event Name | Payload | Description |
|---|---|---|
| `notification.mark_read` | `{ notificationId: string }` | Mark a notification read without REST call |
| `presence.update` | `{ status: "online" \| "away" \| "offline" }` | Update user presence status |
| `board.subscribe` | `{ boardId: string }` | Subscribe to live updates for a specific board |
| `board.unsubscribe` | `{ boardId: string }` | Unsubscribe from board updates |

### Connection Lifecycle

```
Client connects with JWT
    │
    ▼
Server validates token
  ├── Invalid / expired → close(4001, "Unauthorized")
  └── Valid → client joins room: user:{userId}
                         and room: workspace:{workspaceId}

Client sends presence.update { status: "online" }
    │
    ▼
Server broadcasts to workspace room:
  { event: "presence.changed", data: { userId, status, updatedAt } }

Token expires (15 min TTL)
    │
    ▼
Client receives HTTP 401 on REST call
Client calls POST /auth/refresh (HTTP — not WebSocket)
Client receives new accessToken
Client disconnects WebSocket
Client reconnects with new token
```

### Error Codes

| Code | Meaning |
|---|---|
| `4001` | Unauthorized — invalid or expired JWT on connect |
| `4002` | Workspace mismatch — token workspaceId does not match server |
| `4003` | Account deactivated |
| `4004` | Too many connections (max 5 concurrent tabs per user) |

---

## NestJS Gateway Implementation

```ts
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
@UseGuards(WsJwtGuard)
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  async handleConnection(client: Socket) {
    const user = client.data.user  // set by WsJwtGuard
    await client.join(`user:${user.id}`)
    await client.join(`workspace:${user.workspaceId}`)
  }

  async handleDisconnect(client: Socket) {
    // presence cleanup
  }

  @SubscribeMessage('board.subscribe')
  async handleBoardSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boardId: string },
  ) {
    // validate user has access to this board
    await client.join(`board:${data.boardId}`)
  }

  // Called by NotificationsService after persisting to DB
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload)
  }

  emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit(event, payload)
  }

  emitToBoard(boardId: string, event: string, payload: unknown) {
    this.server.to(`board:${boardId}`).emit(event, payload)
  }
}
```

---

## BullMQ Email Queue

Email notifications are dispatched via a dedicated BullMQ queue:

```ts
// Queue name: email-notifications
// Job shape:
interface EmailNotificationJob {
  to: string
  templateId: string      // Brevo template ID
  params: Record<string, unknown>  // template variables
  notificationId: string  // linked notification record ID
  workspaceId: string
  userId: string
}
```

Queue configuration:
```ts
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false,  // keep failed jobs for inspection
}
```

On successful delivery, the worker updates `notification.emailSentAt` and `notification.emailDelivered = true` via the Brevo delivery webhook.

---

## Notification Service Internal API

```ts
// Used by all other services to dispatch notifications
interface CreateNotificationInput {
  workspaceId: string
  recipientId: string
  type: string
  title: string
  body: string
  module?: string
  resourceType?: string
  resourceId?: string
  channel?: NotificationChannel  // default: BOTH
}

// Example usage in LeaveService:
async approveLeave(leaveId: string, approverId: string): Promise<void> {
  // ... approval logic ...

  await this.notificationsService.create({
    workspaceId: leave.workspaceId,
    recipientId: leave.employee.userId,
    type: 'LEAVE_APPROVED',
    title: 'Leave approved',
    body: `Your ${leave.leaveType.name} application for ${formatDateRange(leave)} has been approved.`,
    module: 'HRMS',
    resourceType: 'leave_application',
    resourceId: leave.id,
    channel: NotificationChannel.BOTH,
  })
}
```

The NotificationsService:
1. Persists the Notification record to the database
2. Emits the Socket.IO event to the user's room (real-time)
3. Checks the user's NotificationPreference for email opt-in
4. If email is enabled: enqueues BullMQ job for async email delivery
