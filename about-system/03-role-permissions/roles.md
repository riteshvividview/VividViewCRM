# Roles — VividCRM RBAC System

## Role Design Principles

1. **Least privilege by default** — every role starts with no access; permissions are explicitly granted, never inherited downward from a higher role
2. **Scope over blanket access** — roles do not grant global access; every permission is bounded by a data scope (own record, own team, own department, workspace-wide)
3. **Separation of concerns** — HR data is invisible to CRM roles; financial data is invisible to HR roles; no role can see everything except SUPER_ADMIN
4. **Roles are not hierarchical by inheritance** — ADMIN does not inherit TEAM_LEAD permissions; each role is defined independently
5. **One user, one role** — a user holds exactly one primary role; no role stacking; role-based UX is unambiguous

---

## Role Definitions

---

### SUPER_ADMIN

**Identity:** Platform owner, system architect, or technical founder.

**Scope:** Workspace-wide, unrestricted. The only role with access to system-level configuration, module toggling, audit log inspection, and user role assignment.

**Responsibilities:**
- Configure workspace settings (name, branding, timezone, locale)
- Enable or disable modules (e.g., hide HRMS for a CRM-only workspace)
- Create, update, suspend, and permanently delete user accounts
- Assign and change roles for all other users
- Inspect full audit logs across all modules and all users
- Manage integrations (Brevo, Cloudflare R2, payment gateways)
- Override stuck workflows (e.g., force-approve a payroll run)
- Access all data across CRM, Tasks, HRMS, and Invoice with no scope restriction
- Export any dataset from any module

**What SUPER_ADMIN does NOT do:**
- SUPER_ADMIN is a technical governance role, not an operational one — they should not be doing day-to-day CRM work or running payroll manually
- There should be at most 1–2 SUPER_ADMINs per workspace; over-assignment of this role is a security risk

**Data scope:** All records in all modules across the entire workspace.

**Operational context:** This role exists to govern the system, not to use it. Think of it as the DBA + DevOps + platform admin combined.

---

### ADMIN

**Identity:** Business owner, operations head, or department director who runs the commercial side of the business.

**Scope:** Workspace-wide for CRM, Tasks, Projects, Invoices, Documents, Calendar, and Reports. No access to HRMS financial data (Payroll) or individual employee HR records.

**Responsibilities:**
- Own and manage the entire CRM pipeline (Leads, Deals, Contacts, Companies)
- Plan and execute marketing campaigns and email mailing
- Create, assign, and monitor projects and tasks across all teams
- Generate, send, and track client invoices
- View workspace-level reports (revenue, pipeline, team performance)
- Manage company documents and shared file storage
- Invite team members and assign them to CRM teams (but cannot assign roles — only SUPER_ADMIN does this)

**What ADMIN does NOT do:**
- Cannot view payroll figures, salary structures, or individual payslips
- Cannot view, approve, or modify leave applications or attendance records
- Cannot access the Settings module for workspace-level configuration
- Cannot assign or change user roles

**Why HRMS is excluded from ADMIN:**
Employee compensation and HR records are sensitive personal data. An ADMIN may also be a co-founder or a department head who should not have visibility into other employees' salaries. HRMS data is strictly HR-scoped.

**Data scope:** All workspace records for commercial and project modules. Excluded from all HRMS financial and personal HR records.

---

### HR

**Identity:** HR Manager, People Operations Lead, or Payroll Administrator.

**Scope:** Workspace-wide for all HRMS modules (Employees, Departments, Attendance, Leaves, Payroll, Documents for employee records). No access to CRM pipeline, client invoices, or project-level task boards.

**Responsibilities:**
- Manage the complete employee lifecycle (onboarding, active employment, offboarding)
- Configure and manage departments and reporting structures
- Record, correct, and export attendance data
- Manage leave policies, leave balances, and approve or reject leave applications
- Configure company holiday calendars
- Define shift schedules and assign employees to shifts
- Run monthly payroll, review computations, and approve final payroll
- Generate and distribute payslips
- Conduct and manage performance review cycles
- Manage HR documents (contracts, offer letters, IDs, certifications)
- Handle exit management and full-and-final settlements

