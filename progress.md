# VividCRM — Build Progress

> Updated automatically after every build session. Last updated: 2026-06-02

---

## Product Target

| Module | Style Reference | Status |
|---|---|---|
| CRM | Internal | ✅ Frontend + Backend done · Hooks migrated to NestJS |
| Task Manager | Bordio-style | ✅ Frontend + Backend done · Hooks migrated to NestJS |
| HRMS | Keka HR-style | ✅ Frontend + Backend done · All 7 pages |
| Invoice Generator | Internal | ✅ Frontend + Backend done · GST + payments |

---

## Overall Completion

```
CRM (Frontend)          ██████████  100%  Leads, Deals, Contacts, Companies, Campaigns, Mailing
CRM (Backend/NestJS)    ██████████  100%  Leads, Deals, Contacts, Campaigns — full REST API
Task Manager (Frontend) ██████████  100%  Kanban, table, timeline, list views + detail panel
Task Manager (Backend)  ██████████  100%  Projects, boards, sprints, tasks, time-tracking, comments
Auth Module             ██████████  100%  JWT, refresh, logout-all, OTP reset, exchange endpoint
HRMS (Backend)          ██████████  100%  Employees, Departments, Leaves, Attendance, Payroll
HRMS (Frontend)         ██████████  100%  7 pages: dashboard, employees, attendance, leaves, payroll, departments, employee detail
Invoice (Backend)       ██████████  100%  Create/list/update, GST (CGST/SGST/IGST), payments, settings
Invoice (Frontend)      ██████████  100%  List, New (live calc), Detail/print, Settings
────────────────────────────────────────────────
CRM Hook Migration      ██████████  100%  use-leads, use-deals, use-contacts, use-tasks → NestJS
Auth Bridge             ██████████  100%  POST /auth/exchange (Supabase JWT → NestJS JWT)
Frontend API Client     ██████████  100%  lib/api-client.ts with auto token exchange
Print/PDF CSS           ██████████  100%  @media print hides sidebar/nav, shows #invoice-print
────────────────────────────────────────────────
Add Employee Form        ██████████  100%  /dashboard/hrms/employees/new — full onboarding form
────────────────────────────────────────────────
OVERALL PROJECT         █████████░  ~93%
```

### Remaining 7%
| Item | Effort | Priority |
|---|---|---|
| Mobile App (React Native/Expo) | Very high — separate repo | Future sprint |
| Chromium/Puppeteer PDF download | Medium — BullMQ pdf queue exists | Nice-to-have |
| Production deployment (Dockerfile, CI/CD) | Medium | Pre-launch |
| Integration/E2E tests | Medium | Pre-launch |

---

## What Is Built — Detail

### ✅ Backend Foundation (`backend/src/`)
- NestJS 10 with Express adapter
- Prisma 5 + Supabase PostgreSQL (multi-schema: auth + public)
- Redis (ioredis) — BullMQ queues, rate limiting, session storage
- 8 BullMQ queues registered (email, audit, pdf, attendance, payroll, tasks, campaigns, reports)
- Socket.IO /notifications gateway with JWT validation
- Winston logging (pretty dev / JSON prod)
- Helmet + CORS + compression + cookie-parser
- Global guards: JwtAuthGuard, RolesGuard, ThrottlerGuard
- Global interceptors: Response envelope, Logging, Audit
- Cloudflare R2 storage service (disabled until R2 env vars set)
- Health check endpoint (`GET /api/v1/health`)
- Swagger UI (`GET /api/docs`)

### ✅ Auth Module (`backend/src/modules/auth/`)
- POST /api/v1/auth/login (email + password → JWT)
- POST /api/v1/auth/refresh (rotate refresh token from HttpOnly cookie)
- POST /api/v1/auth/logout (single session)
- POST /api/v1/auth/logout-all (all sessions + token version increment)
- GET  /api/v1/auth/me (current user profile)
- PATCH /api/v1/auth/me (update name/avatar)
- POST /api/v1/auth/change-password
- POST /api/v1/auth/forgot-password (OTP via Brevo)
- POST /api/v1/auth/reset-password (verify OTP + new password)
- POST /api/v1/auth/exchange (Supabase JWT → NestJS JWT bridge)
- Replay detection on refresh token rotation
- Role mapping: CRM roles (content_creator, rep) → system roles (EMPLOYEE, TEAM_LEAD)

### ✅ Task Management Backend (`backend/src/modules/tasks/`)
All 50 endpoints:
- Projects CRUD (create, list, get, update, archive, stats)
- Boards CRUD + column management + reorder
- Sprints (create, start, complete with velocity calc, incomplete task handling)
- Tasks (full CRUD, move, multi-assignee, labels, watch/unwatch, subtasks)
- Comments with threading + @mention parsing
- Time tracking (start/stop timer, manual entry, reports)
- Activity log (immutable audit trail per task)
- Labels (workspace-scoped with colors)

