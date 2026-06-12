# Module Overview — VividCRM

## System Architecture Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VividCRM Platform                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐  │
│  │     CRM      │  │    TASKS     │  │    HRMS      │  │INVOICE │  │
│  │              │  │              │  │              │  │        │  │
│  │ Leads        │  │ Projects     │  │ Employees    │  │Create  │  │
│  │ Deals   ─────┼──┼▶ Boards      │  │ Attendance ──┼──┼▶ Bills │  │
│  │ Contacts─────┼──┼▶ Tasks       │  │ Leaves       │  │ GST    │  │
│  │ Companies    │  │ Sprints      │  │ Payroll      │  │ PDF    │  │
│  │ Campaigns    │  │ Time Track───┼──┼──────────────┼──┼▶ Track │  │
│  │ Mailing      │  │ Calendar     │  │ Performance  │  │        │  │
│  │ Documents    │  │ Notifications│  │ Onboarding   │  │        │  │
│  │ Reports ◀────┼──┼──────────────┼──┼──────────────┼──┤        │  │
│  │ Teams   ◀────┼──┼──────────────┼──┼──────────────┘  │        │  │
│  │ Calendar◀────┼──┼──────────────┘  │                  │        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Shared Infrastructure                    │   │
│  │  Auth · Users · Roles · Notifications · Audit · Files      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module 1 — CRM

**Purpose:** Manage the full commercial pipeline from prospect acquisition to closed deal.

**Sub-modules and their responsibilities:**

| Sub-module | Responsibility |
|---|---|
| **Leads** | Capture and qualify inbound/outbound prospects. Track lead source, status, assigned owner. |
| **Deals** | Pipeline stages (Qualification → Proposal → Negotiation → Won/Lost). Associate deal to contact, company, and eventual project. |
| **Contacts** | Individual person records. Linked to companies, deals, and tasks. |
| **Companies** | Organisation records. Parent entity for contacts and deals. |
| **Campaigns** | Marketing campaign planning and tracking. Link campaigns to lead sources. |
| **Mailing** | Email broadcast system. Powered by Brevo integration. Sequence-based and one-shot sends. |
| **Documents** | File storage and management. Attach proposals, contracts, NDAs to deals and contacts. |
| **Reports** | Aggregated analytics across leads, deals, revenue, and team performance. |
| **Teams** | Logical groupings of users. Used to assign ownership and filter pipeline views. |
| **Calendar** | Meeting and follow-up scheduling. Syncs with tasks module calendar. |

**Key relationships:**
- A `Lead` can be converted into a `Deal`
- A `Deal` can spawn a `Project` in the Task Management module
- A `Company` and `Contact` can be referenced in an `Invoice`
- `Reports` pull data from Deals (revenue), Tasks (delivery timelines), and Invoice (payment status)
- `Teams` in CRM are the same team entities used in Task Assignment

---

## Module 2 — Task Management

**Purpose:** Execute work that has been sold. Inspired by Bordio's board-and-calendar paradigm.

**Sub-modules and their responsibilities:**

| Sub-module | Responsibility |
|---|---|
| **Projects** | Top-level containers for work. Linked to a CRM Deal or standalone internal initiatives. |
| **Boards** | Kanban/list/calendar views of task state within a project. |
| **Tasks** | Individual units of work. Has assignee, due date, priority, status, and labels. |
| **Subtasks** | Nested work items under a parent task. |
| **Comments & Mentions** | Threaded discussion on tasks. `@mention` triggers a real-time notification. |
| **Activity Logs** | Immutable event stream per task (created, assigned, status changed, commented). |
| **Time Tracking** | Log hours against tasks. Feeds into Invoice for billable hours and HRMS for attendance. |
| **Recurring Tasks** | Template-based tasks that auto-create on a schedule (daily standups, weekly reports). |
| **Team Assignment** | Assign tasks to individual users or entire teams. Workload view per team. |
| **Calendar Sync** | Two-way sync between task due dates and the shared calendar (CRM Calendar). |
| **Sprint Management** | Time-boxed sprint containers. Group tasks into sprints with start/end dates and velocity tracking. |
| **Notifications** | Real-time event notifications via Socket.IO. Also queued for email digest via BullMQ. |

