# Environment Configuration — VividCRM Infrastructure

## Environment Management Principles

1. **Never commit secrets** — `.env` files are in `.gitignore`; secrets live in CI/CD secrets and provider vaults
2. **Validate at startup** — application refuses to start if required variables are missing or malformed
3. **One `.env.example` per service** — shows every variable with a safe placeholder value; used by new developers and CI
4. **Environment-specific files** — `.env.development`, `.env.staging`, `.env.production` are never committed; only `.env.example` is
5. **Rotate, don't reuse** — every environment has unique secrets; staging secrets are never production secrets

---

## Environment Files Structure

```
apps/api/
├── .env                    ← local development (gitignored)
├── .env.example            ← committed; template for all vars
├── .env.test               ← CI/CD test environment (gitignored; injected by GitHub Actions)
└── src/config/
    └── config.validation.ts ← Joi/Zod schema that validates env at startup

apps/web/
├── .env.local              ← local development (gitignored)
├── .env.example            ← committed template
└── .env.production         ← Vercel injects from dashboard (not committed)
```

---

## NestJS Backend — Complete Environment Variable Reference

### `apps/api/.env.example`

```env
# ═══════════════════════════════════════════════════════════════
# APPLICATION
# ═══════════════════════════════════════════════════════════════

# Runtime environment
NODE_ENV=development
# development | staging | production

# API server port
PORT=3001

# API version prefix (do not change)
API_PREFIX=api/v1

# Allowed frontend origin for CORS
FRONTEND_URL=http://localhost:3000
# Production example: https://app.vividcrm.in

# Internal API secret for inter-service calls (e.g., webhook verification)
INTERNAL_API_SECRET=generate-32-char-random-hex-here

# ═══════════════════════════════════════════════════════════════
# DATABASE — POSTGRESQL (SUPABASE)
# ═══════════════════════════════════════════════════════════════

# Connection through Supabase PgBouncer (for runtime queries)
# Port 6543 with ?pgbouncer=true — required for Prisma with PgBouncer
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Direct connection (for Prisma migrations only — bypasses pooler)
DATABASE_DIRECT_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Connection pool settings (applied via DATABASE_URL query params)
# connection_limit: max connections per Prisma instance
# pool_timeout: seconds to wait for connection before error
# Max recommended for PgBouncer: 1 per serverless instance; 10 for persistent server

# ═══════════════════════════════════════════════════════════════
# REDIS
# ═══════════════════════════════════════════════════════════════

# Full Redis connection URL (includes auth password)
REDIS_URL=redis://:vividcrm_redis_dev@localhost:6379
# Production (Upstash): rediss://default:[password]@[endpoint]:6380
# Production (Railway): redis://default:[password]@[host]:[port]

# Key prefix for all Redis keys (namespaces per environment)
REDIS_KEY_PREFIX=dev
# development | staging | production

# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION — JWT
# ═══════════════════════════════════════════════════════════════

# Access token signing secret (HS256 — min 32 characters)
JWT_ACCESS_SECRET=REPLACE_WITH_64_CHAR_RANDOM_HEX_DO_NOT_USE_THIS_VALUE_IN_PROD

# Refresh token signing secret (different from access secret)
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_64_CHAR_RANDOM_HEX_NOT_SAME_AS_ACCESS

# Access token TTL in seconds (900 = 15 minutes)
JWT_ACCESS_EXPIRES_IN=900

# Refresh token TTL in seconds (604800 = 7 days)
JWT_REFRESH_EXPIRES_IN=604800

# Cookie name for refresh token
REFRESH_COOKIE_NAME=vcrm_rt
# Use a non-obvious name to slightly obscure token purpose

# ═══════════════════════════════════════════════════════════════
# FILE STORAGE — CLOUDFLARE R2
# ═══════════════════════════════════════════════════════════════

# Cloudflare account ID (from R2 dashboard)
R2_ACCOUNT_ID=your_cloudflare_account_id

# R2 access key (created in Cloudflare dashboard → R2 → Manage API Tokens)
R2_ACCESS_KEY_ID=your_r2_access_key_id

# R2 secret key
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key

# R2 bucket name (one per environment — never share across envs)
R2_BUCKET_NAME=vividcrm-dev

# Public CDN URL in front of R2 (Cloudflare CDN domain)
# For private objects: leave blank (use signed URLs instead)
R2_PUBLIC_URL=https://cdn-dev.vividcrm.in

# R2 endpoint (account-specific S3-compatible URL)
R2_ENDPOINT=https://[account_id].r2.cloudflarestorage.com

# Signed URL expiry in seconds
R2_SIGNED_URL_EXPIRY=300
# 300 seconds (5 min) for payslips; 3600 (1 hour) for general documents

# ═══════════════════════════════════════════════════════════════
# EMAIL — BREVO (SENDINBLUE)
# ═══════════════════════════════════════════════════════════════

# Brevo API key (from Brevo dashboard → Settings → API Keys)
BREVO_API_KEY=xkeysib-REPLACE_WITH_ACTUAL_KEY

# Sender details (must be verified in Brevo)
BREVO_FROM_EMAIL=noreply@vividcrm.in
BREVO_FROM_NAME=VividCRM

# Brevo template IDs (create templates in Brevo dashboard)
BREVO_TEMPLATE_WELCOME=1
BREVO_TEMPLATE_RESET_PASSWORD=2
BREVO_TEMPLATE_LEAVE_APPROVED=3
BREVO_TEMPLATE_LEAVE_REJECTED=4
BREVO_TEMPLATE_PAYSLIP_READY=5
BREVO_TEMPLATE_INVOICE_SENT=6
BREVO_TEMPLATE_TASK_ASSIGNED=7
BREVO_TEMPLATE_APPROVAL_REQUIRED=8
BREVO_TEMPLATE_OVERDUE_INVOICE=9
BREVO_TEMPLATE_PAYROLL_APPROVED=10

# In development: use Mailpit (local SMTP) instead of Brevo
# Set BREVO_API_KEY=mailpit and configure SMTP_HOST/PORT
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USE_BREVO_API=false
# Set to true in staging/production to use Brevo API (not SMTP)

# ═══════════════════════════════════════════════════════════════
# PDF GENERATION — CHROMIUM (FOR INVOICES AND PAYSLIPS)
# ═══════════════════════════════════════════════════════════════

# Path to Chromium binary (auto-detected in most environments)
# Override if using @sparticuz/chromium in Lambda/serverless
CHROMIUM_PATH=
# Leave empty for local dev (uses system Chrome) or Railway (Docker has Chrome)
# Set to /tmp/chromium for Lambda environments using @sparticuz/chromium

# Max concurrent PDF generation jobs (prevents OOM)
PDF_CONCURRENCY=3

# ═══════════════════════════════════════════════════════════════
# BULLMQ — JOB QUEUES
# ═══════════════════════════════════════════════════════════════

# BullMQ uses REDIS_URL above — no separate config needed
# These control queue behavior:

# Max retries for failed jobs (all queues)
QUEUE_MAX_ATTEMPTS=3

# Backoff delay in milliseconds (exponential: 1st=5000, 2nd=25000, 3rd=125000)
QUEUE_BACKOFF_DELAY=5000

# Bull Board UI basic auth (admin dashboard for queue monitoring)
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# ═══════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════

# Requests per minute per user (authenticated endpoints)
RATE_LIMIT_PER_MINUTE=100

# Requests per minute per IP (public endpoints: login, forgot-password)
RATE_LIMIT_PUBLIC_PER_MINUTE=20

# Sensitive export limit (per user per hour)
RATE_LIMIT_EXPORT_PER_HOUR=5

# ═══════════════════════════════════════════════════════════════
# CRON SCHEDULES (CRON EXPRESSIONS IN WORKSPACE TIMEZONE)
# ═══════════════════════════════════════════════════════════════

# End-of-day attendance computation (11:30 PM daily)
CRON_ATTENDANCE_COMPUTE=30 23 * * *

# Overdue invoice check (9:00 AM daily)
CRON_INVOICE_OVERDUE=0 9 * * *

# Leave expiry check (every hour)
CRON_LEAVE_EXPIRY=0 * * * *

# Recurring task generation (every minute — checks nextGenerateAt)
CRON_RECURRING_TASKS=* * * * *

# Notification cleanup (2:00 AM daily — delete 90+ day old notifications)
CRON_NOTIFICATION_CLEANUP=0 2 * * *

# Probation review alert (9:00 AM daily — 14 days before probation end)
CRON_PROBATION_ALERT=0 9 * * *

# ═══════════════════════════════════════════════════════════════
# ERROR TRACKING — SENTRY
# ═══════════════════════════════════════════════════════════════

# Sentry DSN for NestJS backend (from Sentry project settings)
SENTRY_DSN=https://[key]@o[org].ingest.sentry.io/[project]
# Leave empty in development to disable Sentry

# Sentry environment tag
SENTRY_ENVIRONMENT=development
# development | staging | production

# Sentry release version (auto-set from git tag in CI/CD)
SENTRY_RELEASE=local

# Sample rate for Sentry performance monitoring (0.0–1.0)
SENTRY_TRACES_SAMPLE_RATE=0.1
# 10% of requests traced in production; 100% in dev/staging

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

# Log level (verbose > debug > log > warn > error)
LOG_LEVEL=debug
# Production: log | Staging: debug | Development: verbose

# Log format (json for production log aggregation; pretty for dev)
LOG_FORMAT=pretty
# pretty | json

# Log HTTP request details
LOG_HTTP_REQUESTS=true

# ═══════════════════════════════════════════════════════════════
# MONITORING
# ═══════════════════════════════════════════════════════════════

# Axiom (log aggregation) — optional
AXIOM_TOKEN=
AXIOM_ORG_ID=
AXIOM_DATASET=vividcrm-dev

# Slack webhook for deployment and alert notifications
SLACK_DEPLOY_WEBHOOK=
SLACK_ALERT_WEBHOOK=
```

