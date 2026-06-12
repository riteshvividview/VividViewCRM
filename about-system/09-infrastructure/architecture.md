# Architecture — VividCRM Infrastructure

## System Philosophy

VividCRM is designed as a **distributed monolith**: a single NestJS application with clean module boundaries, deployed as one process today and separable into microservices without rewriting if scale demands it. The frontend is a separate Next.js deployment communicating with the backend exclusively via REST and WebSocket. Every infrastructure component is chosen to maximise operational simplicity for a small team while remaining capable of scaling to thousands of concurrent users.

---

## High-Level System Topology

```
                              ┌─────────────────────────────────┐
                              │         USERS (Browser)         │
                              │   Mobile · Tablet · Desktop     │
                              └──────────────┬──────────────────┘
                                             │ HTTPS / WSS
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE (Edge)                            │
│          CDN · DDoS Protection · DNS · SSL Termination             │
│          WAF · Rate Limiting (IP-level)                             │
└────────────────────┬────────────────────────┬───────────────────────┘
                     │                        │
                     ▼                        ▼
         ┌───────────────────┐    ┌───────────────────┐
         │   NEXT.JS (FE)    │    │  NESTJS (API)     │
         │   Vercel / VPS    │    │  Railway / VPS    │
         │                   │    │                   │
         │  Server Components│    │  REST API :3001   │
         │  Client Components│◄──►│  WebSocket :3001  │
         │  Static Assets    │    │  BullMQ Workers   │
         │  ISR / Edge Cache │    │  Cron Scheduler   │
         └───────────────────┘    └─────────┬─────────┘
                                            │
                    ┌───────────────────────┼──────────────────────┐
                    │                       │                      │
                    ▼                       ▼                      ▼
         ┌──────────────────┐  ┌────────────────────┐  ┌─────────────────┐
         │  POSTGRESQL      │  │  REDIS             │  │  FILE STORAGE   │
         │  Supabase        │  │  Upstash / Railway │  │  Cloudflare R2  │
         │                  │  │                    │  │                 │
         │  Primary DB      │  │  Session Cache     │  │  Documents      │
         │  Supabase Auth   │  │  BullMQ Queues     │  │  Invoices       │
         │  Row-Level Sec.  │  │  Rate Limiting     │  │  Payslips       │
         │  Connection Pool │  │  Real-Time State   │  │  Avatars        │
         │  Point-in-Time   │  │  Pub/Sub           │  │  HR Documents   │
         │  Recovery        │  │                    │  │                 │
         └──────────────────┘  └────────────────────┘  └─────────────────┘

                    ┌──────────────────────────────────────┐
                    │         EXTERNAL SERVICES             │
                    │  Brevo (Email · SMS)                 │
                    │  Sentry (Error Tracking)             │
                    │  GitHub Actions (CI/CD)              │
                    │  Better Uptime (Availability)        │
                    └──────────────────────────────────────┘
```

---

## Component Inventory

### Frontend — Next.js 15

