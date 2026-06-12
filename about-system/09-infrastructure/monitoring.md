# Monitoring — VividCRM Infrastructure

## Monitoring Philosophy

Monitor for **symptoms that matter to users**, not just for component health. A database that is up but returning slow queries is worse than a database that is briefly down — both impact users, but the slow database is harder to detect without proper observability.

Three pillars cover every observable aspect of the system:

```
┌──────────────────────────────────────────────────────────────┐
│  METRICS (What is happening?)                                │
│  Response times · Error rates · Queue depths · CPU/Memory   │
├──────────────────────────────────────────────────────────────┤
│  LOGS (Why is it happening?)                                 │
│  Structured JSON logs · Request traces · Error context      │
├──────────────────────────────────────────────────────────────┤
│  ALERTS (When do I need to act?)                            │
│  SLO breaches · Error rate spikes · Queue failures · Down   │
└──────────────────────────────────────────────────────────────┘
```

---

## Tooling Stack

| Tool | Purpose | Environment |
|---|---|---|
| **Sentry** | Error tracking + performance monitoring | Staging + Production |
| **Railway Metrics** | Container CPU/RAM/network | Staging + Production |
| **Supabase Dashboard** | DB query performance, slow queries, pool usage | All |
| **Upstash Console** | Redis memory, command rate, latency | Staging + Production |
| **Bull Board** | BullMQ queue depths, failed jobs, job timings | All |
| **Better Uptime** | External uptime monitoring (synthetic) | Staging + Production |
| **Axiom / Logtail** | Log aggregation and search | Staging + Production |
| **Slack** | Alert delivery channel | Staging + Production |
| **Vercel Analytics** | Frontend Web Vitals, page load times | Production |

---

## Health Check Endpoint

The canonical health check is `GET /health`. It is the single source of truth for whether the API is ready to serve traffic.

### Implementation

```ts
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @SkipAuth()  // No JWT required
  async check(): Promise<HealthCheckResult> {
    const start = Date.now()
    const checks: Record<string, CheckResult> = {}

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`
      checks.database = { status: 'ok', latencyMs: Date.now() - start }
    } catch (err) {
      checks.database = { status: 'error', error: 'DB query failed' }
    }

    // Redis check
    const redisStart = Date.now()
    try {
      await this.redis.ping()
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
    } catch (err) {
      checks.redis = { status: 'error', error: 'Redis ping failed' }
    }

    // Storage check (lightweight — check env vars are set, not actual upload)
    checks.storage = {
      status: process.env.R2_BUCKET_NAME ? 'ok' : 'error',
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok')
    const status = allOk ? 'ok' : 'degraded'

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      checks,
    }
  }
}
```

**Response (healthy):**
```json
{
  "status": "ok",
  "timestamp": "2025-06-16T09:00:00.000Z",
  "version": "1.2.0",
  "environment": "production",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latencyMs": 8 },
    "redis": { "status": "ok", "latencyMs": 2 },
    "storage": { "status": "ok" }
  }
}
```

**Response (degraded):**
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "ok", "latencyMs": 8 },
    "redis": { "status": "error", "error": "Redis ping failed" },
    "storage": { "status": "ok" }
  }
}
```

HTTP status code: `200 OK` when healthy; `503 Service Unavailable` when degraded.

---

## Error Tracking — Sentry

### NestJS Backend Configuration

```ts
// main.ts
import * as Sentry from '@sentry/nestjs'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  profilesSampleRate: 0.1,
  integrations: [
    nodeProfilingIntegration(),
  ],

  // Scrub sensitive data before sending to Sentry
  beforeSend(event) {
    // Remove sensitive fields from request body
    if (event.request?.data) {
      const body = event.request.data as Record<string, unknown>
      const sensitiveFields = ['password', 'passwordHash', 'bankAccountNumber', 'pan', 'aadhaar', 'refreshToken']
      sensitiveFields.forEach(field => {
        if (field in body) body[field] = '[REDACTED]'
      })
    }
    // Remove auth headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  },

  // Add workspace and user context
  // Set in JwtAuthGuard after token validation:
  // Sentry.setUser({ id: user.id, workspaceId: user.workspaceId, role: user.role })
})
```