---

## Next.js Frontend — Environment Variables

### `apps/web/.env.example`

```env
# ═══════════════════════════════════════════════════════════════
# PUBLIC (exposed to browser — prefix NEXT_PUBLIC_)
# ═══════════════════════════════════════════════════════════════

# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:3001
# Staging: https://api-staging.vividcrm.in
# Production: https://api.vividcrm.in
# Note: in production with Vercel rewrites, this can be the same domain

# WebSocket URL for Socket.IO
NEXT_PUBLIC_WS_URL=http://localhost:3001
# Must be the direct NestJS URL (not proxied — WebSocket upgrades need direct connection)

# Application base URL (used for absolute links in emails, og:url)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production: https://app.vividcrm.in

# Sentry DSN for frontend error tracking
NEXT_PUBLIC_SENTRY_DSN=https://[key]@o[org].ingest.sentry.io/[project-frontend]

# Environment identifier
NEXT_PUBLIC_ENV=development
# development | staging | production

# Enable React Query Devtools (set false in production)
NEXT_PUBLIC_QUERY_DEVTOOLS=true

# ═══════════════════════════════════════════════════════════════
# SERVER-SIDE ONLY (not exposed to browser — no NEXT_PUBLIC_ prefix)
# ═══════════════════════════════════════════════════════════════

# Used by Next.js middleware for internal API calls (SSR routes)
API_INTERNAL_URL=http://localhost:3001

# Secret for Next.js middleware to verify internal requests
MIDDLEWARE_SECRET=REPLACE_WITH_RANDOM_SECRET
```

