# Future Roadmap — VividCRM

## Roadmap Philosophy

VividCRM is built in phases, each phase validated before the next begins. The architecture decisions made today (module isolation, row-level data design, event-driven background jobs, role-based guards) are deliberate investments that reduce the cost of each phase that follows. Nothing in Phase 1 blocks Phase 2 or 3 — the foundation is multi-tenant and AI-ready from day one.

---

## Phase Breakdown

### Phase 1 — Internal Platform *(Current)*
**Timeline:** Active development  
**Goal:** Replace all external SaaS tools with a unified internal system

Deliverables:
- CRM fully operational (Leads, Deals, Contacts, Companies, Campaigns, Mailing, Reports)
- Task Management operational (Projects, Boards, Tasks, Sprints, Time Tracking)
- HRMS operational (Employees, Attendance, Leaves, Payroll, Onboarding)
- Invoice Management operational (GST-compliant, PDF, Payment Tracking)
- All 5 roles with correct permission boundaries
- Real-time notifications and collaboration via Socket.IO
- Background job infrastructure (BullMQ) for payroll, PDF, mailing

### Phase 2 — Multi-Tenant SaaS Product *(Next 6–12 months)*
**Timeline:** Post Phase 1 stabilisation  
**Goal:** Open the platform to paying external workspaces

Deliverables:
- Workspace abstraction — all data scoped to a `workspaceId`
- Self-serve onboarding — sign up, create workspace, invite team
- Subscription billing — Razorpay (India) + Stripe (global)
- Plan-based feature flags — Starter / Growth / Business tiers
- Module-level toggles — buy only CRM, or CRM + HRMS, or all four
- Admin billing dashboard — invoices, usage, seat management
- SUPER_ADMIN console — manage all workspaces, impersonate, configure

### Phase 3 — AI Integration *(12–24 months)*
**Timeline:** After SaaS traction  
**Goal:** Embed intelligence into every module; create product moats

See AI Opportunities section below.

### Phase 4 — Marketplace and Ecosystem *(24+ months)*
**Timeline:** After AI layer  
**Goal:** Build a developer/partner ecosystem around the platform

Deliverables:
- Public REST + GraphQL API
- Developer portal with API key management and rate limiting
- Webhook system — external tools subscribe to VividCRM events
- App marketplace — third-party integrations (WhatsApp, Slack, Google Workspace)
- White-label offering — branded instances for enterprise resellers

---

## Future: Multi-Company Support

### The Architecture Decision (Make It Now)

Every database record in Phase 1 should carry a `workspaceId` column, even when deployed as a single-workspace internal tool. This costs nothing in Phase 1 and unlocks multi-tenancy in Phase 2 without a migration.

```prisma
model Lead {
  id          String    @id @default(cuid())
  workspaceId String                          // scoped from day one
  workspace   Workspace @relation(...)
  // ... rest of fields
}
```

A Prisma middleware layer enforces `workspaceId` on every query automatically — no risk of cross-tenant data leakage.

### Multi-Company Topology (Phase 2)

```
Platform (VividCRM SaaS)
├── Workspace A (Company: PixelAgency)
│   ├── Users (ADMIN, TEAM_LEAD, EMPLOYEE roles)
│   ├── CRM data (Leads, Deals, Contacts)
│   ├── HRMS data (Employees, Payroll)
│   └── Invoice data
│
├── Workspace B (Company: NovaTech Solutions)
│   ├── Users
│   ├── CRM data
│   └── HRMS data
│
└── Workspace C (Company: StartupXYZ)
    └── ...
```

Each workspace is completely isolated. No data is shared across workspace boundaries by design.

### Future: Holding Company / Subsidiary Model
For enterprise clients with multiple subsidiary companies:

```
Enterprise Account (HoldCo)
├── Sub-workspace: Brand A
├── Sub-workspace: Brand B
└── Sub-workspace: Brand C
    └── Consolidated Reports accessible at HoldCo level
```

This requires a `parentWorkspaceId` relationship and a consolidated reporting layer — a Phase 3+ feature.

---

## Future: SaaS Business Opportunities

### 1. Vertical SaaS Editions
Rather than one generic product, create pre-configured editions for verticals:

| Edition | Target | Pre-configured Modules |
|---|---|---|
| **VividCRM for Agencies** | Digital / creative agencies | CRM + Tasks + Invoice. HRMS optional. Freelancer billing built in. |
| **VividCRM for Staffing** | Recruitment firms | CRM (candidate pipeline) + HRMS (placement tracking) + Invoice |
| **VividCRM for Real Estate** | Property developers/brokers | CRM (property pipeline) + Tasks (site management) + Invoice |
| **VividCRM for Consulting** | Management/IT consultants | CRM + Tasks (engagement management) + Invoice (milestone billing) |

### 2. Module-as-a-Service
Sell individual modules to companies that have existing tools for some functions:
- **HRMS-only** for companies with their own CRM
- **Invoice-only** for companies that want GST-compliant billing without the full suite
- **Tasks-only** for teams that want a Jira-alternative

### 3. Usage-Based Revenue Triggers
Beyond seat pricing, introduce consumption-based billing:
- Email sends per month (Mailing module)
- Payroll runs per month
- Invoice PDFs generated
- API calls per month
- File storage consumed (GB)
- AI feature credits

