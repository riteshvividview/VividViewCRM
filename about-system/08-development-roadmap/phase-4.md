# Phase 4 — Optimization, QA, and Overall Roadmap Summary

## Phase Summary

| Attribute | Value |
|---|---|
| **Phase** | 4 of 6 (covers product Phase 6: Optimization) |
| **Duration** | 4 weeks (2 × 2-week sprints) |
| **Overall Completion** | `░░░░░░░░░░` 0% |
| **Status** | Not Started |
| **Prerequisite** | Phase 3 fully complete |
| **Goal** | Harden, optimise, and validate the complete platform — performance tuning, security review, mobile QA, cross-module integration testing, monitoring setup, and SaaS-readiness groundwork |

---

## Phase Completion Tracker

```
── Performance Optimization ─────────────────────────────
Database query optimization   ░░░░░░░░░░   0%
Redis caching layer           ░░░░░░░░░░   0%
API response time < 200ms p95 ░░░░░░░░░░   0%
BullMQ queue tuning           ░░░░░░░░░░   0%
Bundle size optimization      ░░░░░░░░░░   0%
Image and asset optimization  ░░░░░░░░░░   0%

── Security Hardening ───────────────────────────────────
Auth penetration testing      ░░░░░░░░░░   0%
RBAC edge case coverage       ░░░░░░░░░░   0%
Input sanitization audit      ░░░░░░░░░░   0%
Rate limiting audit           ░░░░░░░░░░   0%
Sensitive data masking review ░░░░░░░░░░   0%
CSP and security headers      ░░░░░░░░░░   0%

── Quality Assurance ────────────────────────────────────
Backend integration tests     ░░░░░░░░░░   0%
End-to-end tests (Playwright) ░░░░░░░░░░   0%
Mobile QA (all breakpoints)   ░░░░░░░░░░   0%
Cross-browser testing         ░░░░░░░░░░   0%
Accessibility audit (WCAG AA) ░░░░░░░░░░   0%
Load testing                  ░░░░░░░░░░   0%

── Monitoring and Observability ─────────────────────────
Error tracking (Sentry)       ░░░░░░░░░░   0%
Application metrics           ░░░░░░░░░░   0%
BullMQ job monitoring         ░░░░░░░░░░   0%
Uptime monitoring             ░░░░░░░░░░   0%
Log aggregation               ░░░░░░░░░░   0%

── SaaS Readiness ───────────────────────────────────────
Multi-workspace data isolation░░░░░░░░░░   0%
Feature flag system           ░░░░░░░░░░   0%
Onboarding flow               ░░░░░░░░░░   0%
Documentation                 ░░░░░░░░░░   0%
─────────────────────────────────────────────────────────
PHASE 4 TOTAL                 ░░░░░░░░░░   0%
```

---

## Sprint 13 — Week 23–24: Performance and Security

### 4.1 Database Query Optimization

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

**Query analysis:**
- [ ] Run `EXPLAIN ANALYZE` on every list endpoint query; log queries with `DEBUG=prisma:query` in staging
- [ ] Identify N+1 queries using Prisma's query log — every `findMany` must use `include` not separate queries
- [ ] Common N+1 fixes:
  - Leads list: `include: { assignedTo: true, team: true }` (not separate queries per lead)
  - Tasks list: `include: { assignee: true, labels: { include: { label: true } } }`
  - Payroll line items: `include: { employee: { include: { user: true } } }`
- [ ] Verify all indexes from `05-database-design/indexing-strategy.md` exist in production schema:
  ```bash
  # Check index existence
  SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
  ```