### Error Capture in Exception Filter

```ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest()
    const response = ctx.getResponse()

    // Capture non-HTTP errors in Sentry (operational errors — not user mistakes)
    if (!(exception instanceof HttpException)) {
      Sentry.captureException(exception, {
        tags: {
          requestId: request.requestId,
          workspaceId: request.user?.workspaceId,
          userId: request.user?.id,
          route: `${request.method} ${request.url}`,
        },
      })
    }

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    response.status(status).json({
      statusCode: status,
      message: exception instanceof HttpException
        ? exception.message
        : 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
    })
  }
}
```

### Next.js Frontend Configuration

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV,
  tracesSampleRate: process.env.NEXT_PUBLIC_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,       // Session replay 10% of sessions
  replaysOnErrorSampleRate: 1.0,       // 100% replay on error

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,               // Mask all text in replay (privacy)
      blockAllMedia: true,             // Block media in replay
    }),
  ],

  beforeSend(event) {
    // Remove any accidentally captured sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies
    }
    return event
  },
})
```

### Sentry Alert Rules

```
Rule 1: New issue — any new error type never seen before
  Condition: A new issue is created
  Action: Notify Slack #alerts immediately

Rule 2: Error rate spike
  Condition: Issue count > 50 in 10 minutes (vs baseline < 5)
  Action: Notify Slack #alerts + email on-call

Rule 3: High priority issues
  Condition: Issue tagged as P0 (Critical)
  Action: PagerDuty (or SMS) to on-call

Rule 4: Performance regression
  Condition: p95 latency > 2000ms on any transaction for > 5 minutes
  Action: Notify Slack #alerts

Rule 5: Ignored issues re-occur
  Condition: Previously resolved issue reactivates
  Action: Notify Slack #alerts
```

---

## Structured Logging

### Log Format

```ts
// logger.service.ts
// All logs are JSON objects in production; pretty-printed in development