**Key relationships:**
- A `Project` is linked to a `Deal` (CRM) — closing a deal can auto-create a project template
- `Time Tracking` entries flow into the `Invoice` module as billable line items
- `Team Assignment` references the same `User` and `Team` entities as CRM Teams
- `Calendar Sync` writes to the shared calendar entity also used by CRM Calendar
- `Sprint` velocity data feeds the `Reports` module

---

## Module 3 — HRMS

**Purpose:** Manage the full employee lifecycle. Inspired by Keka's comprehensive HR platform.

**Sub-modules and their responsibilities:**

| Sub-module | Responsibility |
|---|---|
| **Employees** | Core employee profiles. Linked to the `User` entity for system access. |
| **Departments** | Organisational units. Used for attendance grouping, leave policies, and payroll cost centres. |
| **Attendance** | Daily attendance records. Clock-in/out, auto-attendance from shifts, or manual marking. |
| **Leave Management** | Leave types, leave balances, leave application, and multi-level approval workflows. |
| **Holidays** | Configurable national and office holiday calendars. Blocks attendance on those days. |
| **Shift Management** | Define work shifts (day/night/flexible). Assign to employees or departments. |
| **Payroll** | Monthly payroll computation based on attendance, leaves, and salary structure. Generates payslips. |
| **Employee Documents** | Store offer letters, contracts, certificates, and ID proofs per employee. |
| **Performance Reviews** | Periodic review cycles. Goal setting, self-assessment, manager review, rating. |
| **Onboarding** | Checklist-driven onboarding flow for new hires. Task assignments, document collection. |
| **Exit Management** | Resignation, notice period tracking, full-and-final settlement, exit interview. |
| **Approval Workflows** | Configurable multi-step approval chains for leaves, expenses, and performance sign-offs. |

**Key relationships:**
- `Employee` records are linked to `User` accounts — same person, different data concern
- `Attendance` and `Leaves` are inputs to `Payroll` computation
- `Onboarding` creates a set of `Tasks` in the Task Management module for IT setup, document collection, etc.
- `Payroll` generates cost data that flows into `Reports`
- `Holidays` block days in the shared calendar and in leave balance calculations
- `Performance Reviews` can be linked to deal or project outcomes from CRM and Tasks

---

## Module 4 — Invoice

**Purpose:** Convert delivered work and won deals into revenue. GST-compliant, professional invoices.

**Sub-modules and their responsibilities:**

| Sub-module | Responsibility |
|---|---|
| **Create Invoice** | Invoice composer. Select client (from CRM Contacts/Companies), add line items, apply tax. |
| **Invoice Templates** | Reusable invoice layouts with pre-filled line items, branding, and payment terms. |
| **GST Calculation** | Auto-compute CGST, SGST, IGST based on client state vs. business state. HSN/SAC code support. |
| **Invoice PDF** | Generate and download professional PDF invoices. Powered by BullMQ background job. |
| **Client Billing** | View billing history per client. Outstanding, paid, and overdue summaries. |
| **Invoice Status** | Draft → Sent → Viewed → Paid → Overdue → Cancelled lifecycle management. |
| **Payment Tracking** | Log payments received. Support partial payments. Track outstanding balance. |
| **Revenue Reports** | Monthly/quarterly/annual revenue summaries. Feeds into the CRM Reports module. |
| **Invoice History** | Full audit trail of every invoice event — created, edited, sent, paid, voided. |

**Key relationships:**
- Invoice `Client` is a `Contact` or `Company` from CRM
- Invoice `Line Items` can be auto-populated from `Time Tracking` entries in the Tasks module
- A `Deal` (CRM) can directly trigger an invoice draft upon closing as Won
- `Revenue Reports` feed into the CRM `Reports` module for unified business analytics
- PDF generation is a BullMQ background job to avoid blocking the UI on large invoices

---

## Shared Infrastructure Modules

These are not user-facing modules but underpin every feature above.