| Attribute | Value |
|---|---|
| **Runtime** | Node.js 20 LTS |
| **Framework** | Next.js 15 (App Router) |
| **Rendering** | RSC (server) + CSR (client components) |
| **Hosting** | Vercel (production/staging) · localhost:3000 (development) |
| **Build output** | Standalone (for Docker) or Vercel build |
| **Edge runtime** | Middleware runs on Vercel Edge (route protection) |
| **Environment** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` |

**Next.js rendering strategy per route:**

| Route Type | Strategy | Why |
|---|---|---|
| Login, forgot-password | SSR | No auth needed; dynamic per request |
| Dashboard | SSR on first load, CSR after | Fresh data on arrival; fast subsequent navigation |
| List views (Leads, Tasks, etc.) | CSR with TanStack Query | Frequent updates; filter-driven; real-time |
| Detail pages | SSR (initial skeleton) + CSR | SEO not needed; use SSR for initial payload |
| Reports | CSR | Data too dynamic for static |
| Settings | CSR | Infrequent access |

---

### Backend — NestJS

| Attribute | Value |
|---|---|
| **Runtime** | Node.js 20 LTS |
| **Framework** | NestJS 10 |
| **API** | REST (Express adapter) + WebSocket (Socket.IO) |
| **Port** | 3001 |
| **Hosting** | Railway · Render · Fly.io · or Docker on VPS |
| **Process model** | Single process with cluster mode (PM2) for CPU utilisation |
| **Workers** | BullMQ workers run in the same process (separate queues) |
| **Health check** | `GET /health` — checks DB + Redis + storage connectivity |

**NestJS module dependency graph:**

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global)
├── RedisModule (global)
├── BullModule (global)
├── SocketModule (global)
├── AuditModule (global)
├── StorageModule (global)
│
├── AuthModule
│   └── UsersModule
│
├── WorkspaceModule
│
├── CrmModule
│   ├── LeadsModule
│   ├── DealsModule
│   ├── ContactsModule
│   ├── CompaniesModule
│   ├── CampaignsModule
│   └── MailingModule
│
├── TasksModule
│   ├── ProjectsModule
│   ├── BoardsModule
│   ├── TasksModule
│   ├── TimeEntriesModule
│   ├── SprintsModule
│   └── RecurringTasksModule
│
├── HrmsModule
│   ├── EmployeesModule
│   ├── DepartmentsModule
│   ├── ShiftsModule
│   ├── AttendanceModule
│   ├── LeavesModule
│   ├── PayrollModule
│   └── PerformanceModule
│
├── InvoiceModule
│   ├── InvoicesModule
│   ├── PaymentsModule
│   └── CreditNotesModule
│
├── NotificationsModule
├── DocumentsModule
├── ApprovalsModule
└── ReportsModule
```

---

### Database — PostgreSQL on Supabase

| Attribute | Value |
|---|---|
| **Provider** | Supabase (managed PostgreSQL 15) |
| **Mode** | Supabase Database (direct PostgreSQL — not Auth or Realtime) |
| **Connection** | Supabase connection pooler (PgBouncer) on port 6543 |
| **Direct connection** | Port 5432 (for migrations only) |
| **Extensions** | `pg_trgm`, `pg_stat_statements`, `uuid-ossp` |
| **Backups** | Supabase PITR (Point-in-Time Recovery) — up to 30 days |
| **Region** | `ap-south-1` (Mumbai) — matches user geography |

**Connection string strategy:**

```
# Prisma migrations (direct connection — bypasses pooler)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Application queries (pooled connection — use for all runtime queries)
DATABASE_DIRECT_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

> Prisma requires `DIRECT_URL` for migrations because PgBouncer does not support prepared statements (which migrations use). Runtime queries use the pooler URL.

---

### Redis

| Attribute | Value |
|---|---|
| **Provider** | Upstash Redis (serverless, pay-per-request) · or Railway Redis (always-on) |
| **Mode** | Single region, persistence enabled (AOF) |
| **Use cases** | BullMQ queues · Session cache · Rate limiting · Pub/Sub (Socket.IO adapter) · Feature flags |
| **Max memory policy** | `allkeys-lru` (evict least recently used when full) |
| **Key naming** | `{workspaceId}:{domain}:{identifier}` |

**Upstash vs Railway decision:**

| Factor | Upstash | Railway |
|---|---|---|
| Cost (low traffic) | ~$0/month (free tier 10K cmd/day) | $5/month fixed |
| Cost (high traffic) | Per-request ($0.2 per 100K) | Fixed (up to 1GB RAM) |
| Latency | ~1–3ms (edge) | ~0.5ms (same region) |
| BullMQ compatibility | Full | Full |
| Recommendation | Development + Staging | Production |

---

### File Storage — Cloudflare R2

| Attribute | Value |
|---|---|
| **Provider** | Cloudflare R2 |
| **Compatibility** | S3-compatible API (use `@aws-sdk/client-s3`) |
| **Egress cost** | Free (no egress fees — key advantage over S3) |
| **Storage cost** | $0.015/GB/month |
| **CDN** | Cloudflare CDN in front of R2 public bucket |
| **Private objects** | Signed URLs (expiry: 5 minutes for payslips; 1 hour for documents) |
| **Bucket structure** | One bucket per environment |

**Bucket key structure:**
```
{workspaceId}/
├── avatars/
│   └── {userId}.{ext}
├── documents/
│   └── {year}/{month}/{uuid}.{ext}
├── invoices/
│   └── {invoiceNumber}.pdf
├── payslips/
│   └── {year}/{month}/{employeeId}.pdf
└── hrms/
    └── {employeeId}/{documentType}/{uuid}.{ext}
