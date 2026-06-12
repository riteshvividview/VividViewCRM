# Deployment — VividCRM Infrastructure

## Deployment Overview

| Environment | Frontend | Backend | Trigger |
|---|---|---|---|
| **Development** | `next dev` (localhost:3000) | `ts-node-dev` (localhost:3001) | Manual |
| **Staging** | Vercel Preview (auto on PR) | Railway (auto on `staging` branch) | Push to `staging` |
| **Production** | Vercel Production | Railway Production | Tag `v*` or merge to `main` |

---

## Local Development Setup

### Prerequisites

```bash
node >= 20.0.0
docker >= 24.0.0
docker-compose >= 2.0.0
pnpm >= 9.0.0        # preferred package manager
```

### Repository Structure

```
vividcrm/
├── apps/
│   ├── web/              ← Next.js 15 frontend
│   └── api/              ← NestJS backend
├── packages/
│   └── shared/           ← Shared TypeScript types (DTOs, enums)
├── docker-compose.yml    ← Local infrastructure
├── docker-compose.override.yml  ← Dev overrides (hot reload)
├── .env.example
└── turbo.json            ← Turborepo build pipeline
```

### `docker-compose.yml` — Local Infrastructure

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: vividcrm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: vividcrm
      POSTGRES_PASSWORD: vividcrm_dev
      POSTGRES_DB: vividcrm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/db-init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vividcrm"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: vividcrm_redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass vividcrm_redis_dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "vividcrm_redis_dev", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    container_name: vividcrm_mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_MAX_MESSAGES: 100
      MP_SMTP_AUTH_ACCEPT_ANY: true

  bull-board:
    image: deadly0/bull-board:latest
    container_name: vividcrm_bullboard
    restart: unless-stopped
    ports:
      - "3002:3000"
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: vividcrm_redis_dev
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

### `scripts/db-init.sql` — PostgreSQL Extensions

```sql
-- Run once on fresh database
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Application user with restricted permissions
CREATE USER vividcrm_app WITH PASSWORD 'app_password_dev';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vividcrm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vividcrm_app;

-- Audit log append-only protection
REVOKE UPDATE, DELETE ON audit_logs FROM vividcrm_app;
```

### Developer Quickstart

```bash
# 1. Clone repo
git clone https://github.com/dattu145/VividViewCRM
cd VividViewCRM

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# 4. Start infrastructure (postgres, redis, mailpit)
docker-compose up -d

# 5. Wait for postgres to be healthy, then run migrations + seed
cd apps/api
pnpm prisma migrate dev
pnpm prisma db seed

# 6. Start backend
cd apps/api
pnpm dev                    # ts-node-dev with hot reload, port 3001

# 7. Start frontend (new terminal)
cd apps/web
pnpm dev                    # next dev with HMR, port 3000
```

**Local service URLs:**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/api/docs`
- Bull Board: `http://localhost:3002`
- Mailpit (email preview): `http://localhost:8025`
- PostgreSQL: `localhost:5432 (vividcrm / vividcrm_dev)`

---

## Docker Images

### NestJS — `apps/api/Dockerfile`

```dockerfile
# ───── Stage 1: Builder ─────────────────────────────────────
FROM node:20-alpine AS builder

# Install build dependencies for native modules (bcrypt, sharp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install ALL deps (including devDeps for build)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ───── Stage 2: Runner ─────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy production artifacts
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs

EXPOSE 3001

# dumb-init: proper PID 1, handles signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### Next.js — `apps/web/Dockerfile`

```dockerfile
# ───── Stage 1: Dependencies ────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# ───── Stage 2: Builder ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ───── Stage 3: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (next.config.ts: output: 'standalone')
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

---

## CI/CD Pipeline — GitHub Actions

### Branch Strategy

```
main          ← production-ready code; deploys to PRODUCTION on merge
staging       ← pre-release integration; deploys to STAGING automatically
feature/*     ← feature branches; PR to staging → runs CI only
hotfix/*      ← emergency fixes; PR directly to main
```

### Workflow Files