**What HR does NOT do:**
- Cannot view or interact with the CRM pipeline, leads, deals, contacts, or companies
- Cannot create or edit client invoices
- Cannot view task boards or project details beyond what involves their own HR onboarding workflows
- Cannot modify workspace settings or user roles

**Data scope:** All employee records, all HRMS sub-modules, HR-scoped document storage, HR-scoped reports, HR-shared calendar (holidays, review cycles).

---

### TEAM_LEAD

**Identity:** Project manager, squad lead, department head, or senior engineer who manages a team of contributors.

**Scope:** Scoped to their assigned team. Can see and manage everything their team members are working on. Cannot see other teams' data, other employees' HR records, or financials.

**Responsibilities:**
- Create and manage projects owned by their team
- Create, assign, update, and prioritise tasks within their team's projects
- Manage sprint planning and sprint boards for their team
- Review and approve time tracking entries submitted by their team
- Approve leave applications submitted by their direct reports
- View attendance summaries for their team members
- View basic employee profiles of team members (name, role, department, contact)
- Export task and project progress reports for their team
- Assign tasks to team members and adjust workloads

**What TEAM_LEAD does NOT do:**
- Cannot view tasks, projects, or boards belonging to other teams
- Cannot view payroll, salary, or financial HR data for any employee (including their own team)
- Cannot create or view CRM leads, deals, or client contacts (unless they also have CRM access granted separately)
- Cannot create or view invoices
- Cannot modify workspace settings, roles, or global configurations
- Cannot approve payroll runs

**Data scope:** Own team's tasks, projects, boards, and time entries. Own team members' basic profiles. Own team members' leave requests. Own team's attendance summary.

---

### EMPLOYEE

**Identity:** Individual contributor, staff member, or any person who is an end-user of the system but not in a management or administrative role.

**Scope:** Strictly self-scoped. Can only see and interact with their own records.

**Responsibilities:**
- View and update tasks assigned to them
- Log time against tasks they are assigned to
- Submit leave applications
- View their own leave balances and leave history
- View their own attendance records
- Download their own payslips
- Update their own employee profile (contact info, emergency contact, address — not role or salary)
- Upload and view their own HR documents (certifications, ID proofs)
- View shared documents they have been explicitly granted access to
- View their own calendar and add personal events or meeting blocks

**What EMPLOYEE does NOT do:**
- Cannot see any other employee's records (HR, payroll, attendance, documents)
- Cannot see any tasks they are not assigned to
- Cannot see any project they are not a member of
- Cannot access the CRM in any capacity
- Cannot create or view invoices
- Cannot export any reports or datasets
- Cannot access Settings, Departments, or any administrative configuration

**Data scope:** Strictly own records only. Zero access to peers' data. Zero access to aggregate reports. Zero access to commercial or financial modules.

---

## Role Quick Reference

| Attribute | SUPER_ADMIN | ADMIN | HR | TEAM_LEAD | EMPLOYEE |
|---|---|---|---|---|---|
| **Module scope** | All modules | CRM + Tasks + Invoice | HRMS only | Tasks (own team) | Self only |
| **Can assign roles** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **CRM access** | Full | Full | None | None | None |
| **HRMS access** | Full | None | Full | Basic (team) | Self only |
| **Invoice access** | Full | Full | None | None | None |
| **Payroll visibility** | Full | None | Full | None | Own payslip |
| **Settings access** | Full | Limited | None | None | None |
| **Audit log access** | Full | None | None | None | None |
| **Max recommended per workspace** | 2 | 5 | 3 | Unlimited | Unlimited |

---

## Role Assignment Rules

1. Every workspace must have at least one active `SUPER_ADMIN` at all times — the system must block deletion of the last SUPER_ADMIN
2. A user's role can only be changed by a `SUPER_ADMIN`
3. A `TEAM_LEAD` is assigned to one or more teams; their scope is defined by those team assignments, not by the role alone
4. An `HR` user can view all employees but cannot view their own payroll configuration (to prevent self-modification of salary)
5. `ADMIN` users cannot elevate themselves to `SUPER_ADMIN` — only an existing `SUPER_ADMIN` can grant that role
6. Role changes take effect immediately and invalidate existing session tokens — the user is forced to re-authenticate
7. A deactivated user retains their role assignment in the database for audit trail purposes but cannot authenticate
