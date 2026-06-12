# Phase 1 — Backend Foundation

## Phase Summary

| Attribute | Value |
|---|---|
| **Phase** | 1 of 6 |
| **Duration** | 4 weeks (2 × 2-week sprints) |
| **Overall Completion** | `█░░░░░░░░░` 8% |
| **Status** | In Progress |
| **Goal** | Establish the complete technical foundation — authentication, multi-tenancy, database, real-time, background jobs, file storage, and the frontend shell — that every subsequent module is built on top of |

### Why This Phase Exists

Every module that follows (CRM, Tasks, HRMS, Invoice) shares the same foundation: JWT auth, workspace-scoped Prisma queries, BullMQ job queues, Socket.IO real-time events, and the Shadcn UI shell. Building this correctly and completely in Phase 1 means all subsequent phases are incremental feature additions, not infrastructure work. Cutting corners here causes cascading rework in every later phase.

---

## Phase Completion Tracker

```
Backend Infrastructure    ██░░░░░░░░  15%
Authentication System     █░░░░░░░░░   8%
Database & Prisma         ███░░░░░░░  25%
Multi-Tenancy Layer       ░░░░░░░░░░   0%
Background Jobs (BullMQ)  ░░░░░░░░░░   0%
Real-Time (Socket.IO)     ░░░░░░░░░░   0%
File Storage              ░░░░░░░░░░   0%
Audit System              ░░░░░░░░░░   0%
Notification Foundation   ░░░░░░░░░░   0%
Frontend Shell            ██░░░░░░░░  15%
Auth UI Flow              ░░░░░░░░░░   0%
API Client Layer          ░░░░░░░░░░   0%
─────────────────────────────────────────
PHASE 1 TOTAL             █░░░░░░░░░   8%
```

---

## Sprint 1 — Week 1–2: Backend Core

### 1.1 NestJS Project Bootstrap

**Estimate:** 2 days | **Completion:** `███░░░░░░░` 25%

- [x] Initialize NestJS project with `@nestjs/cli`
- [x] Configure TypeScript `strict` mode + path aliases (`@/modules/*`, `@/common/*`)
- [ ] Set up module structure:
  ```
  src/
  ├── app.module.ts
  ├── common/
  │   ├── decorators/
  │   ├── filters/         ← Global exception filter
  │   ├── guards/
  │   ├── interceptors/
  │   ├── middleware/
  │   └── pipes/
  ├── config/
  │   └── config.module.ts
  ├── modules/
  │   ├── auth/
  │   ├── users/
  │   ├── workspace/
  │   ├── crm/
  │   ├── tasks/
  │   ├── hrms/
  │   ├── invoice/
  │   ├── notifications/
  │   ├── documents/
  │   └── audit/
  └── prisma/
      └── prisma.service.ts
  ```
- [ ] Install and configure core packages:
  ```bash
  @nestjs/config @nestjs/jwt @nestjs/passport
  passport passport-jwt passport-local
  @prisma/client prisma
  ioredis bullmq @nestjs/bull
  socket.io @nestjs/websockets @nestjs/platform-socket.io
  class-validator class-transformer
  bcryptjs
  @aws-sdk/client-s3 (for R2/S3)
  helmet compression
  ```
- [ ] Global validation pipe with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- [ ] Global exception filter — maps Prisma errors, HTTP exceptions, and validation errors to standard envelope
- [ ] Global request logger (Morgan or custom NestJS logger)
- [ ] Health check endpoint: `GET /health` → `{ status: "ok", timestamp, version }`

**Definition of Done:** `GET /health` returns 200; TypeScript compiles with zero errors; ESLint passes.

---

### 1.2 Configuration Module

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

- [ ] `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`
- [ ] Joi or Zod schema for env validation — startup fails fast if any required var is missing
- [ ] Required environment variables:
  ```env
  # App
  NODE_ENV=development
  PORT=3001
  FRONTEND_URL=http://localhost:3000

  # Database
  DATABASE_URL=postgresql://...
  DATABASE_POOL_MIN=2
  DATABASE_POOL_MAX=10

  # Auth
  JWT_ACCESS_SECRET=
  JWT_REFRESH_SECRET=
  JWT_ACCESS_EXPIRES_IN=900        # 15 minutes
  JWT_REFRESH_EXPIRES_IN=604800    # 7 days

  # Redis
  REDIS_URL=redis://localhost:6379

  # File Storage (Cloudflare R2)
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET_NAME=
  R2_PUBLIC_URL=

  # Email (Brevo)
  BREVO_API_KEY=
  BREVO_FROM_EMAIL=noreply@agency.com
  BREVO_FROM_NAME=VividCRM
  ```
