# Security — VividCRM Infrastructure

## Security Philosophy

Security is layered — no single control is relied upon as the only line of defence. VividCRM implements **defence in depth**: network controls, application-level guards, database-level row access policies, input validation, output sanitisation, and audit logging all work together. A failure in one layer does not expose data.

---

## Threat Model

### Assets Being Protected

| Asset | Sensitivity | Threat |
|---|---|---|
| Payroll data (salaries, bank accounts) | Critical | Insider access, data breach |
| Employee personal data (PAN, Aadhaar, address) | Critical | Regulatory (IT Act, PDPB) |
| Invoice and revenue data | High | Competitor espionage, financial fraud |
| CRM pipeline (leads, deals) | High | Competitor intelligence |
| Authentication tokens | High | Account takeover |
| API keys and secrets | Critical | System compromise |

### Primary Threats

| Threat | Likelihood | Impact | Controls |
|---|---|---|---|
| Stolen JWT token (XSS or network) | Medium | High | HttpOnly cookies; CSP; short TTL |
| Brute-force credential attack | High | High | Rate limiting; account lockout |
| Cross-workspace data leak (multi-tenancy) | Low | Critical | Prisma middleware; automated isolation tests |
| SQL injection via user input | Low | Critical | Prisma parameterised queries; no raw SQL |
| Insider data exfiltration | Medium | High | Audit log; sensitive export rate limits |
| Supply chain attack (npm packages) | Low | High | `pnpm audit`; Dependabot; lockfile |
| API key leakage in codebase | Low | Critical | `.env.example` only; secrets in CI/CD |
| Compromised CI/CD pipeline | Low | Critical | Branch protection; required reviews; OIDC auth |

---

## Network Security

### Cloudflare Configuration

All traffic enters via Cloudflare. No service is reachable directly from the internet without going through Cloudflare first.

```
Internet → Cloudflare (DNS, SSL, WAF) → Vercel / Railway
```

**Cloudflare settings:**

| Setting | Value | Purpose |
|---|---|---|
| SSL/TLS mode | Full (strict) | Encrypt end-to-end including origin |
| Minimum TLS version | TLS 1.2 | Reject old TLS versions |
| HTTP → HTTPS redirect | Always On | No plaintext traffic |
| HSTS | Enabled (1 year, includeSubDomains) | Force HTTPS in browsers |
| WAF (Web Application Firewall) | Managed rules enabled | Block common attack patterns |
| Bot Fight Mode | On | Block malicious bots |
| DDoS protection | Auto (L3/L4/L7) | Absorb volumetric attacks |
| Rate limiting (IP-level) | 1000 req/min per IP | Supplement app-level limits |
| Geo-blocking | None (open — India-first) | Revisit if abuse patterns emerge |

**Cloudflare firewall rules:**
```
# Block requests to admin endpoints from non-whitelisted IPs
(http.request.uri.path contains "/admin/queues" 
 and not ip.src in {OFFICE_IP_RANGE}) → Block

# Challenge suspicious user agents
(cf.threat_score > 20) → JS Challenge

# Block countries with no expected users (optional future rule)
# (ip.geoip.country in {"RU" "CN" "KP"}) → Block
```

### Origin Protection

The Vercel and Railway origins are only reachable from Cloudflare (not directly):

```bash
# Vercel: use trusted proxies setting
# Railway: use Cloudflare Access (zero-trust) OR firewall rules in Railway

# Alternative: Cloudflare Tunnel (cloudflared) — most secure
# Tunnel creates outbound-only connection from Railway → Cloudflare
# No inbound port exposure at all
```

---

## Application Security

### HTTP Security Headers

Set on every response from NestJS:

