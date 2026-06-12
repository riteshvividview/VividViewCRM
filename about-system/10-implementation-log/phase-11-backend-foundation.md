# Phase 11 — Backend Foundation Implementation Log

**Date:** 2025-06-01  
**Phase:** Phase 1 — Backend Foundation (Sprint 1 & 2)  
**Status:** Foundation complete — ready for Auth + CRM modules

---

## Summary

The complete NestJS backend foundation has been created inside `backend/`. This implements every item in `08-development-roadmap/phase-1.md` Sprint 1 except the Auth module (JWT strategy and auth endpoints), which intentionally requires the Users module that comes with it. The foundation is fully wired for Auth to be plugged in with zero changes to existing files.

---

## Architecture Created

```
backend/
├── src/
│   ├── main.ts                          ← Bootstrap: Helmet, CORS, Cookie parser, Swagger, Socket.IO adapter
│   ├── app.module.ts                    ← Root module: global guards, interceptors, filters, throttler
│   │
│   ├── config/
│   │   ├── config.module.ts             ← Global ConfigModule with Joi env validation
│   │   ├── config.service.ts            ← Typed AppConfigService (all env vars as getters)
│   │   └── env.validation.ts            ← Joi schema — app refuses to start on invalid env
│   │
│   ├── common/
│   │   ├── constants/index.ts           ← QUEUES, WS_EVENTS, CRON, STORAGE_CATEGORIES, etc.
│   │   ├── enums/index.ts               ← All 50+ enums (Role, LeadStatus, TaskStatus, ...)
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts      ← @Public() — opt-out of JwtAuthGuard
│   │   │   ├── roles.decorator.ts       ← @Roles(Role.ADMIN, Role.HR) guard
│   │   │   ├── current-user.decorator.ts← @CurrentUser() / @CurrentUser('id')
│   │   │   ├── audit.decorator.ts       ← @Audit({ action, module, entityType })
│   │   │   └── api-paginated-response.ts← @ApiPaginatedResponse(Dto) for Swagger
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        ← Global JWT guard (respects @Public())
│   │   │   └── roles.guard.ts           ← Role-based access control
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts← Catches all exceptions; maps Prisma errors; standard envelope
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts  ← Wraps all responses in { success, statusCode, data, timestamp }
│   │   │   ├── logging.interceptor.ts   ← Structured HTTP request/response logging
│   │   │   └── audit.interceptor.ts     ← Reads @Audit() metadata; enqueues audit entries (async)
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts       ← Pre-configured ValidationPipe (whitelist, transform)
│   │   └── utils/
│   │       ├── pagination.util.ts       ← toPrismaPagination(), buildPaginationMeta()
│   │       ├── hash.util.ts             ← hashPassword, verifyPassword, encryptField, decryptField, maskSensitive
│   │       ├── date.util.ts             ← workingDaysInMonth, isWorkingDay, daysBetween, formatDurationMinutes
│   │       └── currency.util.ts         ← formatINR, amountToWords (Indian format), roundCurrency
│   │
│   ├── database/
│   │   ├── prisma.module.ts             ← Global PrismaModule
│   │   └── prisma.service.ts            ← PrismaService with soft-delete middleware; ping()
│   │
│   ├── infrastructure/
│   │   ├── redis/
│   │   │   ├── redis.module.ts          ← Global Redis module; ioredis client factory
│   │   │   └── redis.service.ts         ← set/get/del/exists/expire/incr/setJson/getJson/getOrSet/sadd/scard/ping
│   │   ├── bull/
│   │   │   └── bull.module.ts           ← All 8 BullMQ queues registered globally
│   │   ├── storage/
│   │   │   ├── storage.module.ts        ← Global StorageModule
│   │   │   └── storage.service.ts       ← upload/getSignedUrl/delete/exists/buildKey (R2/S3)
│   │   └── logger/
│   │       └── logger.module.ts         ← Winston with console (pretty dev/json prod) + daily rotate files
│   │
│   ├── modules/
│   │   └── health/
│   │       ├── health.controller.ts     ← GET /health, GET /health/ping (@Public)
│   │       ├── health.service.ts        ← Checks DB, Redis, Storage; returns ok/degraded/down
│   │       └── health.module.ts
│   │
│   ├── shared/
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts        ← PaginationDto (page, limit, sortBy, sortOrder)
│   │   │   ├── paginated-response.dto.ts← PaginatedResponseDto<T> + createPaginatedResponse()
│   │   │   ├── search.dto.ts            ← SearchDto extends PaginationDto + search field
│   │   │   └── id-param.dto.ts          ← IdParamDto for :id path params
│   │   └── repositories/
│   │       └── base.repository.ts       ← Generic BaseRepository (findById, findAll, create, update, softDelete)
│   │
│   └── websocket/
│       ├── websocket.gateway.ts         ← NotificationsGateway @ /notifications namespace
│       ├── websocket.service.ts         ← emitToUser / emitToWorkspace / emitToBoard
│       └── websocket.module.ts          ← Global WebSocketModule
│
├── prisma/
│   ├── schema.prisma                    ← Foundation schema: Workspace, User, Notification, NotificationPreference, AuditLog
│   └── seed.ts                          ← Creates 5 dev users (one per role) + workspace
│
├── test/
│   ├── app.e2e-spec.ts                  ← E2E tests: health check + auth protection
│   └── jest-e2e.json
│
├── docs/
│   └── ARCHITECTURE.md                  ← Module graph, request lifecycle, extension points
│
├── .env.example                         ← All 50+ env vars with descriptions
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── nest-cli.json
```