- [ ] `ConfigService` wrapper with typed getters — never use `process.env` directly in application code

**Definition of Done:** App refuses to start if `DATABASE_URL`, `JWT_ACCESS_SECRET`, or `REDIS_URL` is missing.

---

### 1.3 Prisma Setup and Database Connection

**Estimate:** 2 days | **Completion:** `███░░░░░░░` 25%

- [x] Prisma initialized (`prisma init`)
- [x] Initial schema scaffolded (from `05-database-design/prisma-schema.md`)
- [ ] `prisma/schema.prisma` — complete schema from design document
- [ ] Run initial migration: `npx prisma migrate dev --name init`
- [ ] `PrismaService` — injectable NestJS service extending `PrismaClient`:
  ```ts
  @Injectable()
  export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
      await this.$connect()
    }
    async onModuleDestroy() {
      await this.$disconnect()
    }
  }
  ```
- [ ] `PrismaModule` — global module exporting `PrismaService`
- [ ] Soft-delete middleware — appends `WHERE deletedAt IS NULL` to all queries:
  ```ts
  prisma.$use(async (params, next) => {
    const softDeleteModels = ['Lead', 'Deal', 'Contact', 'Company', 'Project', 'Task', 'Invoice', 'Document']
    if (softDeleteModels.includes(params.model) && params.action === 'findMany') {
      params.args.where = { ...params.args.where, deletedAt: null }
    }
    if (params.action === 'delete') {
      params.action = 'update'
      params.args.data = { deletedAt: new Date() }
    }
    return next(params)
  })
  ```
