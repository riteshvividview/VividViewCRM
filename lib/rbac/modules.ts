import type { UserRole } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModuleId =
  | "crm_leads" | "crm_deals" | "crm_contacts" | "crm_companies"
  | "crm_mailing" | "crm_campaigns"
  | "mgmt_calendar" | "mgmt_teams" | "mgmt_products" | "mgmt_documents"
  | "hrms_core" | "hrms_attendance" | "hrms_leaves" | "hrms_payroll"
  | "hrms_self_service" | "hrms_performance" | "hrms_hiring"
  | "invoices" | "tasks" | "analytics" | "admin_users";

export interface ModuleNavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  roleLabels?: Partial<Record<UserRole, string>>;
}

export type AppId = "hrms" | "tasks" | "crm" | "finance" | "admin";

export interface AppDef {
  id: AppId;
  label: string;
  description: string;
  icon: string;
  accent: string; // tailwind gradient classes
}

// Top-level apps shown on the launcher. Each module belongs to exactly one app,
// and the sidebar only shows the modules of the app the user is currently in.
export const APPS: AppDef[] = [
  { id: "hrms",    label: "HRMS",            description: "Employees, attendance, leave, payroll, performance & hiring", icon: "Users",       accent: "from-purple-600 to-violet-700" },
  { id: "tasks",   label: "Task Management", description: "Projects, boards, calendar and team collaboration",           icon: "CircleCheck", accent: "from-blue-600 to-indigo-700" },
  { id: "crm",     label: "CRM",             description: "Leads, deals, contacts, campaigns and sales teams",            icon: "Handshake",   accent: "from-emerald-600 to-teal-700" },
  { id: "finance", label: "Invoices",        description: "Invoices, payments and billing settings",                      icon: "Receipt",     accent: "from-amber-500 to-orange-600" },
  { id: "admin",   label: "Admin & Reports", description: "Users, roles, reports, integrations and settings",             icon: "ShieldCheck", accent: "from-slate-600 to-slate-800" },
];

export interface Module {
  id: ModuleId;
  app: AppId;
  label: string;         // shown in module manager UI
  group: string;         // grouping in module manager
  routePrefixes: string[]; // all URL prefixes this module protects
  exactRoutes?: string[];  // paths granted exactly (not their sub-paths), e.g. an app's home page
  defaultRoles: UserRole[];
  nav: {
    groupId: string;
    groupLabel: string;
    items: ModuleNavItem[];
  };
}

export interface ModuleOverride {
  module_id: string;
  granted: boolean;
}

// ── Module Registry ───────────────────────────────────────────────────────────
// To add a new module: add ONE entry to this array. Everything else is automatic.
// Route protection, nav generation, and module manager all derive from this list.