| Shared Module | Responsibility |
|---|---|
| **Authentication** | JWT-based auth with refresh token rotation. Role is embedded in the token. |
| **Users** | Central user record. Every employee, admin, and HR user is a `User` first. |
| **Roles & Permissions** | SUPER_ADMIN, ADMIN, HR, TEAM_LEAD, EMPLOYEE. Guards on every API route. |
| **Notifications** | Unified notification system. Socket.IO for real-time, BullMQ for async email digest. |
| **Audit Logs** | Immutable log of mutations on financial and HR records. Actor, timestamp, before/after. |
| **File Storage** | Centralised file handling (Cloudflare R2 or AWS S3). Used by Documents, HRMS, Invoice PDF. |
| **Background Jobs** | BullMQ queues for payroll, PDF generation, mailing, report aggregation. |

---

## Cross-Module Data Flow Diagrams

### Deal → Project → Invoice Flow
```
[CRM: Deal Won]
      │
      ▼
[Tasks: Project Created from Deal Template]
      │
      ▼
[Tasks: Tasks assigned, time tracked]
      │
      ▼
[Invoice: Line items pulled from time entries]
      │
      ▼
[Invoice: Sent to client (CRM Contact)]
      │
      ▼
[Invoice: Payment received → Revenue Reports updated]
      │
      ▼
[CRM: Reports show closed deal + invoiced revenue]
```

### New Hire → Active Employee Flow
```
[HRMS: Employee record created]
      │
      ▼
[HRMS: Onboarding workflow triggered]
      │
      ├──▶ [Tasks: Onboarding tasks created for IT/HR/Manager]
      │
      ├──▶ [HRMS: Employee Documents checklist created]
      │
      └──▶ [User: System account provisioned with EMPLOYEE role]
            │
            ▼
      [HRMS: Shift assigned, leave balance initialised]
            │
            ▼
      [HRMS: Attendance tracking begins]
            │
            ▼
      [HRMS: Month-end → Payroll computation]
```

### Task Time → Billable Invoice Flow
```
[Tasks: Employee logs 8h on Task "Website Redesign"]
      │
      ▼
[Tasks: Time entry stored with task, project, user]
      │
      ▼
[Invoice: "Import time entries" from project]
      │
      ▼
[Invoice: Line item added — "Website Redesign — 8h × ₹2,500"]
      │
      ▼
[Invoice: GST computed, PDF generated, sent to client]
```

---

## Role × Module Access Matrix

| Module / Feature | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|:---:|
| CRM — Leads & Deals | ✅ Full | ✅ Full | ❌ | Read own | ❌ |
| CRM — Contacts & Companies | ✅ Full | ✅ Full | ❌ | Read | ❌ |
| CRM — Campaigns & Mailing | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| CRM — Reports | ✅ Full | ✅ Full | HR reports | Team reports | ❌ |
| Tasks — Projects & Boards | ✅ Full | ✅ Full | ❌ | Own projects | Assigned only |
| Tasks — Tasks & Subtasks | ✅ Full | ✅ Full | ❌ | Own team | Assigned only |
| Tasks — Time Tracking | ✅ Full | ✅ Full | ❌ | Own team | Own entries |
| Tasks — Sprint Management | ✅ Full | ✅ Full | ❌ | Own projects | Read |
| HRMS — Employees | ✅ Full | Read | ✅ Full | Read team | Own profile |
| HRMS — Attendance | ✅ Full | ❌ | ✅ Full | Team read | Own |
| HRMS — Payroll | ✅ Full | ❌ | ✅ Full | ❌ | Own payslip |
| HRMS — Leave Management | ✅ Full | ❌ | ✅ Full | Team approve | Own requests |
| HRMS — Performance Reviews | ✅ Full | ❌ | ✅ Full | Own team | Own reviews |
| Invoice — Create & Edit | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| Invoice — Revenue Reports | ✅ Full | ✅ Full | ❌ | ❌ | ❌ |
| System — Roles & Settings | ✅ Full | Limited | ❌ | ❌ | ❌ |