```ts
// main.ts
import helmet from 'helmet'

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],     // Tailwind inline styles
        imgSrc: ["'self'", "data:", `https://${process.env.R2_PUBLIC_URL}`],
        connectSrc: ["'self'", `wss://${process.env.FRONTEND_URL}`],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
        frameAncestors: ["'none'"],                  // Prevents clickjacking
      },
    },
    crossOriginEmbedderPolicy: false,  // Required for PDF viewer
    hsts: {
      maxAge: 31536000,                // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy: true,               // Remove X-Powered-By: Express
  })
)
```

**Security header verification (automated in CI):**
```bash
curl -sI https://api.vividcrm.in | grep -E "(x-content-type|x-frame|strict-transport|content-security)"
```

### CORS Configuration

```ts
// main.ts
app.enableCors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      // Add staging URL if needed
    ]
    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,                // Required for HttpOnly cookies
  maxAge: 86400,                   // Preflight cache: 24 hours
})
```

### Request ID Tracing

```ts
// Every request gets a unique ID for tracing across logs and Sentry
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
})
```

---

## Authentication Security

### JWT Hardening

```ts
// Access token: short-lived, signed with HS256
const accessTokenPayload = {
  sub: user.id,
  workspaceId: user.workspaceId,
  role: user.role,
  tokenVersion: user.tokenVersion,   // Validated on every request
  sessionId: randomUUID(),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,  // 15 minutes
}

// Validation on every authenticated request:
// 1. Signature valid (HS256 with secret)
// 2. Not expired (exp > now)
// 3. tokenVersion matches current user.tokenVersion in DB
// 4. workspaceId matches requested resource's workspaceId
```

### Refresh Token Security

```ts
// Refresh tokens are:
// 1. Stored in Redis (server-side — revocable)
// 2. Sent via HttpOnly, Secure, SameSite=Strict cookie (not accessible to JS)
// 3. Rotated on every use (each use generates a new refresh token)
// 4. Replay detection: if a rotated (used) token is presented again → BREACH
//    Response: invalidate ALL tokens for the user; force re-login everywhere

// Redis key: `{prefix}:refresh:{userId}:{tokenId}`
// Value: JSON { token, createdAt, expiresAt, ipAddress, userAgent }
// TTL: JWT_REFRESH_EXPIRES_IN seconds

res.cookie(process.env.REFRESH_COOKIE_NAME, refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN) * 1000,
  path: '/api/v1/auth',  // Cookie only sent to auth endpoints
})
```

### Password Security

```ts
// Hashing: bcrypt with 12 rounds (balances security and CPU cost)
// At 12 rounds: ~250ms per hash — acceptable for login; strong against brute-force
const hash = await bcrypt.hash(password, 12)

// Password complexity requirements (validated at API layer):
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one digit
// Password complexity error messages are generic — never reveal which rule failed
// (prevents enumeration of password policy to craft targeted attacks)

// Password reset tokens:
// - Cryptographically random: crypto.randomBytes(32).toString('hex')
// - Stored in Redis with 30-minute TTL
// - Single-use: deleted on first successful use
// - Token is hashed before storing (SHA-256) so Redis breach doesn't expose tokens
```

### Account Lockout

```ts
// After 10 failed login attempts from the same IP in 15 minutes:
// - Return 429 Too Many Requests
// - Block IP in Redis for 15 minutes
// - Lock is IP-based (not account-based) to prevent user enumeration

// Failed attempts stored in Redis:
// Key: `ratelimit:login:{ip}`
// Value: count (incremented on each failure)
// TTL: 900 seconds (15 minutes, resets on expiry)

// Account lockout (separate from IP lockout):
// Not implemented — would allow DoS (attacker locks users out)
// Instead: after 5 failures on the same username, require CAPTCHA (Phase 2)
```

---

## Input Validation and Sanitisation

### Validation Pipeline

```ts
// Global validation pipe — all request bodies validated before reaching controllers
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip fields not in DTO — prevents mass assignment
    forbidNonWhitelisted: true,  // Reject requests with unknown fields (400 error)
    transform: true,             // Auto-cast strings to numbers, dates, etc.
    transformOptions: {
      enableImplicitConversion: false,  // Explicit types only — no surprises
    },
    disableErrorMessages: process.env.NODE_ENV === 'production',  // Hide schema details from attackers
  })
)
```

### File Upload Validation

```ts
// Multi-layer file validation:
// 1. File size limit (before reading content)
// 2. MIME type from HTTP Content-Type header (client-provided — not trusted alone)
// 3. Magic bytes check (read first 12 bytes, compare to known signatures)
// 4. Extension whitelist

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