```

---

### Socket.IO Topology

Socket.IO runs inside the NestJS process. For horizontal scaling (multiple NestJS instances), Socket.IO requires a Redis adapter so events emitted on instance A are delivered to clients connected to instance B.

```
┌──────────────────┐     ┌──────────────────┐
│  NestJS Pod A    │     │  NestJS Pod B    │
│                  │     │                  │
│  Socket.IO       │     │  Socket.IO       │
│  ┌────────────┐  │     │  ┌────────────┐  │
│  │ user:U1    │  │     │  │ user:U2    │  │
│  │ user:U3    │  │     │  │ user:U4    │  │
│  └────────────┘  │     │  └────────────┘  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └────────┬───────────────┘
                  ▼
         ┌────────────────┐
         │   Redis        │
         │   Pub/Sub      │  ← @socket.io/redis-adapter
         └────────────────┘

Pod A emits to user:U2 →
  Redis pub/sub broadcasts →
    Pod B delivers to connected client U2
```

**Single instance (Phase 1):** No Redis adapter needed. One NestJS pod handles all connections.
**Multi-instance (Phase 2+):** Add `@socket.io/redis-adapter` — zero code change to gateway logic.

---

## Data Flow Diagrams

### Request Flow — REST API

```
Browser
  │ HTTPS GET /api/v1/leads
  ▼
Cloudflare Edge
  │ SSL termination, WAF check, rate limit (IP-level)
  ▼
Next.js (Vercel Edge)
  │ middleware.ts — validate session cookie → forward to NestJS
  │ (or direct browser request for client-side fetches)
  ▼
NestJS :3001
  │ JwtAuthGuard — validate Bearer token
  │ RolesGuard — check role permission
  │ WorkspaceScopeGuard — inject workspaceId into Prisma context
  │ Controller → Service
  │
  ├── Redis (CacheService.getOrSet)
  │     Hit → return cached response
  │     Miss → continue to Prisma
  │
  └── Prisma → Supabase PgBouncer :6543
        │ Query with workspaceId scope filter
        │ Soft-delete filter
        ▼
      PostgreSQL — return rows
        │
      Prisma hydrates response
        │
      Redis.set (cache for N seconds)
        │
      Serializer (class-transformer) — strip fields by role
        │
      HTTP 200 JSON response
```

### Real-Time Flow — Socket.IO Event

```
NestJS Service (e.g., TasksService.update)
  │ task status changed
  ▼
SocketService.emitToBoard(boardId, 'task.status_changed', payload)
  │
  ▼
Socket.IO Gateway
  │ emit to room: board:{boardId}
  │ (via Redis adapter if multi-pod)
  ▼
All WebSocket clients subscribed to board:{boardId}
  │
  ▼
TanStack Query cache invalidation on client
  │ queryClient.invalidateQueries(['tasks', boardId])
  ▼
