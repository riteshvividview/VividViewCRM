# Product Overview — VividCRM

## What Is This Product?

VividCRM is a unified business operating system built for small-to-medium businesses (SMBs) and growing agencies. It consolidates four critical operational layers — customer relationship management, project and task execution, human resource management, and financial invoicing — into a single, coherent platform.

Rather than stitching together Salesforce for CRM, Jira or Bordio for tasks, Keka for HR, and Zoho Invoice for billing, businesses using VividCRM operate entirely within one product. Data flows between modules without manual export/import. A lead becomes a deal, a deal spawns a project, a project assigns tasks to employees, those employees have payroll and leave records, and their billable work gets turned into an invoice — all within the same system.

---

## The Problem It Solves

Most SMBs operate with 4–8 disconnected SaaS tools. This creates:

- **Data silos** — a contact exists in 3 places with 3 different states
- **Context switching** — teams juggle tabs constantly
- **Reporting blind spots** — no single source of truth for business health
- **Onboarding friction** — every new hire learns a different tool per department
- **Compounding subscription costs** — $30–$200/month per tool per team

VividCRM eliminates this fragmentation. One login. One database. One permission system. One notification feed.

---

## Who Uses This Product?

### Primary Users by Role

| Role | Who They Are | What They Do in the System |
|---|---|---|
| **SUPER_ADMIN** | Founder / CTO / Platform Owner | Manages workspace settings, module permissions, billing, user provisioning |
| **ADMIN** | Business Owner / Operations Head | Manages CRM pipeline, campaigns, reports, team structure |
| **HR** | HR Manager / People Operations | Manages employees, payroll, leaves, attendance, onboarding |
| **TEAM_LEAD** | Project Manager / Department Head | Manages tasks, sprints, team assignments, performance |
| **EMPLOYEE** | Individual Contributor / Staff | Executes tasks, logs time, applies for leave, views own records |

### Target Businesses

- Digital agencies (10–200 people)
- SaaS startups with internal ops teams
- Consulting firms
- Real estate and proptech companies
- Staffing and recruitment companies
- Any SMB currently using 3+ disconnected tools for CRM + HR + Projects

---

## Core Value Proposition

> **"One platform to sell, deliver, manage, and pay your team — without switching tools."**

1. **Unified data** — contacts, employees, tasks, and invoices share a single relational database
2. **Cross-module workflows** — deals convert to projects; tasks sync to calendars; timesheets feed invoices
3. **Role-aware UX** — every user sees only what their role permits; no information overload
4. **Real-time collaboration** — Socket.IO-powered live updates across boards, comments, and notifications
5. **Async-first operations** — BullMQ handles heavy jobs (payroll runs, PDF generation, email campaigns) in the background without blocking the UI

---

## Product Pillars

### 1. CRM Layer
The commercial engine. Manages the full customer lifecycle from first contact to closed deal. Includes leads, pipeline deals, company and contact records, campaigns, mailing, and reporting.

### 2. Task Management Layer
The execution engine. Inspired by Bordio's clean board-and-calendar paradigm. Manages projects, boards, tasks, subtasks, sprints, time tracking, and team workload. Bridges the gap between a won deal and a delivered product.

### 3. HRMS Layer
The people engine. Inspired by Keka's comprehensive HR suite. Manages the full employee lifecycle — onboarding, attendance, shifts, leaves, payroll, performance, and offboarding. Ensures the workforce powering delivery is well-managed.

### 4. Invoice Layer
The revenue engine. Converts billable work and won deals into professional, GST-compliant invoices. Tracks payment status, generates PDF exports, and feeds revenue data back into reports.

---

## What Makes It Architecturally Sound

- **Next.js 15** frontend with server components for fast initial loads and client components for interactivity
- **NestJS** backend with modular architecture — each domain (CRM, Tasks, HRMS, Invoice) is an isolated NestJS module
- **Prisma + PostgreSQL** for a strongly-typed, relational data layer with full referential integrity across modules
- **Redis + BullMQ** for background job queues: payroll processing, email delivery, PDF generation, notification dispatch
- **Socket.IO** for real-time presence, task board updates, and notification broadcasting
- **TanStack Query** for server-state synchronization with optimistic updates and cache management
- **Shadcn UI + Tailwind** for a consistent, accessible design system that scales across all modules

---

## Product Identity

| Attribute | Value |
|---|---|
| **Product Name** | VividCRM |
| **Category** | Unified Business OS / All-in-One SMB Platform |
| **Deployment** | Web-first (SaaS), self-hostable |
| **Primary Market** | India-first, English-speaking global expansion |
| **Compliance** | GST-ready (India), extensible for VAT/other jurisdictions |
| **Language** | English (i18n-ready architecture) |