async function validateFileUpload(buffer: Buffer, declaredMimeType: string): Promise<void> {
  // Check magic bytes using file-type library
  const { fileTypeFromBuffer } = await import('file-type')
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
    throw new BadRequestException('File type not permitted')
  }

  // Declared MIME must match detected MIME (prevent MIME confusion attacks)
  if (detected.mime !== declaredMimeType) {
    throw new BadRequestException('File content does not match declared type')
  }
}
```

### SQL Injection Prevention

Prisma uses parameterised queries exclusively. Raw SQL is prohibited in application code:

```ts
// ✅ Safe — Prisma parameterises all values
await prisma.lead.findMany({
  where: { workspaceId, status: userInput }
})

// ❌ Prohibited — raw SQL with interpolation
await prisma.$queryRaw`SELECT * FROM leads WHERE status = '${userInput}'`

// ✅ Safe if raw SQL needed — use Prisma.sql template tag
await prisma.$queryRaw(Prisma.sql`SELECT * FROM leads WHERE status = ${userInput}`)
```

ESLint rule enforces no `$queryRawUnsafe` in codebase:
```json
{ "no-restricted-globals": [{ "name": "$queryRawUnsafe", "message": "Use Prisma.sql template tag instead" }] }
```

### XSS Prevention

- All API responses are JSON — no HTML rendering in the backend
- Frontend (Next.js) uses React's JSX which escapes all values by default
- `dangerouslySetInnerHTML` is banned via ESLint rule
- User-provided content rendered as HTML (rich text comments) is sanitised with `sanitize-html`:

```ts
import sanitizeHtml from 'sanitize-html'

const sanitised = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'u', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
  allowedAttributes: { 'a': ['href'] },
  allowedSchemes: ['http', 'https'],  // Block javascript: URLs
  disallowedTagsMode: 'discard',
})
```

---

## Database Security

### Connection Security

```
Database connections encrypted in transit (TLS 1.2+ enforced by Supabase)
Credentials never exposed in application logs
Database URL in environment variables only — never in source code
Connection pooler (PgBouncer) limits max concurrent connections
```

### Row-Level Security — Audit Logs

```sql
-- The audit_logs table is append-only at the database level
-- The application DB user (vividcrm_app) cannot UPDATE or DELETE audit rows

REVOKE UPDATE ON audit_logs FROM vividcrm_app;
REVOKE DELETE ON audit_logs FROM vividcrm_app;

-- Verify:
SELECT has_table_privilege('vividcrm_app', 'audit_logs', 'UPDATE');  -- Must return 'f'
SELECT has_table_privilege('vividcrm_app', 'audit_logs', 'DELETE');  -- Must return 'f'
```

### Supabase Database User Privileges

```sql
-- Application user: SELECT, INSERT, UPDATE, DELETE on all tables except audit_logs
CREATE USER vividcrm_app WITH PASSWORD '...' CONNECTION LIMIT 20;
GRANT CONNECT ON DATABASE postgres TO vividcrm_app;
GRANT USAGE ON SCHEMA public TO vividcrm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vividcrm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vividcrm_app;
REVOKE UPDATE, DELETE ON audit_logs FROM vividcrm_app;

-- Migration user: full DDL access (used only for migrations, not runtime)
CREATE USER vividcrm_migrate WITH PASSWORD '...' CONNECTION LIMIT 3;
GRANT ALL PRIVILEGES ON DATABASE postgres TO vividcrm_migrate;

-- Two separate DATABASE_URL values:
-- DATABASE_URL: uses vividcrm_app (runtime)
-- DATABASE_DIRECT_URL: uses vividcrm_migrate (migrations only)
```

### Sensitive Data Encryption

Fields encrypted at the application layer before writing to database:

```ts
// Fields encrypted at rest: bankAccountNumber, aadhaar, pan (where legally required)
// Encryption: AES-256-GCM using a key derived from DATA_ENCRYPTION_KEY env var

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'hex')  // 32 bytes = 256 bits

function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

**Encrypted fields:** `employee.bankAccountNumber`, `employee.aadhaar`, `employee.pan`  
**Note:** These fields are stored as encrypted strings; Prisma treats them as `String?`. Decryption happens in the service layer, not in the response DTO.

---

## API Security

### Multi-Tenant Isolation

The most critical security control in a SaaS system:

```ts
// Prisma middleware: EVERY query on tenant-scoped models must include workspaceId
// This runs before the query reaches the database

prisma.$use(async (params, next) => {
  const tenantScopedModels = new Set([
    'Lead', 'Deal', 'Contact', 'Company', 'Campaign', 'Mailing',
    'Project', 'Task', 'Sprint', 'TimeEntry',
    'Employee', 'AttendanceRecord', 'LeaveApplication', 'PayrollRun',
    'Invoice', 'Payment', 'Notification', 'AuditLog',
    // ... all 55 tenant-scoped models
  ])

  const workspaceId = asyncLocalStorage.getStore()?.workspaceId

  if (tenantScopedModels.has(params.model)) {
    if (!workspaceId) {
      // System-level operations (cron jobs) must explicitly pass workspaceId
      // If this throws in a request context, it's a bug — fail loudly
      throw new InternalServerErrorException('WorkspaceId missing from request context')
    }

    if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args.where = { workspaceId, ...params.args.where }
    }

    if (params.action === 'create') {
      params.args.data = { workspaceId, ...params.args.data }
    }

    if (['createMany', 'updateMany', 'deleteMany'].includes(params.action)) {
      params.args.where = { workspaceId, ...params.args.where }
    }
  }

  return next(params)
})
```

**Automated isolation test (runs in CI on every PR):**
```ts
it('should not leak data between workspaces', async () => {
  // Create two workspaces with one lead each
  const wsA = await createTestWorkspace()
  const wsB = await createTestWorkspace()
  const leadA = await createTestLead(wsA.id)

  // Authenticate as wsB user and try to access wsA's lead
  const tokenB = await loginAs(wsB.adminUser)
  const response = await request(app.getHttpServer())
    .get(`/api/v1/leads/${leadA.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404)  // Must be 404 (not 403 — don't reveal existence)

  // Also verify list endpoint doesn't return wsA data
  const listResponse = await request(app.getHttpServer())
    .get('/api/v1/leads')
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(200)

  const leadIds = listResponse.body.data.map(l => l.id)
  expect(leadIds).not.toContain(leadA.id)
})
```

### Sensitive Data in API Responses

Role-based field exclusion is enforced at the serialiser level using `class-transformer`:

```ts
// Employee DTO — salary fields hidden from non-HR roles
export class EmployeeResponseDto {
  id: string
  firstName: string
  designation: string

  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  bankAccountNumber: string

  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  salaryAmount: number

  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  pan: string

  @Exclude({ unless: [Role.SUPER_ADMIN, Role.HR] })
  aadhaar: string  // Further masked: shown as ****1234 even to HR
}

// Applied globally with ClassSerializerInterceptor
app.useGlobalInterceptors(
  new ClassSerializerInterceptor(app.get(Reflector), {
    strategy: 'excludeAll',     // Explicitly include every field (opt-in exposure)
    excludeExtraneousValues: true,
  })
)
```

---

## Dependency Security

### Automated Scanning

```yaml
# .github/dependabot.yml — auto-creates PRs for outdated packages
version: 2
updates:
  - package-ecosystem: npm
    directory: /apps/api
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    reviewers: [dattu145]
    labels: [security, dependencies]

  - package-ecosystem: npm
    directory: /apps/web
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    reviewers: [dattu145]
    labels: [security, dependencies]
```

### Audit in CI

```yaml
# In CI workflow — block PRs with known HIGH/CRITICAL vulnerabilities
- name: Security audit
  run: |
    cd apps/api && pnpm audit --audit-level=high
    cd apps/web && pnpm audit --audit-level=high
```

### `pnpm` Lockfile Integrity

```bash
# Lockfile must match package.json — fails CI if out of sync
pnpm install --frozen-lockfile