### 4. Professional Services
- Implementation and data migration for enterprise clients
- Custom workflow configuration
- Dedicated onboarding and training
- SLA-backed enterprise support contracts

---

## Future: AI Opportunities

AI features should be additive — they enhance existing workflows, they do not replace user agency. Every AI feature should have a non-AI fallback.

### CRM AI

| Feature | What It Does | Model Approach |
|---|---|---|
| **Lead Scoring** | Score each lead 0–100 based on engagement signals, company size, and historical conversion data | Fine-tuned classification or Claude prompt with deal history context |
| **Deal Coaching** | Analyse a deal's activity log and suggest next best action (follow-up, proposal, discount) | Claude with deal context + competitor win/loss data |
| **Email Drafting** | Generate personalised outreach emails based on contact profile and campaign context | Claude API with contact + campaign context |
| **Meeting Summariser** | Paste meeting transcript → auto-extract action items and add them as CRM tasks | Claude with structured output |
| **Churn Prediction** | Flag deals or clients at risk of churning based on engagement drop-off | Embeddings + similarity to historical churned deals |

### Task Management AI

| Feature | What It Does | Model Approach |
|---|---|---|
| **Task Decomposition** | Enter a high-level task; AI breaks it into subtasks with estimates | Claude with project context |
| **Sprint Planner** | Given team capacity and backlog priority, suggest optimal sprint composition | Claude with team velocity + task points data |
| **Blocker Detection** | Analyse task dependencies and flag tasks at risk of missing their deadline | Rule-based + LLM reasoning on dependency graph |
| **Progress Summaries** | Auto-generate daily/weekly project status reports from activity logs | Claude with structured activity data |
| **Smart Assignment** | Suggest the best team member for a task based on skills, current load, and past performance | Embeddings on employee profiles + workload data |

### HRMS AI

| Feature | What It Does | Model Approach |
|---|---|---|
| **Attrition Risk** | Predict which employees are at high risk of resignation based on attendance, performance, and tenure signals | Classification model or Claude with structured HR data |
| **Performance Coaching** | Generate personalised development suggestions for each employee's review cycle | Claude with performance history context |
| **Policy Q&A Bot** | Employee asks "How many sick leaves do I have?" → instant answer from HR policy documents | RAG over company policy documents using Claude |
| **Payroll Anomaly Detection** | Flag payroll runs where individual payslip deviates significantly from prior months | Statistical model + LLM explanation |
| **Interview Scheduler** | For staffing/recruiting editions, auto-suggest interview slots based on calendar availability | Claude function calling + calendar API |

### Invoice AI

| Feature | What It Does | Model Approach |
|---|---|---|
| **Invoice Drafting** | Given a client, project, and time entries, auto-draft a complete invoice | Claude with structured project/time data |
| **Payment Prediction** | Predict probability of on-time payment based on client history | Classification model or Claude with invoice history |
| **Pricing Suggestions** | Analyse historical deals and suggest pricing for similar engagements | Claude with deal history + market context |
| **OCR for Vendor Bills** | Upload a vendor invoice image; extract line items and add to expense records | Vision model (Claude or Mistral vision) |

### Cross-Platform AI

| Feature | What It Does |
|---|---|
| **VividAI Assistant** | A workspace-aware chat assistant. "Show me all overdue invoices for clients with open deals." Queries real data via tool calls. |
| **Workspace Health Score** | A weekly digest: deal pipeline health, team velocity, HR risk indicators, outstanding invoices — all in one AI-generated briefing |
| **Auto-tagging & Classification** | AI applies labels to leads, tasks, and documents automatically based on content |
| **Natural Language Filters** | Replace complex filter UIs with "Show me tasks assigned to the backend team due this week" |

---

## Technical Investments That Enable the Future

These are not features — they are architectural choices made in Phase 1 that open doors in later phases.

| Investment | Phase 1 Decision | What It Enables |
|---|---|---|
| `workspaceId` on all models | Add the column from day one | Multi-tenancy in Phase 2 with zero migration |
| BullMQ job infrastructure | Build queues for payroll and PDF | AI inference jobs, report generation, webhook delivery in Phase 3 |
| Socket.IO real-time layer | Build for task notifications | AI assistant streaming responses, live collaboration cursors in Phase 3 |
| Audit log on HR and financial mutations | Immutable event log from day one | AI training data, compliance exports, anomaly detection in Phase 3 |
| Modular NestJS architecture | Each domain is an isolated module | Add new vertical modules (field service, procurement) without touching existing modules in Phase 4 |
| Prisma schema as source of truth | Single schema file per module | Auto-generate API docs, type-safe SDK, and GraphQL schema in Phase 4 |
| Role-based guards on every route | Enforce from the first endpoint | Workspace-level plan enforcement, per-feature access control in Phase 2 |

---

## 5-Year Vision

By Year 5, VividCRM is:

1. **The operating system for Indian SMBs** — the default choice for any company with 10–500 employees that needs CRM + HR + Projects + Billing in one place
2. **AI-native** — every module has at least one AI feature that saves users meaningful time per week
3. **A platform, not just a product** — third-party developers build integrations and vertical extensions on top of the VividCRM API
4. **Multi-region** — India-first, with localised compliance for UAE, Singapore, and UK markets
5. **Profitable SaaS** — ₹1 crore+ MRR with net revenue retention above 110% driven by seat expansion and AI feature upsell

The foundation for all of this is what gets built in Phase 1. Build it right.
