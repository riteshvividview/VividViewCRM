import type { LucideIcon } from "lucide-react";
import { DollarSign, Phone, Mail, Handshake, Calendar } from "lucide-react";

export type TargetType = "revenue" | "calls" | "emails" | "closures" | "meetings";
export type TargetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
export type MemberRole = "manager" | "senior_rep" | "rep" | "junior_rep";

export interface Target {
  id: string;
  type: TargetType;
  label: string;
  value: number;
  current: number;
  period: TargetPeriod;
  assigned_to: string; // user id or team id
  assigned_type: "team" | "individual";
}

export interface TeamMember {
  id: string;
  team_id: string;
  name: string;
  email: string;
  avatar_initials: string;
  role: MemberRole;
  performance_score: number; // 0–100
  targets: Target[];
  territories: string[];
  calls_made: number;
  emails_sent: number;
  meetings_booked: number;
  deals_closed: number;
  revenue_generated: number;
  rank?: number;
}

export interface Team {
  id: string;
  name: string;
  manager_name: string;
  manager_id: string;
  color: string;
  territory: string;
  members: TeamMember[];
  targets: Target[];
}

export interface Territory {
  id: string;
  name: string;
  city: string;
  state: string;
  assigned_team_id: string | null;
  assigned_member_ids: string[];
}

export const ROLE_CONFIG: Record<MemberRole, { label: string; color: string; bg: string }> = {
  manager:     { label: "Manager",      color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  senior_rep:  { label: "Senior Rep",   color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30" },
  rep:         { label: "Sales Rep",    color: "text-emerald-700 dark:text-emerald-400",bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  junior_rep:  { label: "Junior Rep",   color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800" },
};

export const TARGET_CONFIG: Record<TargetType, { label: string; unit: string; color: string; barColor: string; icon: LucideIcon }> = {
  revenue:   { label: "Revenue",   unit: "₹",  color: "text-emerald-600", barColor: "bg-emerald-500",  icon: DollarSign },
  calls:     { label: "Calls",     unit: "",   color: "text-blue-600",    barColor: "bg-blue-500",     icon: Phone },
  emails:    { label: "Emails",    unit: "",   color: "text-purple-600",  barColor: "bg-purple-500",   icon: Mail },
  closures:  { label: "Closures",  unit: "",   color: "text-pink-600",    barColor: "bg-pink-500",     icon: Handshake },
  meetings:  { label: "Meetings",  unit: "",   color: "text-amber-600",   barColor: "bg-amber-500",    icon: Calendar },
};

export const TERRITORIES: Territory[] = [
  { id: "t1", name: "Hyderabad",   city: "Hyderabad",   state: "Telangana",     assigned_team_id: "tm1", assigned_member_ids: ["m1","m2"] },
  { id: "t2", name: "Mumbai",      city: "Mumbai",      state: "Maharashtra",   assigned_team_id: "tm2", assigned_member_ids: ["m4","m5"] },
  { id: "t3", name: "Bangalore",   city: "Bangalore",   state: "Karnataka",     assigned_team_id: "tm1", assigned_member_ids: ["m3"] },
  { id: "t4", name: "Delhi NCR",   city: "Delhi",       state: "Delhi",         assigned_team_id: "tm3", assigned_member_ids: ["m7","m8"] },
  { id: "t5", name: "Gurugram",    city: "Gurugram",    state: "Haryana",       assigned_team_id: "tm3", assigned_member_ids: ["m9"] },
  { id: "t6", name: "Chennai",     city: "Chennai",     state: "Tamil Nadu",    assigned_team_id: "tm2", assigned_member_ids: ["m6"] },
  { id: "t7", name: "Pune",        city: "Pune",        state: "Maharashtra",   assigned_team_id: null,  assigned_member_ids: [] },
  { id: "t8", name: "Ahmedabad",   city: "Ahmedabad",   state: "Gujarat",       assigned_team_id: null,  assigned_member_ids: [] },
];