#### `.github/workflows/ci.yml` — Runs on every PR

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test_secret_at_least_32_chars_long
      JWT_REFRESH_SECRET: test_refresh_at_least_32_chars_long
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - working-directory: apps/api
        run: |
          pnpm prisma migrate deploy
          pnpm test:integration --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: apps/api/coverage/lcov.info

  test-e2e:
    runs-on: ubuntu-latest
    needs: [lint-and-type-check, test-backend]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium
      - run: docker-compose up -d
      - run: sleep 15  # wait for services
      - working-directory: apps/api
        run: pnpm prisma migrate deploy && pnpm prisma db seed
      - run: pnpm dev &
      - run: sleep 10
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

#### `.github/workflows/deploy-staging.yml` — Auto-deploy on push to `staging`

```yaml
name: Deploy Staging

on:
  push:
    branches: [staging]

jobs:
  deploy-api-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      # Run migrations against staging DB before deploying new code
      - name: Run DB migrations
        working-directory: apps/api
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_DIRECT_URL }}
        run: pnpm prisma migrate deploy

      # Deploy to Railway (staging service)
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: vividcrm-api-staging

  # Vercel Preview deploys automatically on PR — no action needed
  # Staging Vercel deploy triggered by Vercel GitHub integration on staging branch
```

#### `.github/workflows/deploy-production.yml` — Deploy on tag `v*`

```yaml
name: Deploy Production

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  verify-tag-on-main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Verify tag is on main branch
        run: |
          MAIN_SHA=$(git rev-parse origin/main)
          TAG_SHA=$(git rev-parse HEAD)
          if [ "$MAIN_SHA" != "$TAG_SHA" ]; then
            echo "Tag must be on main branch" && exit 1
          fi

  deploy-api-production:
    runs-on: ubuntu-latest
    needs: verify-tag-on-main
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      # Run DB migrations FIRST — before new code is live
      # Zero-downtime: new migrations must be backwards-compatible with old code
      - name: Run production DB migrations
        working-directory: apps/api
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_DIRECT_URL }}
        run: pnpm prisma migrate deploy

      # Deploy backend
      - name: Deploy API to Railway Production
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: vividcrm-api-production

      # Vercel production deploy triggered by tag via Vercel GitHub integration

      # Notify deployment
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "VividCRM ${{ github.ref_name }} deployed to production"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_DEPLOY_WEBHOOK }}
```

---

## Database Migration Strategy

### Zero-Downtime Migration Rules

All database migrations must be **backwards-compatible with the currently running application code**. This is because migrations run before the new code is deployed.

**Safe operations (no downtime risk):**
- Adding a new nullable column
- Adding a new table
- Adding an index (`CREATE INDEX CONCURRENTLY`)
- Adding a foreign key with `NOT VALID` (validate later)

**Unsafe operations (require multi-step migration):**

| Unsafe Operation | Safe Alternative |
|---|---|
| Adding a NOT NULL column | Add nullable → backfill data → add NOT NULL constraint |
| Renaming a column | Add new column → dual-write → migrate reads → drop old column |
| Dropping a column | Remove code references first → deploy → then drop column |
| Changing column type | Add new column with new type → migrate → swap |
| Adding a UNIQUE constraint | Add as NOT VALID → validate when no old writes possible |

### Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql

Examples:
20250601090000_add_workspace_feature_flags.sql
20250615120000_add_invoice_dispute_fields.sql
20250701080000_add_employee_probation_status.sql
```

### Migration Runbook (Production)

```bash
# 1. Take a manual DB snapshot before migrating
# (In addition to Supabase PITR — belt-and-suspenders)

# 2. Run migration in dry-run mode first (check SQL)
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 3. Apply migration
DATABASE_URL=$PROD_DIRECT_URL npx prisma migrate deploy

# 4. Verify migration ran
DATABASE_URL=$PROD_DIRECT_URL npx prisma migrate status

# 5. Deploy new code (Railway redeploy or tag)
```

---

## Deployment Targets

### Railway — NestJS Backend

Railway is used for hosting the NestJS API because it supports Docker deployments, environment variables, persistent services (unlike Vercel), and has good Node.js support.

**`railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/api/Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/main.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Railway service configuration:**

| Setting | Staging | Production |
|---|---|---|
| RAM | 512MB | 1GB |
| vCPU | 0.5 | 1 |
| Replicas | 1 | 1 (scale to 2 as needed) |
| Health check | `/health` | `/health` |
| Auto-deploy | On `staging` branch push | On tag `v*` |
| Sleep | After 10 min (free) | Never (Pro) |

---

### Vercel — Next.js Frontend