- [ ] Workspace scope middleware — injects `workspaceId` filter on all tenant-scoped queries (called after auth guard sets `req.user`)
- [ ] Database seed script for development: creates a default workspace, SUPER_ADMIN user, and sample data
- [ ] PostgreSQL extensions via migration:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```
- [ ] RLS policy on `audit_logs` table:
  ```sql
  REVOKE UPDATE, DELETE ON audit_logs FROM vividcrm_app;
  ```
- [ ] Partial indexes via raw migration SQL (from `indexing-strategy.md`)
- [ ] Connection pool configuration: `DATABASE_URL` with `?connection_limit=10&pool_timeout=20`

**Definition of Done:** `npx prisma db push` succeeds; seed runs without errors; all 55 tables created; PrismaService injectable across all modules.

---

### 1.4 Redis Connection

**Estimate:** 0.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `ioredis` client wrapped in `RedisModule` (global)
- [ ] `RedisService` — typed wrapper for common operations:
  ```ts
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  get(key: string): Promise<string | null>
  del(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  incr(key: string): Promise<number>
  ```
- [ ] Key namespacing convention: `{workspaceId}:{domain}:{identifier}`
  - Refresh tokens: `{workspaceId}:refresh:{userId}:{tokenId}`
  - Rate limits: `ratelimit:{ip}:{endpoint}`
  - Reset tokens: `reset:{token}`
- [ ] Redis health check integrated into `GET /health`

---

### 1.5 Authentication System

**Estimate:** 3 days | **Completion:** `█░░░░░░░░░` 8%

- [x] Brevo auth integration started
- [ ] **AuthModule** — imports `JwtModule`, `PassportModule`, `UsersModule`
- [ ] **JWT Strategy** (`passport-jwt`):
  - Extracts token from `Authorization: Bearer` header
  - Validates `tokenVersion` against database on every request
  - Attaches full user object to `req.user`
- [ ] **Local Strategy** (`passport-local`): email+password for login route
- [ ] **JwtAuthGuard** — wraps `AuthGuard('jwt')`; global default guard (opt-out with `@Public()`)
- [ ] **RolesGuard** — checks `@Roles()` decorator against `req.user.role`
- [ ] **WorkspaceScopeGuard** — sets Prisma middleware workspace filter from `req.user.workspaceId`
- [ ] **Auth endpoints:**
  ```
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  POST /api/v1/auth/logout
  POST /api/v1/auth/logout-all
  POST /api/v1/auth/forgot-password
  POST /api/v1/auth/reset-password
  POST /api/v1/auth/change-password
  GET  /api/v1/auth/me
  PATCH /api/v1/auth/me
  ```
- [ ] Password hashing with bcrypt (rounds: 12)
- [ ] Refresh token storage in Redis with expiry
- [ ] Refresh token rotation on each use (detect replay attacks)
- [ ] Rate limiting on login: 10 attempts per IP per 15 minutes (`@nestjs/throttler`)
- [ ] Rate limiting on forgot-password: 3 per email per hour
- [ ] Password complexity validation (uppercase + lowercase + digit)
- [ ] `tokenVersion` increment on role change and logout-all
- [ ] `AuditLog` entries: LOGIN, LOGOUT events

**Definition of Done:** Full auth flow tested end-to-end; refresh token rotation verified; rate limiting blocks brute force; role change invalidates all existing sessions.

---

### 1.6 Multi-Tenancy Layer

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] All workspace-scoped models confirmed with `workspaceId` column
- [ ] Prisma middleware: workspace injection on every find/findMany/create/update
  ```ts
  prisma.$use(async (params, next) => {
    const tenantScoped = getTenantScopedModels()
    if (tenantScoped.includes(params.model) && currentWorkspaceId) {
      if (['findMany', 'findFirst', 'count', 'aggregate'].includes(params.action)) {
        params.args.where = { workspaceId: currentWorkspaceId, ...params.args.where }
      }
      if (params.action === 'create') {
        params.args.data = { workspaceId: currentWorkspaceId, ...params.args.data }
      }
    }
    return next(params)
  })
  ```
- [ ] AsyncLocalStorage context for passing `workspaceId` through the call stack without prop-drilling
- [ ] Cross-workspace query block — any query without a workspace filter on a tenant-scoped model throws in non-SUPER_ADMIN context
- [ ] Workspace middleware test: verify user A cannot read user B's data even with valid JWT
- [ ] `WorkspaceModule` — CRUD for workspace settings (SUPER_ADMIN only):
  ```
  GET    /api/v1/workspace
  PATCH  /api/v1/workspace
  PATCH  /api/v1/workspace/features
  ```

**Definition of Done:** Integration test confirms cross-workspace data isolation; workspace feature flags disable module endpoints when toggled off.

---

### 1.7 Users Module

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

- [ ] `UsersModule` — CRUD used internally by Auth and HR modules
- [ ] `UsersService.findByEmail(workspaceId, email)`
- [ ] `UsersService.findById(id)`
- [ ] `UsersService.create(dto)` — called by employee creation
- [ ] `UsersService.updateRole(userId, role)` — increments tokenVersion
- [ ] `UsersService.deactivate(userId)` — sets isActive=false, increments tokenVersion
- [ ] Admin endpoints (SUPER_ADMIN only):
  ```
  GET    /api/v1/users
  GET    /api/v1/users/:id
  PATCH  /api/v1/users/:id/role
  POST   /api/v1/users/:id/deactivate
  POST   /api/v1/users/:id/reinstate
  ```

---

## Sprint 2 — Week 3–4: Infrastructure Services

### 1.8 BullMQ Background Job Infrastructure

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `BullModule.forRoot({ connection: redisConnection })` in AppModule
- [ ] Queue definitions (create once, register in their owning modules):
  | Queue Name | Owner Module | Purpose |
  |---|---|---|
  | `email-notifications` | Notifications | Transactional email via Brevo |
  | `audit-log` | Audit | Async audit log writes |
  | `pdf-generation` | Invoice | Invoice + payslip PDFs |
  | `attendance-compute` | HRMS | End-of-day attendance computation |
  | `payroll-compute` | Payroll | Monthly payroll computation |
  | `recurring-tasks` | Tasks | Generate recurring task instances |
  | `campaign-send` | CRM | Email campaign dispatch |
  | `report-generate` | Reports | Heavy report exports |

- [ ] Base `JobProcessor` class with shared error handling, retry policy, and dead-letter logging
- [ ] Bull Board UI at `/admin/queues` (SUPER_ADMIN only, HTTP Basic auth in production)
- [ ] Global queue config:
  ```ts
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,  // keep failed jobs
  }
  ```
- [ ] Failed job alert: if a job fails all retries, send in-app notification to SUPER_ADMIN

**Definition of Done:** BullBoard shows all queues; test job enqueued and processed; failed job retained in failed queue.

---

### 1.9 Socket.IO Real-Time Gateway

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `NotificationsGateway` — WebSocket gateway on `/notifications` namespace
- [ ] JWT validation on WebSocket connection (via `WsJwtGuard`)
- [ ] Room management:
  - On connect: join `user:{userId}` and `workspace:{workspaceId}` rooms
  - Board subscription: join `board:{boardId}` on client event
- [ ] Connection limit enforcement: max 5 concurrent connections per user (Redis counter)
- [ ] Close codes: 4001 (unauthorized), 4003 (deactivated), 4004 (too many connections)
- [ ] `SocketService` — injectable service for emitting events from any module:
  ```ts
  emitToUser(userId: string, event: string, data: unknown): void
  emitToWorkspace(workspaceId: string, event: string, data: unknown): void
  emitToBoard(boardId: string, event: string, data: unknown): void
  ```
- [ ] Presence tracking: online users stored in Redis `Set workspace:{workspaceId}:online`
- [ ] Heartbeat / ping-pong to detect stale connections

**Definition of Done:** WebSocket client connects with valid JWT; receives test event; disconnects cleanly; deactivated user connection rejected with 4003.

---

### 1.10 File Storage Service

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `StorageModule` — wraps `@aws-sdk/client-s3` (compatible with Cloudflare R2)
- [ ] `StorageService`:
  ```ts
  upload(file: Buffer, key: string, mimeType: string): Promise<string>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
  ```
- [ ] Key structure: `{workspaceId}/{category}/{year}/{month}/{uuid}.{ext}`
  - Categories: `avatars`, `documents`, `invoices`, `payslips`, `hrms`
- [ ] File upload endpoint (used by frontend):
  ```
  POST /api/v1/upload
  Body: multipart/form-data { file, category }
  Response: { fileKey, fileUrl, fileMimeType, fileSizeBytes }
  ```
- [ ] File size limits: 10MB for documents, 5MB for images, 50MB for videos
- [ ] Allowed MIME types whitelist (no `.exe`, `.sh`, `.php`)
- [ ] Virus scan hook (placeholder for Phase 6 — log file hash now)
- [ ] `DocumentModule` — CRUD for Document records; stores fileKey references

---

### 1.11 Audit Log System

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `AuditModule` — global module
- [ ] `AuditService.log(entry: CreateAuditLogDto): Promise<void>` — enqueues to BullMQ, never blocks the request
- [ ] `AuditQueue` processor — writes to `audit_logs` table
- [ ] `AuditInterceptor` — global interceptor that:
  1. Reads `req._auditContext` set by service layer
  2. Enqueues audit entry after response is sent
- [ ] `@Audit(action, module, entityType)` decorator — shorthand for setting audit context
- [ ] Sensitive export audit: `AuditService.logSensitiveExport(...)` — isSensitive=true entries
- [ ] Admin audit dashboard endpoint:
  ```
  GET /api/v1/audit-logs
  Query: entityType, entityId, actorId, action, from, to, isSensitive
  Permission: SUPER_ADMIN only
  ```
- [ ] Database-level INSERT-only protection tested (attempt UPDATE on audit_logs — must fail)

---

### 1.12 Notification System Foundation

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `NotificationsModule` — depends on `BullModule`, `SocketModule`
- [ ] `Notification` CRUD endpoints:
  ```
  GET    /api/v1/notifications
  GET    /api/v1/notifications/unread-count
  PATCH  /api/v1/notifications/:id/read
  PATCH  /api/v1/notifications/read-all
  DELETE /api/v1/notifications/:id
  DELETE /api/v1/notifications
  GET    /api/v1/notifications/preferences
  PATCH  /api/v1/notifications/preferences
  ```
- [ ] `NotificationsService.create(input)`:
  1. Persist `Notification` record
  2. Emit Socket.IO event to `user:{recipientId}`
  3. Check `NotificationPreference` for email opt-in
  4. If email enabled: enqueue `email-notifications` BullMQ job
- [ ] `EmailProcessor` — processes `email-notifications` queue, calls Brevo API
- [ ] Brevo transactional email integration (`POST https://api.brevo.com/v3/smtp/email`)
- [ ] Email templates registry (template ID map keyed by notification type)
- [ ] `NotificationPreference` defaults: all IN_APP=true, email=true for critical events only
- [ ] Notification TTL cleanup: BullMQ cron job deletes notifications older than 90 days

