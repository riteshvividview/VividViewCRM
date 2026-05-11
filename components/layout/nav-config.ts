export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "sales",
    label: "Sales",
    items: [
      { id: "leads", label: "Leads", href: "/dashboard/leads", icon: "UserRoundSearch" },
      { id: "deals", label: "Deals", href: "/dashboard/deals", icon: "Handshake" },
      { id: "contacts", label: "Contacts", href: "/dashboard/contacts", icon: "Users" },
      { id: "companies", label: "Companies", href: "/dashboard/companies", icon: "Building2" },
      { id: "actions", label: "Action Items", href: "/dashboard/actions", icon: "CircleCheck" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      { id: "mailing", label: "Bulk Mailing", href: "/dashboard/mailing", icon: "Mail" },
      { id: "campaigns", label: "Marketing Campaigns", href: "/dashboard/campaigns", icon: "Megaphone" },
    ],
  },
  {
    id: "management",
    label: "Management",
    items: [
      { id: "calendar", label: "Sales Calendar", href: "/dashboard/calendar", icon: "CalendarDays" },
      { id: "teams", label: "Teams & Targets", href: "/dashboard/teams", icon: "Target" },
      { id: "products", label: "Products", href: "/dashboard/products", icon: "Package" },
      { id: "documents", label: "Documents", href: "/dashboard/documents", icon: "FileText" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics & Setup",
    items: [
      { id: "reports", label: "Reports", href: "/dashboard/reports", icon: "BarChart3" },
      { id: "integrations", label: "Integrations", href: "/dashboard/integrations", icon: "Puzzle" },
      { id: "email-settings", label: "Email Settings", href: "/dashboard/email-settings", icon: "Settings2" },
      { id: "settings", label: "Settings", href: "/dashboard/settings", icon: "Settings" },
    ],
  },
];