- [ ] Create partial indexes via raw SQL migration (the 5 critical partial indexes from indexing strategy)
- [ ] `pg_trgm` indexes for full-text search on leads, contacts, tasks — verify query uses `ILIKE` with `%term%` and pg_trgm kicks in (check via `EXPLAIN`)
- [ ] Add `pg_stat_statements` extension to track slow queries in production:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  ```
- [ ] Implement query result pagination with cursor-based pagination for feeds (notifications, activity logs) — page-based pagination is acceptable for tables

**Response time targets:**
| Endpoint | Target p95 | Acceptable p99 |
|---|---|---|
| List endpoints (leads, tasks, employees) | < 150ms | < 300ms |
| Detail endpoints (single record + relations) | < 100ms | < 200ms |
| Report endpoints (aggregations) | < 500ms | < 1,000ms |
| Auth endpoints (login, refresh) | < 200ms | < 400ms |
| File upload | < 2,000ms | < 5,000ms |

---

### 4.2 Redis Caching Layer

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

Cache strategy: **cache-aside** (read from cache first; on miss, read DB, write to cache).

- [ ] **Dashboard KPIs** (highest read frequency, low write frequency):
  - Cache key: `{workspaceId}:dashboard:kpis:{roleScope}`
  - TTL: 300 seconds (5 minutes)
  - Invalidate on: new lead created, deal status changed, invoice paid
- [ ] **User list** (used by assignee dropdowns, @mention resolution):
  - Cache key: `{workspaceId}:users:active`
  - TTL: 600 seconds
  - Invalidate on: user created, role changed, deactivated
- [ ] **Leave balances** (read frequently during leave application):
  - Cache key: `{workspaceId}:leave-balances:{employeeId}:{year}`
  - TTL: 300 seconds
  - Invalidate on: leave approved, balance allocated, balance adjusted
- [ ] **Notification unread count** (polled frequently for badge):
  - Cache key: `{workspaceId}:notifications:unread:{userId}`
  - TTL: 60 seconds
  - Invalidate on: new notification created, notification marked read
- [ ] **Holiday calendar** (read on every attendance computation):
  - Cache key: `{workspaceId}:holidays:{year}`
  - TTL: 86400 seconds (24 hours)
  - Invalidate on: holiday created, deleted

**Caching utility:**
```ts
@Injectable()
export class CacheService {
  async getOrSet<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key)
    if (cached) return JSON.parse(cached) as T
    const fresh = await factory()
    await this.redis.set(key, JSON.stringify(fresh), 'EX', ttl)
    return fresh
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length) await this.redis.del(...keys)
  }
}
```

---

### 4.3 API Rate Limiting Audit

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

- [ ] Verify `@nestjs/throttler` applied globally with workspace-scoped limiting:
  - Default: 100 requests per minute per user
  - Auth endpoints: 10 per 15 minutes per IP (existing)
  - Export endpoints: 5 per hour per user (sensitive exports)
  - Report endpoints: 20 per minute per user
  - WebSocket connections: 5 per user
- [ ] Throttle store: use Redis store (`@nestjs/throttler-storage-redis`) — not in-memory (lost on restart)
- [ ] Custom throttle key: `{workspaceId}:{userId}:{route}` — per-user not per-IP for authenticated routes
- [ ] Return `Retry-After` header on 429 responses
- [ ] Test: verify brute-force protection on login does not affect other users on the same IP (workspace-scoped)

---

### 4.4 Security Hardening

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Headers and middleware:**
- [ ] `helmet()` configured — sets all recommended security headers
- [ ] Content Security Policy (CSP):
  ```ts
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // for Next.js
      styleSrc: ["'self'", "'unsafe-inline'"],   // for Tailwind inline styles
      imgSrc: ["'self'", "data:", "https://*.r2.dev"],
      connectSrc: ["'self'", "wss://", "https://api.brevo.com"],
    },
  })
  ```
- [ ] CORS: `origin: [process.env.FRONTEND_URL]` — no wildcard in production
- [ ] HTTP-only cookies for refresh tokens (not accessible to JavaScript)
- [ ] `SameSite=Strict` on auth cookies
- [ ] `Secure` flag on cookies in production (HTTPS only)

**Input security:**
- [ ] Global `ValidationPipe` with `whitelist: true` — unknown fields silently stripped (prevents mass-assignment)
- [ ] Audit all string fields that render in HTML — sanitize with `sanitize-html` where user-provided content is displayed
- [ ] SQL injection: impossible via Prisma (parameterised queries) — verify no raw SQL queries use string interpolation
- [ ] File upload validation: check magic bytes (not just extension) to prevent MIME type spoofing:
  ```ts
  import { fileTypeFromBuffer } from 'file-type'
  const type = await fileTypeFromBuffer(buffer)
  if (!allowedMimeTypes.includes(type?.mime)) throw new BadRequestException('Invalid file type')
  ```

**RBAC verification:**
- [ ] Write automated tests for all DENY entries in the permission matrix:
  - EMPLOYEE attempting `GET /payroll-runs` → 403
  - ADMIN attempting `GET /employees/:id` salary fields → salary fields absent
  - TEAM_LEAD accessing another team's leads → 404 (record invisible)
  - HR approving own leave → 403
  - HR approving own profile change → 403
- [ ] Verify last-SUPER_ADMIN protection is enforced
- [ ] Verify tokenVersion invalidation works: change role → old token rejected

---

### 4.5 Frontend Bundle Optimization

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

- [ ] Run Next.js bundle analyzer: `ANALYZE=true next build`
- [ ] Identify and lazy-load heavy components:
  - Rich text editor (Tiptap): dynamic import with loading skeleton
  - PDF preview: dynamic import
  - Recharts (charts): already chunked by Next.js; verify chart pages don't bloat dashboard bundle
  - Command palette: dynamic import (not always needed)
- [ ] Code splitting verification: each route chunk < 250KB gzipped
- [ ] Image optimization: all images via `<Image>` component (WebP auto-conversion, lazy loading, srcset)
- [ ] Font subsetting: Inter loaded with `subsets: ['latin']` only
- [ ] Unused Shadcn components: audit `components/ui/` — remove any imported but unused components
- [ ] TanStack Query: verify `staleTime` and `gcTime` settings prevent excessive background refetches
- [ ] `next.config.ts` optimization:
  ```ts
  experimental: {
    optimizeCss: true,
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
  }
  ```

---

## Sprint 14 — Week 25–26: QA, Testing, and Monitoring

### 4.6 Backend Integration Tests

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

Test framework: `@nestjs/testing` + `jest` + `supertest`

**Test coverage targets:** > 80% on service layer; 100% on permission guard logic

**Critical test scenarios:**

**Auth:**
- [ ] Login with correct credentials → 200 + tokens
- [ ] Login with wrong password → 401
- [ ] Login 11 times → 10th triggers rate limit, 11th → 429
- [ ] Refresh with valid token → new tokens
- [ ] Refresh with reused token → 401 (replay attack)
- [ ] Request with expired access token → 401
- [ ] Request with old token after role change → 401 (tokenVersion mismatch)

**Multi-tenancy:**
- [ ] User from Workspace A calls endpoint with JWT from Workspace B → 401
- [ ] User from Workspace A cannot see Workspace B's leads even via ID
- [ ] All create operations set correct `workspaceId`

**Lead module:**
- [ ] Create lead → appears in list
- [ ] Convert lead from NEW → 400 (must be QUALIFIED first)
- [ ] Convert QUALIFIED lead → creates Deal + Contact + Company atomically
- [ ] TEAM_LEAD accesses own team's lead → 200
- [ ] TEAM_LEAD accesses other team's lead → 404

**Leave system:**
- [ ] Submit leave with insufficient balance → 400
- [ ] Submit leave overlapping existing APPROVED leave → 400
- [ ] Submit and approve own leave → 403
- [ ] L1 approve → L2 notified; L2 approve → calendar blocks created; balance deducted
- [ ] Reject at L1 → balance released; employee notified
- [ ] Expire leave (mock time) → status EXPIRED; balance released

**Payroll:**
- [ ] Compute payroll → correct gross for fixed salary structure
- [ ] Pro-ration: employee joins day 15 of 31-day month → gross × (17/31)
- [ ] PF cap: employee with basic > ₹15,000 → PF capped at ₹1,800
- [ ] HR attempts to approve run where own salary is in the run → 403
- [ ] Override line item in FINALISED run → 409

**Invoice:**
- [ ] Create invoice for intra-state client → CGST + SGST split
- [ ] Create invoice for inter-state client → IGST only
- [ ] Approve own invoice (creator = approver) → 403
- [ ] Log payment equal to outstanding → status PAID
- [ ] Log payment > outstanding → 400
- [ ] Void sent invoice → time entries reverted; credit note created

---

### 4.7 End-to-End Tests (Playwright)

**Estimate:** 3 days | **Completion:** `░░░░░░░░░░` 0%

**Framework:** Playwright with TypeScript

**Golden path tests (must pass before any deploy):**

- [ ] **Auth flow**: open login → enter credentials → dashboard loads → logout → redirected to login
- [ ] **Lead pipeline**: create lead → update status to QUALIFIED → convert → deal appears in pipeline
- [ ] **Kanban board**: open project → board loads → drag task to next column → status updates
- [ ] **Leave application**: employee submits leave → TEAM_LEAD approves → HR approves → status APPROVED
- [ ] **Clock in/out**: employee opens dashboard → clock in → timer running → clock out → attendance marked PRESENT
- [ ] **Invoice flow**: create invoice → add line items → approve → PDF downloading → log payment → status PAID
- [ ] **Notification**: task assigned to user → notification bell shows badge → notification appears in popover

**Regression tests (run on every PR):**
- [ ] All page loads without 500 errors (snapshot test: each major route loads without crashing)
- [ ] Mobile viewport: sidebar hidden, bottom nav visible, all buttons tappable (44×44px)
- [ ] Dark mode: toggle dark mode → all pages render without white flashes or broken colours

---

### 4.8 Mobile QA

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

Test on actual devices (or BrowserStack):

| Device | Viewport | Tests |
|---|---|---|
| iPhone SE (2022) | 375×667 | All P1 scenarios |
| iPhone 14 | 390×844 | All P1 scenarios |
| iPad Air | 820×1180 | Tablet layout verification |
| Samsung Galaxy A54 | 360×800 | Android Chrome |
| MacBook Air 13" | 1280×800 | Desktop baseline |

**Per-device checklist:**
- [ ] Login page: no iOS zoom on email input (font-size ≥ 16px)
- [ ] Bottom navigation: all 5 tabs reachable with one thumb
- [ ] Kanban board: horizontal scroll and snap working; cards draggable
- [ ] Forms: submit button at bottom, full-width, above keyboard
- [ ] Modals/sheets: close button reachable; content scrollable
- [ ] Tables: hidden on mobile; card list shown
- [ ] Date pickers: native mobile picker triggers
- [ ] Long text: names, email addresses, invoice numbers wrap correctly; no overflow
- [ ] Images/avatars: all load; no broken images

---

### 4.9 Accessibility Audit

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

Run `axe-core` automated scan + manual keyboard navigation:

- [ ] All interactive elements reachable via Tab key
- [ ] Focus ring visible on all focusable elements (Shadcn provides this — verify not overridden)
- [ ] All icon-only buttons have `aria-label`
- [ ] All form inputs have associated `<label>` elements
- [ ] All modals: focus trapped within modal when open; returned to trigger on close
- [ ] Colour contrast: automated check with axe — no < 4.5:1 failures
- [ ] Skip to main content link at top of page for screen readers
- [ ] Status badges: text alternative (not colour only) — include text "Approved" not just green colour
- [ ] Notification toasts: `aria-live="polite"` — announced to screen readers
- [ ] Tables: `<th scope="col">` headers, `<caption>` on complex tables
- [ ] Charts: `aria-label` on chart container describing what it shows; data available in table alternative

**Target:** Zero critical axe violations; all serious violations resolved.

---

### 4.10 Load Testing

**Estimate:** 1 day | **Completion:** `░░░░░░░░░░` 0%

**Tool:** k6 (open-source load testing)

**Scenarios:**

```js
// Scenario 1: Normal load — 50 concurrent users
export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