---

## Frontend — Sprint 1 & 2 Parallel Track

### 1.13 Next.js 15 Project Setup

**Estimate:** 1.5 days | **Completion:** `██░░░░░░░░` 15%

- [x] Next.js 15 project initialized (App Router)
- [ ] Directory structure:
  ```
  src/
  ├── app/
  │   ├── (auth)/          ← Login, forgot password (no sidebar)
  │   │   ├── login/
  │   │   └── reset-password/
  │   └── (app)/           ← Authenticated shell
  │       ├── layout.tsx   ← Sidebar + header
  │       ├── dashboard/
  │       ├── leads/
  │       ├── deals/
  │       ├── projects/
  │       ├── tasks/
  │       ├── hrms/
  │       ├── invoices/
  │       ├── reports/
  │       └── settings/
  ├── components/
  │   ├── ui/              ← Shadcn components
  │   ├── common/          ← Shared components (PageHeader, DataTable, etc.)
  │   └── modules/         ← Module-specific components
  ├── hooks/               ← TanStack Query hooks
  ├── lib/
  │   ├── api.ts           ← Axios client
  │   ├── utils.ts
  │   └── socket.ts        ← Socket.IO client
  ├── stores/              ← Zustand stores (UI state only)
  └── types/               ← Shared TypeScript types
  ```
