# Auth API — VividCRM

## Global Conventions

| Convention | Value |
|---|---|
| Base URL | `/api/v1` |
| Auth header | `Authorization: Bearer <accessToken>` |
| Content type | `application/json` |
| Date format | ISO 8601 — `2025-06-01T09:00:00.000Z` |
| Workspace scope | Extracted from JWT `workspaceId` claim — never a URL parameter |
| Error envelope | `{ "statusCode": number, "message": string \| string[], "error": string }` |
| Validation errors | HTTP 400 with array of `message` strings from class-validator |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days (rotated on use) |

---

## Endpoints

---

### POST `/api/v1/auth/login`

Authenticate with email and password. Returns a short-lived access token and a rotating refresh token.

**Permission:** Public (no JWT required)

**Request Body:**
```ts
class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "d9f3a2b1...",
  "expiresIn": 900,
  "user": {
    "id": "clx1a2b3c",
    "workspaceId": "clx0workspace",
    "email": "jane@agency.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "ADMIN",
    "avatarUrl": null
  }
}
```

**Validation:**
- `email` — required, valid email format
- `password` — required, string, 8–128 characters

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Validation failure (bad email format, missing fields) |
| 401 | Invalid credentials (wrong email or password) |
| 401 | Account deactivated (`isActive: false`) |
| 429 | Rate limit: 10 failed attempts per IP per 15 minutes |

**Side Effects:**
- `user.lastLoginAt` updated
- `AuditLog` entry: action=`LOGIN`, module=`SYSTEM`
- Failed attempt logged (no audit entry — separate rate-limit log)

---

### POST `/api/v1/auth/refresh`

Exchange a valid refresh token for a new access token and rotated refresh token.

**Permission:** Public (uses refresh token in body, not JWT)

**Request Body:**
```ts
class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "a1b2c3d4...",
  "expiresIn": 900
}
```

**Validation:**
- `refreshToken` — required, non-empty string

**Error Responses:**
| Status | Condition |
|---|---|
| 401 | Refresh token invalid, expired, or already rotated (replay detection) |
| 401 | User is deactivated |
| 401 | `tokenVersion` mismatch (role was changed; all sessions invalidated) |

---

### POST `/api/v1/auth/logout`

Invalidate the current session's refresh token.

**Permission:** Any authenticated user

**Request Body:** None

**Response `200`:**
```json
{ "message": "Logged out successfully" }
```

**Side Effects:**
- Current refresh token revoked in Redis
- `AuditLog` entry: action=`LOGOUT`

---

### POST `/api/v1/auth/logout-all`

Invalidate all sessions for the authenticated user (increment `tokenVersion`).

**Permission:** Any authenticated user

**Request Body:** None

**Response `200`:**
```json
{ "message": "All sessions terminated" }
```

**Side Effects:**
- `user.tokenVersion` incremented — all existing JWTs rejected on next use
- All refresh tokens for the user revoked in Redis
- `AuditLog` entry: action=`LOGOUT`, metadata: `{ scope: "all" }`

---

### POST `/api/v1/auth/forgot-password`

Send a password reset email to the provided address if it matches an active account.

**Permission:** Public

**Request Body:**
```ts
class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string
}
```

**Response `200`:**
```json
{ "message": "If an account exists for this email, a reset link has been sent." }
```

> Always returns 200 regardless of whether the email exists — prevents user enumeration.

**Validation:**
- `email` — required, valid email format

**Side Effects:**
- If email found: generate short-lived (30 min) signed reset token stored in Redis
- BullMQ job queued: send reset email via Brevo
- Rate limit: 3 reset requests per email per hour

---

### POST `/api/v1/auth/reset-password`

Set a new password using a valid reset token.

**Permission:** Public

**Request Body:**
```ts
class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string

  @IsString()
  @IsNotEmpty()
  confirmPassword: string
}
```

**Response `200`:**
```json
{ "message": "Password reset successfully. Please log in." }
```