UI updates without user refresh
```

### Background Job Flow — BullMQ

```
API Request: POST /payroll-runs
  │ PayrollRunsService.create()
  │ Save PayrollRun record (status: DRAFT)
  │ bullmqQueue.add('payroll-compute', { runId })
  ▼
HTTP 201 response returned immediately (non-blocking)

BullMQ Worker (same or separate process)
  │ Pick up job from Redis queue
  │ PayrollComputeProcessor.process(job)
  │   └── Compute all employee payslips
  │   └── Update PayrollRun record
  │   └── Emit Socket.IO event: 'payroll.computed'
  │   └── Notify HR via NotificationsService
  ▼
Job complete — removed from queue (or moved to failed)
```

---

## Environment Topology

### Development

```
Developer Laptop
├── Docker Compose
│   ├── postgres:15        :5432  (local, no Supabase)
│   ├── redis:7            :6379  (local)
│   └── mailpit            :8025  (local email capture)
│
├── NestJS (ts-node-dev)   :3001  (hot reload)
└── Next.js (next dev)     :3000  (HMR)
```

### Staging

```
Cloud (Single VPS or Railway)
├── NestJS Docker container   :3001
├── Next.js Vercel Preview    :staging.vividcrm.app
├── Supabase (staging project)
├── Upstash Redis
└── Cloudflare R2 (staging bucket)
```

### Production

```
Cloudflare (DNS + WAF + CDN)
├── Next.js → Vercel Production
├── NestJS → Railway Production (or Fly.io)
│   └── PM2 cluster (2 workers per vCPU)
├── Supabase (production project, PITR enabled)
├── Upstash Redis (or Railway Redis)
└── Cloudflare R2 (production bucket)
```

---

## Scalability Design

### Horizontal Scaling Readiness

| Component | Scale Strategy | Bottleneck at |
|---|---|---|
| Next.js | Vercel auto-scales (serverless functions) | Not a bottleneck |
| NestJS REST | Add more instances; stateless HTTP | ~500 req/s per instance |
| NestJS WebSocket | Redis adapter enables multi-pod; sticky sessions from load balancer | ~10K connections per pod |
| BullMQ Workers | Add worker instances; share queue from Redis | Queue throughput (Redis limited) |
| PostgreSQL | Supabase read replicas (Phase 2+); connection pooling now | ~1K concurrent connections |
| Redis | Upstash auto-scales; or Redis Cluster for self-hosted | ~100K ops/second single shard |
| R2 / File storage | Cloudflare scales globally | Not a bottleneck |

### Current Sizing (Phase 1 — Internal Platform)

| Resource | Development | Staging | Production |
|---|---|---|---|
| NestJS RAM | 512MB | 512MB | 1GB |
| NestJS vCPU | N/A (dev) | 0.5 vCPU | 1 vCPU (2 PM2 workers) |
| PostgreSQL | Local | Supabase Free (500MB) | Supabase Pro (8GB, PITR) |
| Redis | Local | Upstash Free (10K cmd/day) | Upstash Pay-as-you-go |
| Storage | Local | R2 (dev bucket) | R2 (prod bucket) |

---

## Service Dependencies Matrix

| Service | Depends On | Required? | Graceful Degradation |
|---|---|---|---|
| NestJS | PostgreSQL | Required | App refuses to start if DB unreachable |
| NestJS | Redis | Required | BullMQ and Socket.IO fail without Redis |
| NestJS | R2 / S3 | Soft | File operations fail; everything else works |
| NestJS | Brevo | Soft | Email notifications fail; in-app notifications still work |
| BullMQ | Redis | Required | Jobs queue in memory temporarily if Redis briefly down |
| Socket.IO | Redis (adapter) | Soft (multi-pod) | Single-pod works without Redis adapter |
| Next.js | NestJS API | Required | Auth redirects to login; all pages show error state |
| Prisma | PostgreSQL | Required | All DB operations fail |
| Prisma migrations | Direct PG (no pooler) | Required (deploy only) | N/A |
