export type InboxTag = "hot_lead" | "needs_follow_up" | "not_interested" | "replied" | null;
export type MessageDirection = "inbound" | "outbound";

export interface InboxMessage {
  id: string;
  thread_id: string;
  from_name: string;
  from_email: string;
  body: string;
  direction: MessageDirection;
  created_at: string;
}

export interface InboxThread {
  id: string;
  contact_id: string | null;
  contact_name: string;
  contact_email: string;
  avatar_initials: string;
  subject: string;
  last_message: string;
  unread: boolean;
  tag: InboxTag;
  assigned_to: string | null;
  messages: InboxMessage[];
  created_at: string;
  updated_at: string;
}

export const TAG_CONFIG: Record<Exclude<InboxTag, null>, { label: string; color: string; bg: string }> = {
  hot_lead:        { label: "Hot Lead",        color: "text-red-700 dark:text-red-400",     bg: "bg-red-100 dark:bg-red-900/30" },
  needs_follow_up: { label: "Follow-up",       color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  not_interested:  { label: "Not Interested",  color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
  replied:         { label: "Replied",         color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
};
