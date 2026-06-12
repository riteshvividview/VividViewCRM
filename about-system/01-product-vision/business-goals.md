# Business Goals — VividCRM

## Strategic Objectives

### Phase 1 — Internal Platform (Current)
Build a fully functional, production-ready internal business operating system for VividView. This phase proves the product concept against real operational data before external commercialization.

**Success criteria:**
- All four module layers (CRM, Tasks, HRMS, Invoice) operational
- All five roles working with correct permission boundaries
- Zero dependency on external SaaS tools for internal operations
- Real-time collaboration working across task boards and notifications
- Payroll, leave, and attendance fully managed within the system

### Phase 2 — Productization for SaaS
Extract the internal platform into a tenant-isolated, multi-company SaaS product. Introduce billing, workspace management, and a public onboarding flow.

**Success criteria:**
- Workspace-level data isolation (row-level security or schema-per-tenant)
- Self-serve onboarding with plan selection
- Subscription billing integrated (Razorpay/Stripe)
- Module-level feature flags per plan tier

### Phase 3 — Market Expansion and AI Integration
Introduce AI-native features, deeper analytics, marketplace integrations, and a developer API to grow the addressable market and create moats against competitors.

---

## Business Model

### Phase 1 (Internal)
- No external revenue; cost center — investment in internal tooling
- Goal: reduce spend on external SaaS subscriptions by consolidating

### Phase 2 (SaaS Launch)

| Plan | Target Segment | Price Signal |
|---|---|---|
| **Starter** | Freelancers / micro-teams (1–5 users) | Free or low-cost, limited modules |
| **Growth** | Agencies / SMBs (5–50 users) | Per-seat pricing, all modules |
| **Business** | Mid-market (50–200 users) | Per-seat + usage-based, priority support |
| **Enterprise** | Large orgs (200+ users) | Annual contract, custom SLAs, SSO |

### Revenue Streams (Phase 2+)
1. **Seat-based subscriptions** — primary revenue driver
2. **Module add-ons** — HRMS or Invoice as paid add-ons for CRM-only customers
3. **Storage overage** — beyond included document/file storage limits
4. **API access** — metered developer API calls beyond the free tier
5. **White-label licensing** — custom-branded instance for enterprise clients

---

## Key Performance Indicators

### Product Health KPIs
| KPI | Target (Phase 1 End) | Target (Phase 2 Launch) |
|---|---|---|
| Module completion | 4/4 modules live | All modules stable |
| Role coverage | 5/5 roles functional | Role templates configurable |
| API response p95 | < 300ms | < 200ms |
| Real-time event latency | < 500ms | < 200ms |
| Background job success rate | > 99% | > 99.5% |

### Business KPIs (Phase 2)
| KPI | 6-Month Target | 12-Month Target |
|---|---|---|
| Paying workspaces | 10 | 50 |
| Monthly Recurring Revenue | ₹50,000 | ₹3,00,000 |
| Average seats per workspace | 8 | 12 |
| Churn rate | < 10% monthly | < 5% monthly |
| NPS score | > 30 | > 50 |

---

## Competitive Positioning

### Direct Competitors
| Competitor | What They Do | Our Advantage |
|---|---|---|
| Zoho One | All-in-one suite | Simpler UX, modern stack, India-native pricing |
| HubSpot + Jira + Darwinbox | Three separate tools | Unified data model, no integration cost |
| Freshworks suite | CRM + HRMS separate | Single platform, real-time cross-module |
| Notion + Linear | Tasks and docs only | Full CRM + HRMS + Invoice layer |

### Differentiation Strategy
1. **India-first design** — GST compliance, INR invoicing, Indian holiday calendars built in, not bolted on
2. **Unified data, not integrations** — competitors integrate their products; we share a schema
3. **Modern developer experience** — NestJS + Prisma + TypeScript gives a maintainable, extensible codebase
4. **Real-time by default** — live task boards, live notifications, live presence are not premium features
5. **Affordable pricing** — target the vast underserved SMB segment priced out of Zoho One or Salesforce

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Feature scope creep in Phase 1 | High | High | Strict module boundary definitions; no cross-module features until each module is stable |
| Multi-tenancy data leak in Phase 2 | Medium | Critical | Row-level security on all queries from day one; tenant ID enforced at Prisma middleware level |
| PostgreSQL performance at scale | Medium | High | Connection pooling (PgBouncer), query optimization, Redis caching layer |
| BullMQ job failures in payroll | Low | Critical | Dead-letter queues, retry policies, admin dashboard for job monitoring |
| Regulatory changes in GST | Medium | Medium | Invoice module built with configurable tax rules, not hardcoded rates |

---

## Build Principles

These govern every product and engineering decision:

1. **Data integrity over convenience** — never sacrifice referential integrity for a faster feature ship
2. **Role boundaries are non-negotiable** — HR data must never be readable by non-HR roles, no exceptions
3. **Background jobs for anything > 2 seconds** — payroll, PDF export, email blasts, report generation all go through BullMQ
4. **Optimistic UI, server authority** — TanStack Query optimistic updates for snappy UX; server is always the source of truth
5. **Module isolation** — each NestJS module owns its database tables, its service layer, and its DTOs; no module reaches into another module's service directly
6. **Audit trails on financial and HR data** — every payroll run, invoice change, and employee record mutation is logged with timestamp, actor, and before/after state
