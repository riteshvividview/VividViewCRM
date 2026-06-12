# Backend Architecture — VividCRM

## Overview

The NestJS backend is a **distributed monolith** — single deployable process with clean
module boundaries that can be split into microservices without rewrites if scale demands it.

## Module Dependency Graph

```
AppModule
├── AppConfigModule     (global — ConfigService for all env vars)
├── LoggerModule        (global — Winston logger)
├── PrismaModule        (global — database client + middleware)
├── RedisModule         (global — ioredis client + RedisService)
├── BullInfraModule     (global — all queues registered)
├── StorageModule       (global — R2/S3 file storage)
├── WebSocketModule     (global — Socket.IO gateway + WebSocketService)
├── ThrottlerModule     (global — rate limiting)
└── HealthModule        (GET /health, GET /health/ping)

Future modules plug into AppModule imports[]:
  AuthModule, UsersModule, WorkspaceModule,
  CrmModule, TasksModule, HrmsModule, InvoiceModule,
  NotificationsModule, DocumentsModule, ApprovalsModule, ReportsModule
```

## Global Providers

| Provider Type | Class | Purpose |
|---|---|---|
| APP_FILTER | GlobalExceptionFilter | Converts all exceptions to standard error envelope |
| APP_GUARD | JwtAuthGuard | JWT validation on every route (opt-out with @Public()) |
| APP_GUARD | RolesGuard | Role check after auth (@Roles() decorator) |
| APP_GUARD | ThrottlerGuard | Rate limiting per user/IP |
| APP_INTERCEPTOR | LoggingInterceptor | HTTP request/response logging |
| APP_INTERCEPTOR | AuditInterceptor | Reads @Audit() metadata, enqueues audit entries |
| APP_INTERCEPTOR | ResponseInterceptor | Wraps responses in standard envelope |

## Request Lifecycle

```
HTTP Request
  → RequestIdMiddleware  (attach X-Request-ID UUID)
  → JwtAuthGuard         (validate Bearer token, attach req.user)
  → RolesGuard           (check @Roles() against req.user.role)
  → ThrottlerGuard       (rate limit check in Redis)
  → LoggingInterceptor   (start timer)
  → AuditInterceptor     (read @Audit() metadata)
  → Controller           (route handler)
  → Service              (business logic)
  → Prisma               (database query with workspace + soft-delete middleware)
  → ResponseInterceptor  (wrap in { success, statusCode, data, timestamp })
  → LoggingInterceptor   (log duration)
  → AuditInterceptor     (enqueue audit entry via BullMQ)
  → HTTP Response
```

## Extension Points for Future Modules

1. **New domain module** → add to `AppModule.imports[]`
2. **New BullMQ queue** → add `{ name: 'queue-name' }` to `BullInfraModule.registerQueue()`
3. **New WebSocket event** → add to `WS_EVENTS` constant, emit via `WebSocketService`
4. **New audit action** → add to `AuditAction` enum + `common/enums/index.ts`
5. **New role** → add to `Role` enum (requires DB migration for existing records)
6. **New global guard** → add as `APP_GUARD` in `AppModule.providers[]`

## File Storage Key Structure

```
{workspaceId}/{category}/{year}/{month}/{uuid}.{ext}

Categories: avatars | documents | invoices | payslips | hrms
```

## Environment Validation

Application refuses to start if any required env var is missing or invalid.
Validation is defined in `src/config/env.validation.ts` using Joi.

## Prisma Middleware Stack

1. **Soft-delete** — converts delete → update(deletedAt=now), appends deletedAt=null to reads
2. **Workspace scope** — (TODO in AuthModule sprint) injects workspaceId via AsyncLocalStorage

## Socket.IO Rooms

| Room | Joined by | Used for |
|---|---|---|
| `user:{userId}` | On connect | Per-user notifications, payslips |
| `workspace:{workspaceId}` | On connect | Workspace-wide broadcasts |
| `board:{boardId}` | On `board.subscribe` event | Live Kanban updates |