**`vercel.json`:**
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "regions": ["bom1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.vividcrm.app/:path*"
    }
  ]
}
```

> **API proxy via Vercel rewrites:** The frontend proxies `/api/*` requests through Vercel to the NestJS backend. This means the browser only talks to the Vercel domain — no CORS issues, no exposing the backend URL directly.

---

## Release Process

### Version Numbering

`MAJOR.MINOR.PATCH` — semantic versioning.

| Change | Version bump |
|---|---|
| Breaking API change | MAJOR (e.g., 1.0.0 → 2.0.0) |
| New feature, backwards-compatible | MINOR (e.g., 1.1.0 → 1.2.0) |
| Bug fix | PATCH (e.g., 1.1.1 → 1.1.2) |
| Hotfix to production | PATCH on hotfix branch, merge to main |

### Release Steps

```bash
# 1. Merge all staging PRs into staging branch; verify staging tests pass

# 2. Merge staging into main
git checkout main
git merge staging --no-ff -m "chore: merge staging into main for v1.2.0"

# 3. Run smoke tests on production-like staging

# 4. Tag the release
git tag -a v1.2.0 -m "Release v1.2.0: Add sprint management and time tracking"
git push origin main --tags

# 5. GitHub Actions deploy workflow triggers automatically on tag push

# 6. Verify production health check passes within 5 minutes
curl https://api.vividcrm.app/health

# 7. Post release notes to Slack #deployments channel
```

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/fix-payroll-decimal main

# 2. Make fix + tests
# 3. Bump patch version

# 4. Merge directly to main (bypasses staging for critical fixes)
git checkout main
git merge hotfix/fix-payroll-decimal --no-ff
git tag -a v1.1.1 -m "Hotfix: fix payroll decimal rounding"
git push origin main --tags

# 5. Also merge back to staging to keep branches in sync
git checkout staging
git merge main
git push origin staging
```

---

## PM2 Process Management (VPS / Railway fallback)

If self-hosting on a VPS instead of Railway, use PM2:

**`ecosystem.config.js`:**
```js
module.exports = {
  apps: [
    {
      name: 'vividcrm-api',
      script: 'dist/main.js',
      instances: 'max',          // use all CPU cores
      exec_mode: 'cluster',
      max_memory_restart: '900M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/vividcrm/error.log',
      out_file: '/var/log/vividcrm/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
```

```bash
# Start
pm2 start ecosystem.config.js --env production

# Zero-downtime reload (used after deploy)
pm2 reload vividcrm-api

# Monitor
pm2 monit
```

---

## Rollback Procedure

### Application Rollback

```bash
# Railway: roll back to previous deployment via Railway dashboard
# or via CLI:
railway rollback --service vividcrm-api-production

# Vercel: roll back to previous deployment via Vercel dashboard
vercel rollback [deployment-url]
```

### Database Rollback

**Prisma does not support automatic rollback** — migrations are forward-only. To reverse a migration:

1. Write a new "revert" migration that undoes the change
2. Deploy the revert migration before the code that depends on the reverted schema
3. Use Supabase PITR as a last resort (restores entire database to a point in time — destructive)

**Prevention:** Never make destructive schema changes without a backwards-compatible intermediate step (see Migration Strategy above).

---

## Deployment Checklist

Run before every production deployment:

```
Pre-deployment:
  [ ] All CI checks pass on main branch
  [ ] Staging tested with production-like data
  [ ] DB migrations verified on staging
  [ ] Environment variables updated in Railway/Vercel if changed
  [ ] Supabase DB snapshot taken (manual)
  [ ] Team notified in Slack (#deployments)

During deployment:
  [ ] Monitor Railway deployment logs
  [ ] Watch Sentry for new error spikes
  [ ] Check /health endpoint every 30 seconds until 200

Post-deployment (within 15 minutes):
  [ ] Login flow works end-to-end
  [ ] Critical smoke tests pass (create lead, clock in, view payslip)
  [ ] BullMQ queues processing normally (Bull Board check)
  [ ] No new critical/error Sentry alerts
  [ ] Response times within SLO (< 300ms p95)

Rollback trigger conditions:
  [ ] Error rate > 5% (vs baseline < 0.5%)
  [ ] p95 latency > 2000ms sustained for > 5 minutes
  [ ] Health check returning non-200 for > 2 minutes
  [ ] Critical business flow broken (auth, payslip, invoice)
```
