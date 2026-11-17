# Apps by user

Which apps each account sees in Vivid View, as of 16 November 2026.
Logins are in `DEMO-LOGINS.local.md`.

## Status of every app

| App | Status | What users see |
|---|---|---|
| Task Management | Live | Opens normally |
| HRMS | Coming soon | Greyed "Coming soon" card on the home screen; every HRMS page shows a "HRMS is on its way" notice |
| CRM | Switched off | Not shown anywhere; its pages show "Access denied" |
| Invoices | Switched off | Not shown anywhere; its pages show "Access denied" |
| User Management | Live, CEO only | Opens normally for the CEO; nobody else sees it |
| Reports, Integrations, Email settings | Switched off | Not shown anywhere; their pages show "Access denied" |

## What each user sees

| User | Role | Email | Home screen | Sidebar |
|---|---|---|---|---|
| Demo Admin | CEO (super admin) | admin@vividview.test | Task Management, User Management, HRMS (coming soon) | Task Management, User Management |
| Demo Manager | Team lead | manager@vividview.test | Task Management, HRMS (coming soon) | Task Management |
| Demo HR | HR | hr@vividview.test | HRMS (coming soon) only | No apps |
| Demo Employee | Employee | employee@vividview.test | Task Management, HRMS (coming soon) | Task Management |
| Demo Employee 2 | Employee | employee2@vividview.test | Task Management, HRMS (coming soon) | Task Management |

HR does not get Task Management by default. The CEO can change that in
Task Management → Settings → "HR access to Tasks" (No access / View only / Full access).

Everyone also has **My Profile** and personal **Settings** (appearance, notifications, password).

## Inside Task Management

| Can do | CEO | Team lead | Employee | HR (if the CEO allows) |
|---|---|---|---|---|
| See My work, Schedule, Tasks, Team, Brands | Yes | Yes | Yes | Yes |
| Create tasks, upload brief and reference files, chat | Yes | Yes | Yes | Full access only |
| Submit the main file and complete a task | Yes | Yes | Assignees and the creator | Full access only |
| Create and edit brands | Yes | Yes | No | No |
| Create and edit teams (people in each team) | Yes | Yes | No | No |
| Storage: browse, search, filter, preview, download, rename, move and delete every file in Cloudflare | Yes | No | No | No |
| Task settings and User Management | Yes | No | No | No |
| See tasks of a team | Team members, leads, creator and assignees | | | |
| Manage task types | Yes | Yes | No | No |
| Delete a task | Yes | Yes | Own tasks, unless the CEO sets "Leads only" | No |
| Open Task settings (file cleanup, HR access, delete rule) | Yes | No | No | No |

## Things that are off for everyone

- CRM: leads, deals, contacts, companies, bulk mailing, campaigns, sales calendar, teams and targets, products, documents.
- Invoices: invoices, payments, invoice settings.
- Reports, integrations and email settings (the rest of the old "Admin & Reports" app).
- The CEO's overview dashboard under the home screen (it showed CRM sample figures).

## User Management (CEO only)

The CEO adds people, changes their role and controls which apps they can open from
the **User Management** app. Switched-off apps stay off for everyone even if a user
is granted them there.

## Turning an app back on

Each app has one line in `lib/rbac/modules.ts` (the `APPS` list):

- `hidden: true` means switched off for everyone. Remove it to bring the app back for the roles that had it.
  A single part of an app can carry the same flag in the `MODULES` list below it (Reports does).
- `comingSoon: true` means shown as "Coming soon". Remove it to open the app.

Switched-off apps keep their code and data. They load nothing and run no database
queries unless someone opens one of their pages.