# Enable pnpm's built-in package verification
# (verifies downloads against npm registry signatures)
pnpm config set verify-store-integrity true
```

---

## Data Protection and Privacy

### Data Minimisation

Only collect data that is necessary:
- Employee government IDs (PAN, Aadhaar) collected only when required for payroll compliance
- GPS location for clock-in: optional, user-consent required, not stored permanently
- User agent strings: logged for security purposes, not used for profiling

### Data Retention

| Data Type | Retention | Deletion Method |
|---|---|---|
| Audit logs (payroll/HR) | 7 years | Archive to R2, purge from DB after 2 years |
| Payroll records | 7 years | Archive to R2, access via admin |
| Employee records (terminated) | 7 years | Status=TERMINATED, not deleted |
| Notifications | 90 days | Automated BullMQ cron deletion |
| Session tokens (Redis) | As per TTL | Auto-expiry |
| Password reset tokens | 30 minutes | Auto-expiry in Redis |
| Deleted CRM records | Indefinite (soft-delete) | Hard-delete available for SUPER_ADMIN |
| Application logs | 30 days | Log aggregation service rotation |

### Right to Erasure (PDPB Compliance)

When an employee requests data erasure (post-termination):
1. Personal identifiable fields replaced with anonymised values (not deleted — referential integrity)
2. Payroll aggregates (totals) retained for statutory compliance
3. Audit logs retained with anonymised actor references

---

## Security Incident Response

### Incident Classification

| Severity | Description | Response Time | Examples |
|---|---|---|---|
| P0 — Critical | Data breach or service compromise | 15 minutes | Cross-tenant data leak, credential theft, database access |
| P1 — High | Active attack or significant vulnerability | 1 hour | DDoS, auth bypass, XSS in production |
| P2 — Medium | Security issue not actively exploited | 24 hours | Outdated package with known CVE, config weakness |
| P3 — Low | Best-practice improvement | Next sprint | Missing header, rate limit too lenient |

### P0 Response Playbook

```
1. Detection (< 5 min)
   - Sentry alert OR user report OR monitoring alert
   - Assess: what data is affected? How many workspaces?

2. Containment (< 15 min)
   - Rotate all JWT secrets (forces all users to re-login)
   - If DB breach suspected: rotate Supabase password, redeploy
   - If specific user compromised: deactivate user account immediately
   - If ongoing attack: activate Cloudflare "Under Attack" mode

3. Evidence preservation (< 30 min)
   - Export audit logs for the affected period before any cleanup
   - Capture Sentry error context
   - Document timeline: when did it start, what was accessed?

4. Eradication (< 2 hours)
   - Patch the vulnerability
   - Deploy fix to production
   - Verify fix with targeted test

5. Recovery
   - Re-enable affected services
   - Notify affected workspace admins with factual incident report

6. Post-mortem (within 48 hours)
   - Root cause analysis
   - Timeline of events
   - Controls that failed; controls that worked
   - Improvements to prevent recurrence
```

---

## Security Checklist (Pre-Production)

```
Authentication:
  [ ] JWT access token TTL = 15 minutes
  [ ] Refresh tokens stored in HttpOnly cookies
  [ ] Refresh token rotation working (replay detection)
  [ ] tokenVersion invalidation tested (role change forces re-login)
  [ ] Password complexity enforced (uppercase + lowercase + digit)
  [ ] Bcrypt rounds = 12
  [ ] Rate limiting active on login (10 attempts / 15 min)
  [ ] Forgot-password rate limit active (3 / hour)
  [ ] Last SUPER_ADMIN protection tested

Network:
  [ ] All traffic via Cloudflare (no direct origin exposure)
  [ ] HSTS enabled (1 year, includeSubDomains)
  [ ] Minimum TLS 1.2 enforced
  [ ] Security headers verified with securityheaders.com

Application:
  [ ] CORS origin whitelist verified (no wildcard)
  [ ] ValidationPipe whitelist=true active
  [ ] File upload: magic bytes checked (not just extension)
  [ ] No raw SQL interpolation in codebase (ESLint rule)
  [ ] XSS: sanitize-html on user HTML content
  [ ] Swagger UI disabled in production

Database:
  [ ] Application user has no UPDATE/DELETE on audit_logs
  [ ] Migrations run as separate migration user
  [ ] Sensitive fields (bank, PAN) encrypted at application layer
  [ ] Cross-workspace isolation automated test passes

Dependencies:
  [ ] pnpm audit --audit-level=high passes
  [ ] Dependabot configured
  [ ] Lockfile committed and verified

Data:
  [ ] Sensitive data masked in Sentry (password, bankAccount, pan, aadhaar)
  [ ] Sensitive export audit logging verified (isSensitive=true)
  [ ] Payslip download requires authentication + ownership check
  [ ] Employee salary fields excluded from ADMIN/TEAM_LEAD responses
```