// Scenario 2: Peak load — 200 concurrent users
// Scenario 3: Sustained load — 100 users for 30 minutes
// Scenario 4: Payroll compute spike — 10 users all trigger payroll compute simultaneously
```

**Targets:**
- 50 concurrent users: all endpoints p95 < 300ms
- 200 concurrent users: p95 < 600ms, error rate < 1%
- Payroll compute: BullMQ handles 10 simultaneous compute jobs without deadlock

---

### 4.11 Monitoring and Observability Setup

**Estimate:** 2 days | **Completion:** `░░░░░░░░░░` 0%

**Error Tracking — Sentry:**
- [ ] Install `@sentry/nestjs` (backend) and `@sentry/nextjs` (frontend)
- [ ] Configure DSN, release tracking, and environment tagging
- [ ] Capture unhandled exceptions + custom error context (workspaceId, userId, route)
- [ ] Sensitive data scrubbing: strip `password`, `passwordHash`, `bankAccountNumber`, `pan` from Sentry events
- [ ] Alert rules: Slack notification on > 10 errors/minute or any new unique error

**Application Metrics — custom `/metrics` endpoint:**
```ts
// Key metrics tracked:
{
  requestCount: counter per route per status code
  requestDuration: histogram per route
  activeWebSocketConnections: gauge
  bullmqJobsCompleted: counter per queue
  bullmqJobsFailed: counter per queue
  bullmqJobDuration: histogram per queue
  dbConnectionPool: gauge (active/idle connections)
  cacheHitRate: gauge per cache key prefix
}
```

**BullMQ Monitoring:**
- [ ] Bull Board UI at `/admin/queues` — shows all queues, jobs, failed jobs
- [ ] Alert: BullMQ worker down (no heartbeat for 5 minutes) → Slack alert
- [ ] Alert: Failed job count > 50 in any queue → Slack alert
- [ ] Dead-letter inspection: failed jobs retained indefinitely; SUPER_ADMIN can retry or discard via UI

**Uptime Monitoring:**
- [ ] `GET /health` returns:
  ```json
  {
    "status": "ok",
    "checks": {
      "database": "ok",
      "redis": "ok",
      "storage": "ok"
    },
    "timestamp": "...",
    "version": "1.0.0",
    "uptime": 86400
  }
  ```
- [ ] External uptime monitor (Better Uptime or UptimeRobot) pings `/health` every 60 seconds
- [ ] Alert: downtime > 1 minute → Slack + SMS to on-call

**Log Aggregation:**
- [ ] Structured JSON logging: `{ timestamp, level, message, workspaceId, userId, requestId, duration }`
- [ ] Request ID: `X-Request-ID` header generated per request, logged + returned in response headers
- [ ] Log levels: `error` (always sent to Sentry), `warn` (logged), `info` (production default), `debug` (dev only)
- [ ] Log shipping to aggregation service (e.g., Axiom, Logtail, or self-hosted Loki)

---

### 4.12 SaaS Readiness Checklist

**Estimate:** 1.5 days | **Completion:** `░░░░░░░░░░` 0%

These are the groundwork items that must be true before Phase 2 SaaS launch (separate product phase). Completing them now costs little but prevents future rework.

**Multi-tenant isolation verification:**
- [ ] Run a cross-workspace data isolation test: 2 workspaces created; verify zero data leakage between them
- [ ] Verify all Prisma queries on tenant-scoped models include `workspaceId` filter (script to scan all `findMany` calls)
- [ ] Workspace feature flags tested: toggle `isCrmEnabled=false` → all CRM endpoints return 403

**Self-serve onboarding groundwork:**
- [ ] `POST /api/v1/workspaces` — create workspace endpoint (SUPER_ADMIN of the platform, not workspace)
- [ ] Workspace creation: creates workspace record + first SUPER_ADMIN user + seeds default leave types + default salary structure template
- [ ] Workspace slug uniqueness enforced
- [ ] `DELETE /api/v1/workspaces/:id` — soft-delete with 30-day retention before permanent purge

**Plan-based feature flag system:**
- [ ] Feature flag check middleware: `if (!workspace.isCrmEnabled) throw new ForbiddenException('CRM module not enabled')`
- [ ] Plan tier configuration (future billing integration point):
  ```ts
  const PLAN_FEATURES = {
    INTERNAL: { crm: true, tasks: true, hrms: true, invoice: true, maxUsers: 999 },
    STARTER:  { crm: true, tasks: true, hrms: false, invoice: false, maxUsers: 10 },
    GROWTH:   { crm: true, tasks: true, hrms: true, invoice: true, maxUsers: 50 },
  }
  ```

**Documentation:**
- [ ] API documentation: `@nestjs/swagger` decorators on all controllers → auto-generated Swagger UI at `/api/docs`
- [ ] `README.md` — developer setup guide: prerequisites, env vars, seed, run commands
- [ ] `ARCHITECTURE.md` — high-level architecture diagram + module descriptions
- [ ] Deployment runbook: steps to deploy to production (Docker Compose or Kubernetes)

---

## Complete Project Timeline

### 6-Phase Gantt Overview

```
Phase       W1   W2   W3   W4   W5   W6   W7   W8   W9   W10  W11  W12
─────────────────────────────────────────────────────────────────────────
Phase 1     ████████████████████ Backend Foundation (4 weeks)
Phase 2                          ████████████████████████████████ CRM + Tasks (8 weeks)
Phase 3                                                            ...