---

## Packages Installed

### Production

| Package | Version | Purpose |
|---|---|---|
| `@nestjs/common` | ^10 | NestJS framework core |
| `@nestjs/core` | ^10 | DI container, module system |
| `@nestjs/platform-express` | ^10 | Express HTTP adapter |
| `@nestjs/config` | ^3 | `ConfigModule` with env support |
| `@nestjs/jwt` | ^10 | JWT token generation/validation |
| `@nestjs/passport` | ^10 | Passport strategy integration |
| `@nestjs/swagger` | ^7 | OpenAPI / Swagger UI |
| `@nestjs/websockets` | ^10 | WebSocket decorator support |
| `@nestjs/platform-socket.io` | ^10 | Socket.IO adapter |
| `@nestjs/bullmq` | ^10 | BullMQ job queue integration |
| `@nestjs/throttler` | ^6 | Rate limiting |
| `@nestjs/terminus` | ^10 | Health checks (dependency only) |
| `@prisma/client` | ^5 | Prisma ORM client |
| `prisma` | ^5 | Prisma CLI (dev+prod for migrations) |
| `bullmq` | ^5 | Background job queue |
| `ioredis` | ^5 | Redis client |
| `passport` | ^0.7 | Authentication middleware |
| `passport-jwt` | ^4 | JWT Passport strategy |
| `passport-local` | ^1 | Local (email/password) strategy |
| `bcryptjs` | ^2 | Password hashing (12 rounds) |
| `class-validator` | ^0.14 | DTO validation decorators |
| `class-transformer` | ^0.5 | Serialization (Exclude, Transform) |
| `joi` | ^17 | Environment variable validation |
| `helmet` | ^7 | HTTP security headers |
| `compression` | ^1 | Gzip response compression |
| `cookie-parser` | ^1 | Parse HttpOnly cookies |
| `nest-winston` | ^1 | Winston logger for NestJS |
| `winston` | ^3 | Structured logging |
| `winston-daily-rotate-file` | ^5 | Rotating file log transport |
| `uuid` | ^10 | UUID generation (request IDs) |
| `@aws-sdk/client-s3` | ^3 | Cloudflare R2 / AWS S3 client |
| `@aws-sdk/s3-request-presigner` | ^3 | Pre-signed URL generation |
| `file-type` | ^19 | Magic byte file type detection |
| `sanitize-html` | ^2 | HTML sanitisation (rich text) |

### Dev / Build

| Package | Version | Purpose |
|---|---|---|
| `@nestjs/cli` | ^10 | NestJS CLI (build, generate) |
| `@nestjs/testing` | ^10 | Test module factory |
| `ts-node` | ^10 | TypeScript execution (seed) |
| `ts-jest` | ^29 | TypeScript Jest transformer |
| `jest` | ^29 | Test runner |
| `supertest` | ^7 | HTTP integration testing |
| `prettier` | ^3 | Code formatting |
| `eslint` | ^9 | Linting |
| TypeScript type packages | various | `@types/*` |

---

## Decisions Taken

### 1. Foundation-only Prisma schema
Only `Workspace`, `User`, `Notification`, `NotificationPreference`, `AuditLog` are in the initial schema. All 55 tables from the design document will be added as modules are built — each addition is a forward-only migration.