---

## Per-Environment Configuration Summary

### Development

```env
# Key differences from example:
NODE_ENV=development
DATABASE_URL=postgresql://vividcrm:vividcrm_dev@localhost:5432/vividcrm_dev
REDIS_URL=redis://:vividcrm_redis_dev@localhost:6379
SMTP_USE_BREVO_API=false          # use Mailpit local SMTP
SENTRY_DSN=                       # disabled — don't send dev errors to Sentry
LOG_LEVEL=verbose
LOG_FORMAT=pretty
CHROMIUM_PATH=                    # system Chrome auto-detected
R2_BUCKET_NAME=vividcrm-dev       # isolated bucket
```

### Staging

```env
NODE_ENV=staging
DATABASE_URL=postgresql://postgres.[staging-project]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DATABASE_DIRECT_URL=postgresql://postgres:[password]@db.[staging-project].supabase.co:5432/postgres
REDIS_URL=rediss://default:[password]@[upstash-endpoint]:6380
SMTP_USE_BREVO_API=true
BREVO_API_KEY=[staging-api-key]   # separate Brevo account or restricted key
SENTRY_DSN=[staging-dsn]
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=1.0    # 100% tracing in staging
LOG_LEVEL=debug
LOG_FORMAT=json
R2_BUCKET_NAME=vividcrm-staging   # separate bucket from production
FRONTEND_URL=https://staging.vividcrm.in
```

### Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.[prod-project]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DATABASE_DIRECT_URL=postgresql://postgres:[password]@db.[prod-project].supabase.co:5432/postgres
REDIS_URL=rediss://default:[password]@[upstash-prod-endpoint]:6380
SMTP_USE_BREVO_API=true
BREVO_API_KEY=[production-api-key]
SENTRY_DSN=[production-dsn]
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% sampling in production
LOG_LEVEL=log
LOG_FORMAT=json
R2_BUCKET_NAME=vividcrm-production
FRONTEND_URL=https://app.vividcrm.in
RATE_LIMIT_PER_MINUTE=100
PDF_CONCURRENCY=3
```

---

## Secret Management

### Where Secrets Live

| Secret Type | Location | Access |
|---|---|---|
| JWT secrets | Railway env vars | Deploy-time only |
| Database passwords | Railway env vars | Deploy-time only |
| Brevo API key | Railway env vars | Deploy-time only |
| R2 credentials | Railway env vars | Deploy-time only |
| CI/CD secrets | GitHub repository secrets | Actions only |
| Sentry DSN | Railway env vars (BE) + Vercel env vars (FE) | Deploy-time only |

### GitHub Repository Secrets

```
RAILWAY_TOKEN               ← Railway deploy token (per project)
STAGING_DATABASE_DIRECT_URL ← Used by migrations CI job
PROD_DATABASE_DIRECT_URL    ← Used by production migration CI job
SLACK_DEPLOY_WEBHOOK        ← Deployment notifications
SLACK_ALERT_WEBHOOK         ← Error alerts
```

### Secret Rotation Schedule

| Secret | Rotation Frequency | Procedure |
|---|---|---|
| JWT_ACCESS_SECRET | Every 90 days | Update Railway env → redeploy (all existing tokens invalidated) |
| JWT_REFRESH_SECRET | Every 90 days | Same as above — forces all users to re-login |
| DATABASE passwords | Every 180 days | Supabase password reset → update Railway env → redeploy |
| BREVO_API_KEY | On personnel change | Generate new key in Brevo → update → delete old |
| R2 credentials | On personnel change | Generate new API token → update → revoke old |
| REDIS passwords | Every 180 days | Upstash password reset → update Redis URL in Railway → redeploy |
| INTERNAL_API_SECRET | Every 90 days | Update both services simultaneously |

---

## Environment Variable Validation (NestJS)

### `src/config/config.validation.ts`

```ts
import * as Joi from 'joi'

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  FRONTEND_URL: Joi.string().uri().required(),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_DIRECT_URL: Joi.string().optional(),

  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_KEY_PREFIX: Joi.string().default('dev'),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required()
    .custom((value, helpers) => {
      if (value === helpers.state.ancestors[0].JWT_ACCESS_SECRET) {
        return helpers.error('JWT secrets must be different from each other')
      }
      return value
    }),
  JWT_ACCESS_EXPIRES_IN: Joi.number().default(900),
  JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),

  // Storage
  R2_ACCOUNT_ID: Joi.string().required(),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_BUCKET_NAME: Joi.string().required(),
  R2_ENDPOINT: Joi.string().uri().required(),

  // Email
  BREVO_API_KEY: Joi.string().required(),
  BREVO_FROM_EMAIL: Joi.string().email().required(),

  // Sentry (optional in development)
  SENTRY_DSN: Joi.string().uri().optional().allow(''),
  SENTRY_ENVIRONMENT: Joi.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0.1),

  // Logging
  LOG_LEVEL: Joi.string().valid('verbose', 'debug', 'log', 'warn', 'error').default('log'),
  LOG_FORMAT: Joi.string().valid('pretty', 'json').default('json'),
})

// In app.module.ts:
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema,
  validationOptions: {
    allowUnknown: false,    // fail on unrecognised variables
    abortEarly: false,      // report ALL validation errors, not just first
  },
})
```

---

## Multi-Environment Feature Flags

Feature flags stored in workspace settings table (not environment variables) for runtime toggling. However, some infrastructure-level flags are env-var controlled:

```env
# Enable/disable features at the infrastructure level
# (workspace-level flags are in the database)

# Allow workspace self-signup (true = public SaaS; false = invite-only)
FEATURE_PUBLIC_SIGNUP=false

# Enable Swagger UI (disable in production for security)
FEATURE_SWAGGER=true       # true in dev/staging; false in production

# Enable Bull Board UI
FEATURE_BULL_BOARD=true    # true in dev/staging; restricted in production

# Enable detailed error messages in API responses
FEATURE_DETAILED_ERRORS=true  # true in dev; false in production (use Sentry)

# Maximum file upload size in bytes
MAX_FILE_SIZE=10485760     # 10MB (10 × 1024 × 1024)

# Enable database query logging
DATABASE_QUERY_LOG=false   # true in development for N+1 detection
```
