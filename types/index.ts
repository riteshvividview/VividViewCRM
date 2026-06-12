export type UserRole = "super_admin" | "hr" | "team_lead" | "employee";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  email: string;
  created_at: string;
  workspace_id: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  owner_id: string;
}

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  group?: string;
};