export const MODULES: Module[] = [
  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: "crm_leads", label: "Leads", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/leads"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "leads", href: "/dashboard/leads", icon: "UserRoundSearch", label: "Leads" },
    ]},
  },
  {
    id: "crm_deals", label: "Deals", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/deals"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "deals", href: "/dashboard/deals", icon: "Handshake", label: "Deals" },
    ]},
  },
  {
    id: "crm_contacts", label: "Contacts", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/contacts"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "contacts", href: "/dashboard/contacts", icon: "Users", label: "Contacts" },
    ]},
  },
  {
    id: "crm_companies", label: "Companies", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/companies"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "companies", href: "/dashboard/companies", icon: "Building2", label: "Companies" },
    ]},
  },
  {
    id: "crm_mailing", label: "Bulk Mailing", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/mailing"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "communication", groupLabel: "Communication", items: [
      { id: "mailing", href: "/dashboard/mailing", icon: "Mail", label: "Bulk Mailing" },
    ]},
  },
  {
    id: "crm_campaigns", label: "Marketing Campaigns", group: "CRM", app: "crm",
    routePrefixes: ["/dashboard/campaigns"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "communication", groupLabel: "Communication", items: [
      { id: "campaigns", href: "/dashboard/campaigns", icon: "Megaphone", label: "Marketing Campaigns" },
    ]},
  },

  // ── Management ────────────────────────────────────────────────────────────
  {
    id: "mgmt_calendar", label: "Sales Calendar", group: "Management", app: "crm",
    routePrefixes: ["/dashboard/calendar"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "calendar", href: "/dashboard/calendar", icon: "CalendarDays", label: "Sales Calendar" },
    ]},
  },
  {
    id: "mgmt_teams", label: "Teams & Targets", group: "Management", app: "crm",
    routePrefixes: ["/dashboard/teams"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "teams", href: "/dashboard/teams", icon: "Target", label: "Teams & Targets" },
    ]},
  },
  {
    id: "mgmt_products", label: "Products", group: "Management", app: "crm",
    routePrefixes: ["/dashboard/products"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "products", href: "/dashboard/products", icon: "Package", label: "Products" },
    ]},
  },
  {
    id: "mgmt_documents", label: "Documents", group: "Management", app: "crm",
    routePrefixes: ["/dashboard/documents"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "documents", href: "/dashboard/documents", icon: "FileText", label: "Documents" },
    ]},
  },

  // ── HRMS ──────────────────────────────────────────────────────────────────
  // hrms_core covers /dashboard/hrms/* broadly (HR Dashboard, Employees, Departments).
  // Sub-modules below grant specific sub-paths to roles that don't have hrms_core.
  // Example: employees get hrms_attendance but NOT hrms_core, so they can't see /dashboard/hrms.
  {
    id: "hrms_self_service", app: "hrms", label: "Employee Self-Service", group: "HRMS",
    exactRoutes: ["/dashboard/hrms"],
    routePrefixes: [
      "/dashboard/hrms/me", "/dashboard/hrms/comp-off", "/dashboard/hrms/tax",
      "/dashboard/hrms/org-chart", "/dashboard/hrms/announcements", "/dashboard/hrms/expenses",
      "/dashboard/hrms/loans", "/dashboard/hrms/helpdesk", "/dashboard/hrms/payslips", "/dashboard/hrms/exits",
    ],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms_engage", groupLabel: "Me & Requests", items: [
      { id: "hrms-home",     href: "/dashboard/hrms",               icon: "Home",       label: "Home" },
      { id: "hrms-me",       href: "/dashboard/hrms/me",            icon: "UserRound",  label: "My HR Profile" },
      { id: "announcements", href: "/dashboard/hrms/announcements", icon: "Megaphone",  label: "Announcements" },
      { id: "org-chart",     href: "/dashboard/hrms/org-chart",     icon: "Network",    label: "Org Chart" },
      { id: "expenses",      href: "/dashboard/hrms/expenses",      icon: "Receipt",    label: "Expenses",
        roleLabels: { employee: "My Expenses", team_lead: "My Expenses" } },
      { id: "comp-off",      href: "/dashboard/hrms/comp-off",      icon: "CalendarOff", label: "Comp-off" },
      { id: "tax",           href: "/dashboard/hrms/tax",           icon: "FileText",   label: "Tax & Investments" },
      { id: "loans",         href: "/dashboard/hrms/loans",         icon: "HandCoins",  label: "Loans & Advances" },
      { id: "helpdesk",      href: "/dashboard/hrms/helpdesk",      icon: "LifeBuoy",   label: "Helpdesk" },
      { id: "exits",         href: "/dashboard/hrms/exits",         icon: "LogOut",     label: "Exits & F&F",
        roleLabels: { employee: "Resignation", team_lead: "Resignation" } },
    ]},
  },
  {
    id: "hrms_attendance", label: "Attendance", group: "HRMS", app: "hrms",
    routePrefixes: ["/dashboard/hrms/attendance"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms_time", groupLabel: "Time & Pay", items: [
      { id: "attendance", href: "/dashboard/hrms/attendance", icon: "Clock", label: "Attendance",
        roleLabels: { employee: "My Attendance", team_lead: "Team Attendance" } },
    ]},
  },
  {
    id: "hrms_leaves", label: "Leave Management", group: "HRMS", app: "hrms",
    routePrefixes: ["/dashboard/hrms/leaves"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms_time", groupLabel: "Time & Pay", items: [
      { id: "leaves", href: "/dashboard/hrms/leaves", icon: "CalendarOff", label: "Leave Management",
        roleLabels: { employee: "My Leaves", team_lead: "Team Leaves" } },
    ]},
  },
  {
    id: "hrms_payroll", label: "Payroll", group: "HRMS", app: "hrms",
    routePrefixes: ["/dashboard/hrms/payroll"],
    defaultRoles: ["super_admin", "hr", "employee"],
    nav: { groupId: "hrms_time", groupLabel: "Time & Pay", items: [
      { id: "payroll", href: "/dashboard/hrms/payroll", icon: "Banknote", label: "Payroll",
        roleLabels: { employee: "My Payslips" } },
    ]},
  },
  {
    id: "hrms_performance", app: "hrms", label: "Performance", group: "HRMS",
    routePrefixes: ["/dashboard/hrms/goals", "/dashboard/hrms/reviews", "/dashboard/hrms/praise"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms_performance", groupLabel: "Performance", items: [
      { id: "goals",   href: "/dashboard/hrms/goals",   icon: "Target", label: "Goals & OKRs" },
      { id: "reviews", href: "/dashboard/hrms/reviews", icon: "Star",   label: "Reviews" },
      { id: "praise",  href: "/dashboard/hrms/praise",  icon: "Award",  label: "Praise & Feedback" },
    ]},
  },
  {
    id: "hrms_core", label: "HRMS (Full Access)", group: "HRMS", app: "hrms",
    routePrefixes: ["/dashboard/hrms"],
    defaultRoles: ["super_admin", "hr"],
    nav: { groupId: "hrms", groupLabel: "Core HR", items: [
      { id: "employees",   href: "/dashboard/hrms/employees",   icon: "UserRound",       label: "Employees" },
      { id: "departments", href: "/dashboard/hrms/departments", icon: "Building2",       label: "Departments" },
      { id: "assets",      href: "/dashboard/hrms/assets",      icon: "Laptop",          label: "Assets" },
    ]},
  },
  {
    id: "hrms_hiring", app: "hrms", label: "Hiring & Onboarding", group: "HRMS",
    routePrefixes: ["/dashboard/hrms/recruitment", "/dashboard/hrms/onboarding"],
    defaultRoles: ["super_admin", "hr"],
    nav: { groupId: "hrms_hiring", groupLabel: "Hiring", items: [
      { id: "recruitment", href: "/dashboard/hrms/recruitment", icon: "Briefcase",      label: "Recruitment" },
      { id: "onboarding",  href: "/dashboard/hrms/onboarding",  icon: "ClipboardCheck", label: "On/Offboarding" },
    ]},
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: "invoices", label: "Invoices", group: "Finance", app: "finance",
    routePrefixes: ["/dashboard/invoices"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "invoices", groupLabel: "Invoices", items: [
      { id: "invoices",         href: "/dashboard/invoices",          icon: "Receipt",   label: "All Invoices" },
      { id: "new-invoice",      href: "/dashboard/invoices/new",      icon: "FilePlus",  label: "New Invoice" },
      { id: "invoice-settings", href: "/dashboard/invoices/settings", icon: "Settings2", label: "Invoice Settings" },
    ]},
  },

  // ── Productivity ──────────────────────────────────────────────────────────
  {
    id: "tasks", label: "Task Manager", group: "Productivity", app: "tasks",
    routePrefixes: ["/dashboard/actions"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "tasks", groupLabel: "Tasks", items: [
      { id: "actions", href: "/dashboard/actions", icon: "CircleCheck", label: "Action Items",
        roleLabels: { hr: "My Tasks", employee: "My Tasks" } },
    ]},
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    id: "analytics", label: "Analytics & Reports", group: "Analytics", app: "admin",
    routePrefixes: ["/dashboard/reports", "/dashboard/integrations", "/dashboard/email-settings"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "analytics", groupLabel: "Analytics & Setup", items: [
      { id: "reports",        href: "/dashboard/reports",        icon: "BarChart3", label: "Reports" },
      { id: "integrations",   href: "/dashboard/integrations",   icon: "Puzzle",    label: "Integrations" },
      { id: "email-settings", href: "/dashboard/email-settings", icon: "Settings2", label: "Email Settings" },
      { id: "settings",       href: "/dashboard/settings",       icon: "Settings",  label: "Settings" },
    ]},
  },

  // ── Administration ────────────────────────────────────────────────────────
  {
    id: "admin_users", label: "User Management", group: "Administration", app: "admin",
    routePrefixes: ["/dashboard/users"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "admin", groupLabel: "Administration", items: [
      { id: "users", href: "/dashboard/users", icon: "ShieldCheck", label: "User Management" },
    ]},
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Routes always accessible regardless of module grants
// "/dashboard" itself (the app launcher) is matched exactly, not as a prefix.
export const UNIVERSAL_DASHBOARD_ROUTES = [
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/access-denied",
];

export function getEffectiveModules(
  role: UserRole,
  overrides: ModuleOverride[]
): Set<ModuleId> {
  const effective = new Set<ModuleId>(
    MODULES.filter((m) => m.defaultRoles.includes(role)).map((m) => m.id)
  );

  for (const override of overrides) {
    const id = override.module_id as ModuleId;
    if (override.granted) {
      effective.add(id);
    } else {
      effective.delete(id);
    }
  }

  return effective;
}

export function canAccessRoute(
  allowedModules: Set<ModuleId>,
  pathname: string
): boolean {
  if (pathname === "/dashboard") return true;
  if (UNIVERSAL_DASHBOARD_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  )) return true;

  return MODULES
    .filter((m) => allowedModules.has(m.id))
    .some((m) =>
      (m.exactRoutes ?? []).includes(pathname) ||
      m.routePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
      )
    );
}

// Which app a pathname belongs to (longest matching module prefix wins).
export function getAppForPath(pathname: string): AppId | null {
  let best: { app: AppId; len: number } | null = null;
  for (const m of MODULES) {
    for (const prefix of m.routePrefixes) {
      if ((pathname === prefix || pathname.startsWith(prefix + "/")) && (!best || prefix.length > best.len)) {
        best = { app: m.app, len: prefix.length };
      }
    }
  }
  return best?.app ?? null;
}

export function getAllowedApps(allowedModules: Set<ModuleId>): AppDef[] {
  return APPS.filter((a) => MODULES.some((m) => m.app === a.id && allowedModules.has(m.id)));
}

// First nav href of an app the user can access — the app's entry point.
export function getAppHome(appId: AppId, allowedModules: Set<ModuleId>): string | null {
  const mod = MODULES.find((m) => m.app === appId && allowedModules.has(m.id));
  return mod?.nav.items[0]?.href ?? null;
}