- [ ] Tailwind CSS configured with custom theme extensions (design system tokens)
- [ ] Shadcn UI initialized: `npx shadcn@latest init`
- [ ] Install all required Shadcn components:
  ```bash
  npx shadcn@latest add button card badge input label select textarea
  npx shadcn@latest add dialog sheet drawer toast sonner
  npx shadcn@latest add table tabs avatar dropdown-menu
  npx shadcn@latest add form command popover tooltip
  npx shadcn@latest add skeleton progress separator scroll-area
  npx shadcn@latest add alert-dialog collapsible sidebar
  npx shadcn@latest add chart
  ```
- [ ] Inter + JetBrains Mono fonts loaded via `next/font/google`
- [ ] `globals.css` — CSS custom properties from design system
- [ ] Dark mode: `next-themes` provider
- [ ] ESLint + Prettier configured
- [ ] TypeScript strict mode
- [ ] Absolute imports: `@/*` → `src/*`

---

### 1.14 API Client Layer

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

- [ ] Axios instance with base URL, default headers, interceptors:
  ```ts
  // lib/api.ts
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
  })

  // Request interceptor: attach accessToken from cookie/memory
  api.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // Response interceptor: auto-refresh on 401
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true
        await refreshToken()
        return api(error.config)
      }
      return Promise.reject(error)
    }
  )
  ```
- [ ] Token storage strategy: `accessToken` in memory (Zustand store); `refreshToken` in HttpOnly cookie
- [ ] TanStack Query `QueryClient` provider with global config:
  ```ts
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false },
    mutations: { onError: globalMutationErrorHandler },
  }
  ```
- [ ] Global error handler — maps API error envelope to `toast.error()` message
- [ ] TanStack Query DevTools in development

---

### 1.15 Socket.IO Client

**Estimate:** 0.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] Socket.IO client singleton:
  ```ts
  // lib/socket.ts
  export const socket = io(`${API_URL}/notifications`, {
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() }),
  })
  ```
- [ ] `useSocket()` hook — manages connect/disconnect lifecycle; reconnects on token refresh
- [ ] `useSocketEvent(event, handler)` hook — subscribes on mount, unsubscribes on unmount
- [ ] TanStack Query cache invalidation on socket events:
  ```ts
  socket.on('task.status_changed', () => queryClient.invalidateQueries(['tasks']))
  socket.on('notification.new', (data) => {
    queryClient.invalidateQueries(['notifications', 'unread-count'])
    toast.info(data.title)
  })
  ```

---