**Validation:**
- `token` — required, non-empty
- `password` — required, 8–128 chars, must contain uppercase, lowercase, digit
- `confirmPassword` — must match `password` (service-layer check)

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Token expired (> 30 minutes old) |
| 400 | Token already used |
| 400 | `confirmPassword` does not match `password` |
| 404 | Token not found |

**Side Effects:**
- Password hash updated
- Reset token invalidated in Redis
- All existing sessions terminated (`tokenVersion` incremented)

---

### POST `/api/v1/auth/change-password`

Change password for the authenticated user (requires current password).

**Permission:** Any authenticated user

**Request Body:**
```ts
class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  newPassword: string

  @IsString()
  @IsNotEmpty()
  confirmNewPassword: string
}
```

**Response `200`:**
```json
{ "message": "Password changed successfully." }
```

**Validation:**
- `currentPassword` — verified against stored hash
- `newPassword` — 8–128 chars, complexity rule
- `confirmNewPassword` — must match `newPassword`
- `newPassword` must differ from `currentPassword`

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | `currentPassword` is incorrect |
| 400 | New password same as current |
| 400 | `confirmNewPassword` mismatch |

**Side Effects:**
- Password hash updated
- All other sessions invalidated (`tokenVersion` incremented; current session preserved)

---

### GET `/api/v1/auth/me`

Return the profile of the currently authenticated user.

**Permission:** Any authenticated user

**Request:** No body. JWT required.

**Response `200`:**
```json
{
  "id": "clx1a2b3c",
  "workspaceId": "clx0workspace",
  "email": "jane@agency.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "ADMIN",
  "avatarUrl": null,
  "phone": "+919876543210",
  "isActive": true,
  "lastLoginAt": "2025-06-01T09:00:00.000Z",
  "workspace": {
    "id": "clx0workspace",
    "name": "Pixel Agency",
    "slug": "pixel-agency",
    "logoUrl": null,
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "isCrmEnabled": true,
    "isTasksEnabled": true,
    "isHrmsEnabled": true,
    "isInvoiceEnabled": true
  },
  "employee": {
    "id": "emp123",
    "employeeCode": "E001",
    "designation": "Product Manager",
    "departmentId": "dept_eng"
  }
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 401 | Invalid or expired JWT |

---

### PATCH `/api/v1/auth/me`

Update non-sensitive profile fields for the authenticated user.

**Permission:** Any authenticated user

**Request Body:**
```ts
class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string

  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  @IsOptional()
  @IsUrl()
  avatarUrl?: string
}
```

**Response `200`:** Updated user object (same shape as `GET /auth/me`).

**Validation:**
- All fields optional
- `firstName` / `lastName` — max 50 chars
- `phone` — valid phone number format
- `avatarUrl` — valid URL; must point to workspace's file storage domain

---

## JWT Payload Structure

```json
{
  "sub": "clx1a2b3c",
  "workspaceId": "clx0workspace",
  "role": "ADMIN",
  "tokenVersion": 3,
  "sessionId": "sess_abc123",
  "iat": 1748764800,
  "exp": 1748765700
}
```

| Claim | Purpose |
|---|---|
| `sub` | User ID |
| `workspaceId` | Tenant scope — injected into every DB query |
| `role` | Role at time of login — used by `RolesGuard` |
| `tokenVersion` | Must match `user.tokenVersion` in DB; mismatch → 401 |
| `sessionId` | Used in audit logs to correlate events to a single session |

---

## NestJS Guard Setup

```ts
// Applied globally on AppModule
@UseGuards(JwtAuthGuard)           // validates JWT, attaches user to req
@UseGuards(RolesGuard)             // checks @Roles() decorator
@UseGuards(WorkspaceScopeGuard)    // injects workspaceId into Prisma middleware

// Per-endpoint decorator
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Roles(Role.HR)
// No decorator = any authenticated role can access
```

---

## Error Response Envelope

All error responses follow this shape:

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request",
  "timestamp": "2025-06-01T09:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

For single-message errors:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```
