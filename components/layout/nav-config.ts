import type { UserRole } from "@/types";
import { MODULES, type ModuleId } from "@/lib/rbac/modules";

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
export function getNavGroups(allowedModules: Set<ModuleId>, role: UserRole): NavGroup[] {
  const groupMap = new Map<string, NavGroup>();

  for (const mod of MODULES) {
    if (!allowedModules.has(mod.id)) continue;

    let group = groupMap.get(mod.nav.groupId);
    if (!group) {
      group = { id: mod.nav.groupId, label: mod.nav.groupLabel, items: [] };
      groupMap.set(mod.nav.groupId, group);
    }

    for (const item of mod.nav.items) {
      if (group.items.some((i) => i.id === item.id)) continue; // dedup
      const label = item.roleLabels?.[role] ?? item.label;
      group.items.push({ id: item.id, href: item.href, icon: item.icon, label });
    }
  }

  // Account link always shown last
  groupMap.set("account", {
    id: "account",
    label: "Account",
    items: [{ id: "profile", href: "/dashboard/profile", icon: "UserRound", label: "My Profile" }],
  });

  return Array.from(groupMap.values()).filter((g) => g.items.length > 0);
}