### 1.16 Auth UI

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] Login page (`/login`):
  - Email + password form with `react-hook-form` + Zod
  - Show/hide password toggle
  - "Remember me" checkbox
  - Error state: "Invalid credentials" inline message
  - Loading state on submit button
  - Redirect to `/dashboard` on success
  - Redirect to `/login` if session expired (401 handling)
- [ ] Forgot password page (`/forgot-password`):
  - Email input
  - Success state: "Check your email" message shown regardless
- [ ] Reset password page (`/reset-password?token=...`):
  - New password + confirm password
  - Strength indicator
  - Token validation on page load; 404 if invalid
- [ ] `middleware.ts` — Next.js middleware for route protection:
  ```ts
  export const config = { matcher: ['/((?!login|reset-password|forgot-password|api|_next).*)'] }
  // Redirect to /login if no valid session cookie
  ```
- [ ] `AuthProvider` — React context providing `user`, `logout()`, `isLoading`
- [ ] `useAuth()` hook — reads from AuthProvider

---

### 1.17 App Shell

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] `(app)/layout.tsx` — authenticated layout with sidebar + header structure
- [ ] `Sidebar` component — all nav groups, collapsible module sections, active state
- [ ] `MobileHeader` — hamburger + logo + notification bell + avatar
- [ ] `MobileNavigationDrawer` — Sheet-based full nav on mobile
- [ ] `MobileBottomNav` — role-specific 5-tab bottom navigation
- [ ] `DesktopTopBar` — breadcrumb + search + notifications + user menu
- [ ] `NotificationBell` — unread badge + popover feed (connected to Socket.IO)
- [ ] `UserMenu` — dropdown with profile, leaves, payslips, settings, logout
- [ ] `GlobalSearch` — Shadcn Command palette (`⌘K`), searches across leads/tasks/contacts
- [ ] `Breadcrumb` — auto-generated from pathname
- [ ] `PageHeader` — reusable title + description + actions pattern
- [ ] Role-based nav visibility (items hidden if role has no access)
- [ ] Theme toggle (light/dark) in user menu
- [ ] Mobile safe area insets applied to bottom nav

---

## Phase 1 Completion Criteria

All of the following must be true before Phase 2 begins:

| Criterion | Verified |
|---|---|
| `GET /health` returns 200 with DB + Redis status | ☐ |
| Login → receive JWT → call authenticated endpoint → success | ☐ |
| Refresh token rotation works and detects replay | ☐ |
| Deactivated user cannot authenticate | ☐ |
| User A cannot read User B's workspace data | ☐ |
| BullMQ processes a test job and logs it | ☐ |
| Socket.IO client receives test event from server | ☐ |
| File upload to R2/S3 and retrieve signed URL works | ☐ |
| AuditLog record written for login event | ☐ |
| INSERT on audit_logs succeeds; UPDATE/DELETE fails | ☐ |
| Soft-delete middleware hides deleted records | ☐ |
| Frontend login page submits, stores token, redirects | ☐ |
| Sidebar renders with role-correct nav items | ☐ |
| Mobile bottom nav visible on 375px viewport | ☐ |
| All TypeScript compiles with zero errors | ☐ |
| All ESLint rules pass | ☐ |

---

## Phase 1 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Prisma migration conflicts if schema changes mid-sprint | High | Medium | Use feature branches; squash migrations before first production deploy |
| R2/S3 CORS configuration blocks frontend uploads | Medium | Medium | Configure CORS on bucket from day 1; test upload from frontend early |
| Socket.IO auth fails in production (proxy stripping headers) | Medium | High | Use `transports: ['websocket']` only; configure Nginx to forward WebSocket upgrade |
| Redis not available in CI/CD | Low | High | Use `redis-mock` for unit tests; integration tests use real Redis in Docker Compose |
| JWT secret rotation procedure undefined | Low | High | Document secret rotation runbook before first external user |

---

## Phase 1 → Phase 2 Handoff

Phase 2 (CRM) can begin when:
1. Auth system fully working (JWT, refresh, guards, roles)
2. Prisma + workspace scope middleware operational
3. BullMQ queues defined and processing
4. Socket.IO gateway accepting connections
5. Frontend app shell renders with working navigation
6. File upload + document storage working
7. Notification foundation (persist + emit + email) wired up