interface LogEntry {
  timestamp: string        // ISO 8601 UTC
  level: 'error' | 'warn' | 'log' | 'debug' | 'verbose'
  message: string
  context?: string         // NestJS context (class name)
  requestId?: string       // X-Request-ID header value
  workspaceId?: string     // Current workspace (from JWT)
  userId?: string          // Current user (from JWT)
  duration?: number        // Request duration in ms
  statusCode?: number      // HTTP status code
  method?: string          // HTTP method
  url?: string             // Request URL (path only, no query params with secrets)
  error?: {
    name: string
    message: string
    stack?: string         // Only in non-production
  }
  meta?: Record<string, unknown>  // Additional context
}
```

### Request Logging Middleware

```ts
// logging.middleware.ts
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()
    const requestId = req.requestId

    res.on('finish', () => {
      const duration = Date.now() - start
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log',
        message: `${req.method} ${req.path} ${res.statusCode}`,
        requestId,
        workspaceId: req.user?.workspaceId,
        userId: req.user?.id,
        method: req.method,
        url: req.path,             // NOT req.url — avoids logging query params with tokens
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
      }

      // Skip logging health check to reduce noise
      if (req.path === '/health') return

      console.log(JSON.stringify(logEntry))
    })

    next()
  }
}
```

### Log Levels by Environment

| Level | Development | Staging | Production |
|---|---|---|---|
| `verbose` | ✅ | ❌ | ❌ |
| `debug` | ✅ | ✅ | ❌ |
| `log` | ✅ | ✅ | ✅ |
| `warn` | ✅ | ✅ | ✅ |
| `error` | ✅ | ✅ | ✅ |

---

## Application Metrics

Custom metrics exposed at `GET /metrics` (SUPER_ADMIN only):

```ts
// metrics.controller.ts
@Get('metrics')
@Roles(Role.SUPER_ADMIN)
async getMetrics(): Promise<MetricsSnapshot> {
  const [
    requestCounts,
    queueDepths,
    activeConnections,
    cacheHitRate,
    dbPoolStats,
  ] = await Promise.all([
    this.metricsService.getRequestCounts(),
    this.metricsService.getQueueDepths(),
    this.socketService.getActiveConnectionCount(),
    this.cacheService.getHitRate(),
    this.prismaService.getPoolStats(),
  ])

  return {
    timestamp: new Date().toISOString(),
    api: {
      requestsPerMinute: requestCounts.perMinute,
      errorRate: requestCounts.errorRate,
      p50LatencyMs: requestCounts.p50,
      p95LatencyMs: requestCounts.p95,
      p99LatencyMs: requestCounts.p99,
    },
    queues: queueDepths,        // { queueName: { waiting, active, failed } }
    realtime: {
      activeWebSocketConnections: activeConnections,
    },
    cache: {
      hitRate: cacheHitRate,
      keysCount: await this.redis.dbsize(),
    },
    database: {
      poolActiveConnections: dbPoolStats.active,
      poolIdleConnections: dbPoolStats.idle,
    },
  }
}
```

### BullMQ Queue Monitoring

```ts
// queue-monitor.service.ts — runs every 60 seconds
@Cron(CronExpression.EVERY_MINUTE)
async monitorQueues() {
  const queues = ['email-notifications', 'audit-log', 'pdf-generation',
                  'attendance-compute', 'payroll-compute', 'recurring-tasks']

  for (const queueName of queues) {
    const queue = this.bullMQService.getQueue(queueName)
    const [waiting, active, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    // Alert thresholds
    if (failed > 50) {
      await this.alertService.send({
        severity: 'HIGH',
        message: `BullMQ queue ${queueName} has ${failed} failed jobs`,
        queue: queueName,
      })
    }

    if (waiting > 500) {
      await this.alertService.send({
        severity: 'MEDIUM',
        message: `BullMQ queue ${queueName} has ${waiting} waiting jobs — processing may be slow`,
      })
    }

    // Log metrics
    this.logger.log({
      message: `Queue metrics: ${queueName}`,
      meta: { waiting, active, failed, delayed },
    })
  }
}
```

---

## Uptime Monitoring — Better Uptime

### Monitors Configuration

| Monitor | URL | Method | Expected | Check Interval |
|---|---|---|---|---|
| API Health | `https://api.vividcrm.in/health` | GET | `200, status:"ok"` | 60 seconds |
| Frontend | `https://app.vividcrm.in` | GET | `200` | 60 seconds |
| API Login | `https://api.vividcrm.in/api/v1/auth/login` | POST | `200 or 401` | 5 minutes |
| Staging API | `https://api-staging.vividcrm.in/health` | GET | `200` | 5 minutes |

**Alert channels:**
- Down for > 1 minute → Slack #alerts + SMS to on-call
- Back up → Slack #alerts (recovery notification)

**SSL certificate monitoring:**
- Alert when certificate expires within 30 days
- Cloudflare auto-renews certificates — but still monitor for mis-configuration

---

## Service Level Objectives (SLOs)

SLOs define what "good" looks like. They are measured over a 30-day rolling window.

| SLO | Target | Measurement | Alert at |
|---|---|---|---|
| **API Availability** | 99.5% uptime | `status = 200` on `/health` | < 99.5% (< 3.6h down/month) |
| **API Latency (p95)** | < 300ms | 95th percentile response time | > 500ms sustained 5 min |
| **API Latency (p99)** | < 1,000ms | 99th percentile response time | > 2,000ms sustained 5 min |
| **API Error Rate** | < 0.5% | 5xx responses / total requests | > 2% over 5 minutes |
| **Auth Latency** | < 500ms p95 | Login + token operations | > 1,000ms |
| **BullMQ Job Success** | > 99% | Completed / (Completed + Failed) | < 98% over 1 hour |
| **PDF Generation** | < 30s p95 | Time from job enqueue to PDF ready | > 60s (alert only, not page) |
| **WebSocket Uptime** | > 99.5% | Gateway accepts connections | < 99% |
| **Frontend LCP** | < 2.5s | Largest Contentful Paint | > 4s (Vercel analytics) |

### Error Budget

For 99.5% API availability SLO over 30 days:
- Total minutes: 43,200
- Allowed downtime: 43,200 × 0.005 = 216 minutes (~3.6 hours)
- Error budget consumed: tracked weekly; no deployments if budget exhausted until next cycle

---

## Alert Runbook

### Alert: API Health Check Failing

```
Trigger: /health returns non-200 for > 2 minutes

Investigation steps:
1. Check Railway deployment logs — did a deployment just happen?
   railway logs --tail 100

2. Check Sentry for new critical errors in the last 10 minutes

3. Check database connectivity:
   - Open Supabase dashboard → check connection count
   - If connection count near max: PgBouncer may be saturated
   - Fix: restart NestJS pod (Railway dashboard → Restart)

4. Check Redis:
   - Upstash console: is the instance reachable?
   - If Redis is down: BullMQ paused; Socket.IO degraded; app still functional for REST

5. Check if a migration is in progress:
   - Incomplete migration can lock tables
   - Supabase → SQL Editor: SELECT * FROM pg_locks WHERE NOT granted;

Escalation: If not resolved in 15 minutes → P0 incident
```

### Alert: Error Rate > 2%

```
Trigger: 5xx error rate > 2% over 5 minutes

Investigation steps:
1. Open Sentry → Issues → sort by "Last Seen" → look for new issues in last 10 min
2. Look at the error message and stack trace — is this a single issue type?
3. Check recent deployments — was anything deployed in the last hour?
   git log --oneline -10
4. If it's a single error type:
   - Fix the bug → deploy hotfix using hotfix branch process
5. If it's widespread (many error types):
   - Roll back the last deployment immediately
   - Investigate root cause after rollback

Escalation: If error rate > 10% → P0 incident → immediate rollback
```

### Alert: BullMQ Failed Jobs > 50

```
Trigger: Any queue's failed job count exceeds 50

Investigation steps:
1. Open Bull Board (https://api.vividcrm.in/admin/queues)
2. Click the queue with high failed count
3. Open a failed job → read the error and stack trace
4. Common issues:
   - email-notifications: Brevo API key expired or rate limited
     Fix: check Brevo dashboard; rotate key if needed
   - pdf-generation: Chromium OOM (out of memory)
     Fix: reduce PDF_CONCURRENCY env var; restart pod
   - payroll-compute: DB deadlock or constraint error
     Fix: read error; usually a data issue for specific employee
   - attendance-compute: cron triggered for invalid date
     Fix: check cron expression; manually trigger for missed date
5. After root cause fixed: retry failed jobs via Bull Board UI
6. If jobs cannot be retried: manual intervention required per job type
```

### Alert: p95 Latency > 500ms

```
Trigger: 95th percentile API response time > 500ms for > 5 minutes

Investigation steps:
1. Sentry Performance → check slowest transactions in last 1 hour
2. Identify which endpoints are slow (sort by p95 descending)
3. Check Supabase → Logs → Slow Queries (queries > 500ms)
4. If slow query found:
   - Is there a missing index? Check EXPLAIN ANALYZE
   - Is the query hitting a large table without workspaceId filter?
   - Is PgBouncer pool exhausted? (connection wait time increases p95)
5. Temporary mitigation: increase Redis cache TTL for affected data
6. Permanent fix: add index or optimise query in next sprint

Do NOT restart the pod — that masks the problem without fixing it.
```

### Alert: SSL Certificate Expiring

```
Trigger: SSL certificate expiry < 30 days

For Cloudflare-managed certs:
1. This should auto-renew — verify Cloudflare SSL settings
2. If Cloudflare shows renewal pending: wait 24h; check again
3. If still not renewed: open Cloudflare support ticket

For custom certificates:
1. Generate new certificate (Let's Encrypt via certbot)
2. Upload to Cloudflare
3. Update expiry date in uptime monitor
```

---

## Dashboard Design (Recommended)

### Operational Dashboard (Grafana or Datadog — Phase 2)

```
Row 1: System Health
┌────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ API Uptime      │ Error Rate (5m)  │ p95 Latency     │ Active WS Conns │
│ ████ 99.97%    │ ■ 0.08%          │ ■ 187ms         │ ■ 43            │
└────────────────┴─────────────────┴─────────────────┴─────────────────┘

Row 2: Request Volume (time series, 24h)
┌──────────────────────────────────────────────────────────────────────┐
│ Requests/min ─── Error rate ─── p50 ─── p95                         │
│ Chart...                                                             │
└──────────────────────────────────────────────────────────────────────┘

Row 3: Queue Health
┌─────────────────────┬───────────────────────┬──────────────────────┐
│ email-notifications  │ pdf-generation         │ payroll-compute      │
│ Waiting: 2           │ Waiting: 0             │ Waiting: 0           │
│ Active: 1            │ Active: 1              │ Active: 0            │
│ Failed: 0            │ Failed: 0              │ Failed: 0            │
└─────────────────────┴───────────────────────┴──────────────────────┘

Row 4: Database
┌──────────────────────────────────────────────────────────────────────┐
│ PgBouncer pool: 7/10 connections used                               │
│ Slow queries (>500ms): 0 in last hour                               │
│ Query latency histogram: p50=8ms, p95=24ms, p99=89ms               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Synthetic Monitoring (Playwright in CI)

Run golden-path tests on staging every 30 minutes to verify critical flows work end-to-end:

```ts
// .github/workflows/synthetic-monitor.yml
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes

jobs:
  synthetic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx playwright test tests/synthetic/
        env:
          BASE_URL: https://staging.vividcrm.in
          TEST_USER_EMAIL: ${{ secrets.SYNTHETIC_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.SYNTHETIC_USER_PASSWORD }}
```

```ts
// tests/synthetic/golden-paths.spec.ts
test('login → dashboard loads', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', process.env.TEST_USER_EMAIL)
  await page.fill('[name=password]', process.env.TEST_USER_PASSWORD)
  await page.click('[type=submit]')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('h1')).toBeVisible()
})