### ✅ HRMS Backend (`backend/src/modules/hrms/`)
- Employee management (full CRUD, AES-256-GCM encryption for PAN/Aadhaar/bank)
- Department management (hierarchy support, manager assignment)
- Leave types CRUD + leave applications + approval workflow
- Leave balance tracking per employee per year
- Attendance records (check-in/check-out, regularization, summary)
- Payroll runs (draft → processing → completed)
- Payslip generation (earnings/deductions: PF 12%, ESI 0.75%, PT ₹200)

### ✅ Invoice Backend (`backend/src/modules/invoice/`)
- Invoices CRUD with auto-number (INV-YYYY-NNNN)
- Line items with HSN/SAC, tax per item
- GST computation: CGST+SGST (intra-state) or IGST (inter-state)
- Payment recording with status auto-transition (draft→sent→partial→paid)
- Invoice settings (business info, bank details, tax type)
- Stats endpoint (total/collected/outstanding/overdue)

### ✅ CRM Backend (`backend/src/modules/crm/`)
- Leads: CRUD, stats (groupBy status), activity log, score calc
- Deals: CRUD, pipeline (groupBy stage + value sum), activity log
- Contacts: CRUD, search
- Campaigns: CRUD, status management, stats

### ✅ HRMS Frontend (`app/dashboard/hrms/`)
- `/dashboard/hrms` — Dashboard: headcount, attendance today, pending leaves, quick links
- `/dashboard/hrms/employees` — Directory: search, status/dept filters, table with avatar
- `/dashboard/hrms/employees/new` — Add Employee: multi-section onboarding form
- `/dashboard/hrms/employees/[id]` — Employee detail: profile header, 4 tabs (Overview/Attendance/Leaves/Payroll)
- `/dashboard/hrms/attendance` — Daily view: date navigator, summary chips, check-in/out table
- `/dashboard/hrms/leaves` — Tabs: Pending (approve/reject), Approved, History
- `/dashboard/hrms/payroll` — Payroll runs list, process button, INR formatting
- `/dashboard/hrms/departments` — Grid cards, add/edit/delete dialog, manager assignment, sub-dept hierarchy

### ✅ Invoice Frontend (`app/dashboard/invoices/`)
- `/dashboard/invoices` — List with ₹ stats (Total, Collected, Outstanding, Overdue)
- `/dashboard/invoices/new` — Live-calc creator: client info, line items, discount, CGST/SGST, grand total
- `/dashboard/invoices/[id]` — Print-ready document + payment recording panel + payment history
- `/dashboard/invoices/settings` — Business info, bank details, invoice prefix, tax type selector

### ✅ CRM Frontend (`app/dashboard/`)
- Leads: table + kanban + list views, import/export CSV/Excel
- Deals: pipeline view, deal detail, activities
- Contacts: list, detail with linked deals/leads
- Companies: with territory assignment
- Campaigns: email campaigns with drip sequences
- Bulk Mailing: email composer

### ✅ Task Manager Frontend (`app/dashboard/actions/`)
- Kanban board (drag-and-drop columns)
- Table view
- Timeline/Gantt view
- List view
- Task detail panel, Quick add task

### ✅ Supporting Pages
- Reports (list + builder + detail)
- Calendar, Teams, Products, Documents, Email Settings, Integrations, Settings, Profile

---

## Roles in System

| Role | Access |
|---|---|
| SUPER_ADMIN | Everything across all workspaces |
| ADMIN | All modules in workspace, manage employees, run payroll |
| TEAM_LEAD | Manage their team's tasks, approve leaves for team |
| HR | Full HRMS access, read-only on CRM |
| EMPLOYEE | Own tasks, own attendance, own leaves, own payslips |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Shadcn/ui, Supabase JS |
| Backend | NestJS 10, Prisma 5, PassportJS, BullMQ |
| Database | PostgreSQL on Supabase (multi-schema: auth + public) |
| Cache/Queue | Redis (ioredis) via Upstash or local Docker |
| Storage | Cloudflare R2 (disabled until configured) |
| Email | Brevo Transactional API |
| Auth | Supabase Auth (frontend) + NestJS JWT (backend API) |
| Real-time | Socket.IO at ws://localhost:3001/notifications |

---

## How to Run

### Terminal 1 — Backend
```bash
cd backend
npm run start:dev
# Runs on http://localhost:3001
# Swagger: http://localhost:3001/api/docs
```

### Terminal 2 — Frontend
```bash
npm run dev
# Runs on http://localhost:3000
```