Phase       W13  W14  W15  W16  W17  W18  W19  W20  W21  W22  W23  W24
─────────────────────────────────────────────────────────────────────────
Phase 3     ████████████████████████████████████████████ HRMS + Invoice (10 weeks)
Phase 4                                                  ██████████████ Optimization (4 weeks)
```

---

## Overall Project Completion Dashboard

```
Phase 1 — Backend Foundation      █░░░░░░░░░   8%    [In Progress]
Phase 2 — CRM + Task Management   ░░░░░░░░░░   0%    [Not Started]
Phase 3 — HRMS + Invoice          ░░░░░░░░░░   0%    [Not Started]
Phase 4 — Optimization + QA       ░░░░░░░░░░   0%    [Not Started]
──────────────────────────────────────────────────────────────────
OVERALL PROJECT                   ▒░░░░░░░░░   2%
```

---

## Estimated Timeline to Completion

| Milestone | Target Week | Completion % at Milestone |
|---|---|---|
| Phase 1 complete — foundation live | Week 4 | 12% |
| CRM fully operational | Week 8 | 30% |
| Task Management fully operational | Week 12 | 48% |
| HRMS fully operational | Week 18 | 68% |
| Invoice system fully operational | Week 22 | 84% |
| QA + Optimization complete | Week 26 | 100% |

**Total estimated duration:** 26 weeks (~6.5 months)

---

## Module-Level Completion Matrix

The table below tracks each module at the feature level — useful for daily standups and sprint planning.

| Module | Backend API | Frontend UI | Real-Time | Tests | Overall |
|---|---|---|---|---|---|
| **Foundation** | 15% | 15% | 0% | 0% | 8% |
| **Auth** | 8% | 0% | — | 0% | 4% |
| **CRM — Leads** | 0% | 0% | 0% | 0% | 0% |
| **CRM — Deals** | 0% | 0% | 0% | 0% | 0% |
| **CRM — Contacts** | 0% | 0% | — | 0% | 0% |
| **CRM — Companies** | 0% | 0% | — | 0% | 0% |
| **CRM — Campaigns** | 0% | 0% | — | 0% | 0% |
| **CRM — Mailing** | 0% | 0% | — | 0% | 0% |
| **Tasks — Projects** | 0% | 0% | 0% | 0% | 0% |
| **Tasks — Kanban** | 0% | 0% | 0% | 0% | 0% |
| **Tasks — Task Detail** | 0% | 0% | 0% | 0% | 0% |
| **Tasks — Time Entries** | 0% | 0% | — | 0% | 0% |
| **Tasks — Sprints** | 0% | 0% | 0% | 0% | 0% |
| **Tasks — Recurring** | 0% | 0% | — | 0% | 0% |
| **HRMS — Employees** | 0% | 0% | — | 0% | 0% |
| **HRMS — Attendance** | 0% | 0% | 0% | 0% | 0% |
| **HRMS — Leaves** | 0% | 0% | 0% | 0% | 0% |
| **HRMS — Payroll** | 0% | 0% | 0% | 0% | 0% |
| **HRMS — Onboarding** | 0% | 0% | — | 0% | 0% |
| **HRMS — Exit** | 0% | 0% | — | 0% | 0% |
| **Invoice — Core** | 0% | 0% | — | 0% | 0% |
| **Invoice — PDF** | 0% | 0% | — | 0% | 0% |
| **Invoice — Payments** | 0% | 0% | — | 0% | 0% |
| **Invoice — Reports** | 0% | 0% | — | 0% | 0% |
| **Notifications** | 0% | 0% | 0% | 0% | 0% |
| **Audit** | 0% | 0% | — | 0% | 0% |
| **Documents** | 0% | 0% | — | 0% | 0% |
| **Approvals** | 0% | 0% | 0% | 0% | 0% |

---

## Sprint Velocity Reference

Each 2-week sprint has an estimated capacity of **~80 engineer-hours** (1 full-stack developer, 8h/day × 10 days). Tasks are estimated to fit within this budget.

| Sprint | Phase | Focus | Estimated Hours |
|---|---|---|---|
| Sprint 1 | Phase 1 | NestJS setup + Prisma + Auth backend | 80h |
| Sprint 2 | Phase 1 | Redis + BullMQ + Socket.IO + Notifications + Frontend shell | 80h |
| Sprint 3 | Phase 2 | CRM backend (Leads, Deals, Contacts, Companies, Campaigns) | 80h |
| Sprint 4 | Phase 2 | CRM frontend (Leads UI, Deals Pipeline, Contacts, Mailing) | 80h |
| Sprint 5 | Phase 2 | Tasks backend (Projects, Boards, Tasks, Time Entries, Sprints) | 80h |
| Sprint 6 | Phase 2 | Tasks frontend (Kanban, Task detail, Sprint board, Time tracking) | 80h |
| Sprint 7 | Phase 3 | HRMS — Employees + Departments + Shifts | 80h |
| Sprint 8 | Phase 3 | HRMS — Attendance + Leave system | 80h |
| Sprint 9 | Phase 3 | HRMS — Payroll engine + PDF payslips | 80h |
| Sprint 10 | Phase 3 | HRMS frontend (all screens) | 80h |
| Sprint 11 | Phase 3 | Invoice backend + PDF + Reports | 80h |
| Sprint 12 | Phase 3 | Invoice frontend | 80h |
| Sprint 13 | Phase 4 | Performance + Security hardening | 80h |
| Sprint 14 | Phase 4 | QA + Testing + Monitoring + SaaS readiness | 80h |

---

## Risk Register — Overall Project

| Risk | Phase | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Scope creep — "just one more feature" per sprint | All | High | High | Feature freeze per phase; new requests go to a backlog for post-Phase 4 consideration |
| Payroll engine bugs cause incorrect payslips | 3 | Medium | Critical | 100% unit test coverage on computation engine; parallel manual verification for first 3 runs |
| PDF generation at scale (100 payslips simultaneously) | 3 | Medium | High | Concurrency limit on BullMQ PDF jobs (max 5 concurrent); jobs auto-retry |
| Brevo API changes break mailing / payslip delivery | 2, 3 | Low | Medium | Abstract Brevo behind an `EmailProvider` interface; swap implementation without changing callers |
| Multi-tenancy data leak discovered late | All | Low | Critical | Write cross-workspace isolation test in Phase 1; run on every PR in CI |
| Mobile performance on low-end Android | 4 | Medium | Medium | Test on Samsung Galaxy A54 (mid-range) throughout development, not just at end |
| Single developer bottleneck | All | High | High | Detailed documentation (this roadmap); modular architecture allows second developer to join any module cleanly |
| Next.js App Router + Shadcn compatibility issues | 1 | Medium | Medium | Verify all Shadcn components work in App Router before committing to them; Shadcn is RSC-compatible |

---

## Definition of "Production Ready"

The platform is production ready when all of the following are true:

**Functional completeness:**
- [ ] All 6 phases complete
- [ ] All role-permission combinations tested and verified
- [ ] All cross-module flows working (Deal → Project → Time Entry → Invoice; Employee → Onboarding → Payroll)

**Quality gates:**
- [ ] Backend integration test coverage > 80% on service layer
- [ ] Zero critical or high-severity axe accessibility violations
- [ ] Load test: p95 < 300ms at 50 concurrent users
- [ ] Zero known security vulnerabilities (npm audit + OWASP checklist)

**Operations:**
- [ ] Sentry error tracking active
- [ ] Uptime monitoring active with < 1-minute alert SLA
- [ ] BullMQ job monitoring active with failed-job alerts
- [ ] Deployment pipeline (CI/CD) runs tests before every deploy
- [ ] Database backup: automated daily backups to separate storage region

**Data integrity:**
- [ ] Audit log: all sensitive mutations logged and verified
- [ ] PostgreSQL RLS: `UPDATE`/`DELETE` on `audit_logs` blocked at DB level
- [ ] Cross-workspace isolation: automated test in CI passes
- [ ] BILLED time entry lock: verified with integration test

**User experience:**
- [ ] All primary flows tested on iPhone SE (375px)
- [ ] All pages load < 3 seconds on 4G mobile (Lighthouse Performance > 80)
- [ ] Dark mode works across all pages with no broken colours
- [ ] Every list has an empty state; every async operation has a loading state
