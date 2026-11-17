import type { UserRole } from "@/types";
import { MODULES, getAllowedApps, getAppHome, isComingSoonApp, isModuleOff, type AppId, type ModuleId } from "@/lib/rbac/modules";

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

// Build nav dynamically from the module registry filtered by the user's effective modules.
// Role-specific labels (e.g. "My Attendance" for employee) are applied here.
// Pass `app` to restrict the nav to a single app (the sidebar does this); omit it for all apps.
// When `app` is null (launcher, profile) the nav lists the apps themselves.
export function getNavGroups(allowedModules: Set<ModuleId>, role: UserRole, app?: AppId | null): NavGroup[] {
  const groupMap = new Map<string, NavGroup>();

  if (app === null) {
    groupMap.set("apps", {
      id: "apps",
      label: "Apps",
      items: [
        { id: "launcher", href: "/dashboard", icon: "LayoutGrid", label: "All Apps" },
        ...getAllowedApps(allowedModules).map((a) => ({
          id: "app-" + a.id, href: getAppHome(a.id, allowedModules) ?? "/dashboard", icon: a.icon, label: a.label,
        })),
      ],
    });
  }

  for (const mod of MODULES) {
    if (app !== undefined && mod.app !== app) continue;
    if (!allowedModules.has(mod.id)) continue;
    if (isComingSoonApp(mod.app) || isModuleOff(mod)) continue; // unreleased / switched-off apps have no menu

    let group = groupMap.get(mod.nav.groupId);
    if (!group) {
      group = { id: mod.nav.groupId, label: mod.nav.groupLabel, items: [] };
      groupMap.set(mod.nav.groupId, group);
    }

    for (const item of mod.nav.items) {
      if (group.items.some((i) => i.id === item.id)) continue; // dedup
      if (item.roles && !item.roles.includes(role)) continue;
      const label = item.roleLabels?.[role] ?? item.label;
      group.items.push({ id: item.id, href: item.href, icon: item.icon, label });
    }
  }

  // Account link always shown last
  groupMap.set("account", {
    id: "account",
    label: "Account",
    items: [{ id: "profile", href: "/dashboard/settings", icon: "UserRound", label: "Profile settings" }],
  });

  return Array.from(groupMap.values()).filter((g) => g.items.length > 0);
}