test('create lead', async ({ page }) => {
  // ... authenticated state via storageState
  await page.goto('/leads/new')
  await page.fill('[name=title]', `Synthetic Test Lead ${Date.now()}`)
  await page.fill('[name=firstName]', 'Test')
  await page.click('[type=submit]')
  await expect(page.locator('[data-testid=lead-detail]')).toBeVisible()
})
```

If any synthetic test fails → immediate Slack alert.

---

## Log Aggregation — Axiom

```ts
// Axiom ships logs from NestJS to cloud log storage
// Install: pnpm add @axiomhq/winston

import { createLogger, transports } from 'winston'
import { WinstonTransport as AxiomTransport } from '@axiomhq/winston'

const logger = createLogger({
  transports: [
    new AxiomTransport({
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
    }),
    // Also log to stdout for Railway/Vercel log collection
    new transports.Console({
      format: process.env.LOG_FORMAT === 'json'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
  ],
})
```

### Log Search Queries (Axiom APL)

```apl
# Find all errors in the last hour for a workspace
['vividcrm-prod']
| where level == "error"
| where workspaceId == "ws_abc123"
| where _time >= ago(1h)
| sort by _time desc

# Find slow requests (> 500ms)
['vividcrm-prod']
| where duration > 500
| where _time >= ago(24h)
| summarize count() by url
| sort by count_ desc

# Find all payroll-related events
['vividcrm-prod']
| where message contains "payroll" or message contains "PayrollRun"
| where _time >= ago(7d)
| sort by _time desc

# Audit: all sensitive exports in last 30 days
['vividcrm-prod']
| where message contains "SENSITIVE_EXPORT"
| project _time, userId, workspaceId, meta
| where _time >= ago(30d)
```
