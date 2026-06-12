import type { UserRole } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModuleId =
  | "crm_leads" | "crm_deals" | "crm_contacts" | "crm_companies"
  | "crm_mailing" | "crm_campaigns"
  | "mgmt_calendar" | "mgmt_teams" | "mgmt_products" | "mgmt_documents"
  | "hrms_core" | "hrms_attendance" | "hrms_leaves" | "hrms_payroll"
  | "invoices" | "tasks" | "analytics" | "admin_users";

export interface ModuleNavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  roleLabels?: Partial<Record<UserRole, string>>;
}

export interface Module {
  id: ModuleId;
  label: string;         // shown in module manager UI
  group: string;         // grouping in module manager
  routePrefixes: string[]; // all URL prefixes this module protects
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
    id: "crm_leads", label: "Leads", group: "CRM",
    routePrefixes: ["/dashboard/leads"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "leads", href: "/dashboard/leads", icon: "UserRoundSearch", label: "Leads" },
    ]},
  },
  {
    id: "crm_deals", label: "Deals", group: "CRM",
    routePrefixes: ["/dashboard/deals"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "deals", href: "/dashboard/deals", icon: "Handshake", label: "Deals" },
    ]},
  },
  {
    id: "crm_contacts", label: "Contacts", group: "CRM",
    routePrefixes: ["/dashboard/contacts"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "contacts", href: "/dashboard/contacts", icon: "Users", label: "Contacts" },
    ]},
  },
  {
    id: "crm_companies", label: "Companies", group: "CRM",
    routePrefixes: ["/dashboard/companies"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "sales", groupLabel: "Sales", items: [
      { id: "companies", href: "/dashboard/companies", icon: "Building2", label: "Companies" },
    ]},
  },
  {
    id: "crm_mailing", label: "Bulk Mailing", group: "CRM",
    routePrefixes: ["/dashboard/mailing"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "communication", groupLabel: "Communication", items: [
      { id: "mailing", href: "/dashboard/mailing", icon: "Mail", label: "Bulk Mailing" },
    ]},
  },
  {
    id: "crm_campaigns", label: "Marketing Campaigns", group: "CRM",
    routePrefixes: ["/dashboard/campaigns"],
    defaultRoles: ["super_admin", "team_lead"],
    nav: { groupId: "communication", groupLabel: "Communication", items: [
      { id: "campaigns", href: "/dashboard/campaigns", icon: "Megaphone", label: "Marketing Campaigns" },
    ]},
  },

  // ── Management ────────────────────────────────────────────────────────────
  {
    id: "mgmt_calendar", label: "Sales Calendar", group: "Management",
    routePrefixes: ["/dashboard/calendar"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "calendar", href: "/dashboard/calendar", icon: "CalendarDays", label: "Sales Calendar" },
    ]},
  },
  {
    id: "mgmt_teams", label: "Teams & Targets", group: "Management",
    routePrefixes: ["/dashboard/teams"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "teams", href: "/dashboard/teams", icon: "Target", label: "Teams & Targets" },
    ]},
  },
  {
    id: "mgmt_products", label: "Products", group: "Management",
    routePrefixes: ["/dashboard/products"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "management", groupLabel: "Management", items: [
      { id: "products", href: "/dashboard/products", icon: "Package", label: "Products" },
    ]},
  },
  {
    id: "mgmt_documents", label: "Documents", group: "Management",
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
    id: "hrms_core", label: "HRMS (Full Access)", group: "HRMS",
    routePrefixes: ["/dashboard/hrms"],
    defaultRoles: ["super_admin", "hr"],
    nav: { groupId: "hrms", groupLabel: "HRMS", items: [
      { id: "hrms",        href: "/dashboard/hrms",             icon: "LayoutDashboard", label: "HR Dashboard" },
      { id: "employees",   href: "/dashboard/hrms/employees",   icon: "UserRound",       label: "Employees" },
      { id: "departments", href: "/dashboard/hrms/departments", icon: "Building2",       label: "Departments" },
    ]},
  },
  {
    id: "hrms_attendance", label: "Attendance", group: "HRMS",
    routePrefixes: ["/dashboard/hrms/attendance"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms", groupLabel: "HRMS", items: [
      { id: "attendance", href: "/dashboard/hrms/attendance", icon: "Clock", label: "Attendance",
        roleLabels: { employee: "My Attendance", team_lead: "Team Attendance" } },
    ]},
  },
  {
    id: "hrms_leaves", label: "Leave Management", group: "HRMS",
    routePrefixes: ["/dashboard/hrms/leaves"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "hrms", groupLabel: "HRMS", items: [
      { id: "leaves", href: "/dashboard/hrms/leaves", icon: "CalendarOff", label: "Leave Management",
        roleLabels: { employee: "My Leaves", team_lead: "Team Leaves" } },
    ]},
  },
  {
    id: "hrms_payroll", label: "Payroll", group: "HRMS",
    routePrefixes: ["/dashboard/hrms/payroll"],
    defaultRoles: ["super_admin", "hr", "employee"],
    nav: { groupId: "hrms", groupLabel: "HRMS", items: [
      { id: "payroll", href: "/dashboard/hrms/payroll", icon: "Banknote", label: "Payroll",
        roleLabels: { employee: "My Payslips" } },
    ]},
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: "invoices", label: "Invoices", group: "Finance",
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
    id: "tasks", label: "Task Manager", group: "Productivity",
    routePrefixes: ["/dashboard/actions"],
    defaultRoles: ["super_admin", "hr", "team_lead", "employee"],
    nav: { groupId: "tasks", groupLabel: "Tasks", items: [
      { id: "actions", href: "/dashboard/actions", icon: "CircleCheck", label: "Action Items",
        roleLabels: { hr: "My Tasks", employee: "My Tasks" } },
    ]},
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    id: "analytics", label: "Analytics & Reports", group: "Analytics",
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
    id: "admin_users", label: "User Management", group: "Administration",
    routePrefixes: ["/dashboard/users"],
    defaultRoles: ["super_admin"],
    nav: { groupId: "admin", groupLabel: "Administration", items: [
      { id: "users", href: "/dashboard/users", icon: "ShieldCheck", label: "User Management" },
    ]},
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Routes always accessible regardless of module grants
export const UNIVERSAL_DASHBOARD_ROUTES = [
  "/dashboard",
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
  if (UNIVERSAL_DASHBOARD_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  )) return true;

  return MODULES
    .filter((m) => allowedModules.has(m.id))
    .some((m) =>
      m.routePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
      )
    );
}