**Reason:** Avoids creating empty tables with no owning module code. Each module team owns their migrations.

### 2. Soft-delete in Prisma middleware (not Prisma schema extensions)
Soft-delete is implemented as Prisma middleware that intercepts `delete` → `update(deletedAt)` and appends `deletedAt: null` to read queries. This is done in code, not via `@prisma/extension-soft-delete`, to keep full control over which models are soft-deleted and to support the `includeDeleted` override flag.

### 3. Global guards via APP_GUARD (not decorator-per-controller)
`JwtAuthGuard` and `RolesGuard` are registered as `APP_GUARD` providers so they apply to every route automatically. Public routes use `@Public()` to opt out. This prevents accidental exposure of endpoints by forgetting to add a guard decorator.

### 4. Async audit log writes via BullMQ
The `AuditInterceptor` enqueues audit log entries to the `audit-log` BullMQ queue rather than writing directly to the database. This prevents audit writes from adding latency to API responses. The `AuditQueue` worker (wired when `AuditModule` is built) does the actual database write.

### 5. Environment validation at startup with Joi
The app will not start if any required environment variable is missing or invalid. The validation schema in `env.validation.ts` covers all 50+ variables. `allowUnknown: false` ensures no undocumented variables silently affect behavior.

### 6. WINSTON_LOGGER injection token
Winston is exposed under the custom `WINSTON_LOGGER` injection token rather than via the standard `Logger` service. This allows the `GlobalExceptionFilter` and other infrastructure classes to receive the logger without circular dependencies.

### 7. WebSocket JWT validation stub
The `NotificationsGateway` currently parses the JWT payload without signature verification (foundation stub). Full verification with `JwtService.verify()` will be wired when `AuthModule` is built in the next sprint. The placeholder prevents errors but clearly documents the TODO location.

### 8. Path aliases configured
TypeScript path aliases (`@common/*`, `@config/*`, `@database/*`, etc.) are configured in `tsconfig.json` for clean imports throughout the codebase. These avoid `../../../../` relative imports that break with directory restructuring.

---

## Security Controls Implemented

| Control | Implementation |
|---|---|
| HTTP security headers | Helmet with full CSP, HSTS (1 year), referrer policy, hidePoweredBy |
| CORS whitelist | Only `FRONTEND_URL` from env — no wildcard |
| Input validation | ValidationPipe with `whitelist: true`, `forbidNonWhitelisted: true` |
| Rate limiting | ThrottlerModule (configurable per-env via `RATE_LIMIT_PER_MINUTE`) |
| Password hashing | bcrypt 12 rounds |
| Field encryption | AES-256-GCM in `hash.util.ts` (for PAN, Aadhaar, bank account) |
| Sensitive field masking | `maskSensitive()` utility (shows last 4 chars only in logs) |
| Soft-delete | Prisma middleware — deleted records invisible by default |
| Audit log protection | `REVOKE UPDATE, DELETE ON audit_logs` in DB (run manually — see manual steps) |
| Cookie security | HttpOnly, SameSite=Strict, Secure (in production) configured in main.ts |

---

## Future Extension Points

### Adding a new business module (e.g., CRM)

1. Create `src/modules/crm/` with `crm.module.ts`, `crm.controller.ts`, `crm.service.ts`
2. Import `CrmModule` in `AppModule.imports[]`
3. Add Prisma models to `prisma/schema.prisma` and run `pnpm prisma:migrate:dev`
4. Repositories extend `BaseRepository<T, TCreate, TUpdate>`
5. Controllers use `@Roles()`, `@Audit()`, `@ApiPaginatedResponse()` decorators from `@common/decorators`
6. Services call `WebSocketService.emitToUser()` for real-time events
7. BullMQ jobs are enqueued via `@InjectQueue(QUEUES.EMAIL_NOTIFICATIONS)`

### Adding the Auth module

1. Create `src/modules/auth/strategies/jwt.strategy.ts` — validates token, checks tokenVersion
2. Create `src/modules/auth/strategies/local.strategy.ts` — email/password
3. Replace the stub in `NotificationsGateway.handleConnection()` with `JwtService.verify()`
4. All global guards (`JwtAuthGuard`, `RolesGuard`) are already registered — no AppModule change needed

---

## Files Added / Modified in `about-system`

### Added
- `about-system/10-implementation-log/phase-11-backend-foundation.md` ← this file

### Not modified
- All existing `about-system/` documentation treated as read-only source of truth
