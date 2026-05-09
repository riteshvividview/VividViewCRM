export type EventType = "meeting" | "call" | "demo" | "follow_up" | "deadline";
export type CalendarView = "month" | "week" | "day" | "agenda";

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  attendees: string[];
  linked_entity_type: "lead" | "deal" | "contact" | "company" | null;
  linked_entity_id: string | null;
  linked_entity_name: string | null;
  notes: string;
  video_call_link: string | null;
  created_by: string | null;
  color_override: string | null;
}

export const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; border: string; dot: string }> = {
  meeting:   { label: "Meeting",    color: "text-purple-700 dark:text-purple-300",  bg: "bg-purple-100 dark:bg-purple-900/40",  border: "border-purple-300 dark:border-purple-700", dot: "bg-purple-500" },
  call:      { label: "Call",       color: "text-blue-700 dark:text-blue-300",      bg: "bg-blue-100 dark:bg-blue-900/40",      border: "border-blue-300 dark:border-blue-700",   dot: "bg-blue-500" },
  demo:      { label: "Demo",       color: "text-indigo-700 dark:text-indigo-300",  bg: "bg-indigo-100 dark:bg-indigo-900/40",  border: "border-indigo-300 dark:border-indigo-700", dot: "bg-indigo-500" },
  follow_up: { label: "Follow-up",  color: "text-amber-700 dark:text-amber-300",   bg: "bg-amber-100 dark:bg-amber-900/40",    border: "border-amber-300 dark:border-amber-700",  dot: "bg-amber-500" },
  deadline:  { label: "Deadline",   color: "text-red-700 dark:text-red-300",       bg: "bg-red-100 dark:bg-red-900/40",        border: "border-red-300 dark:border-red-700",      dot: "bg-red-500" },
};

export const TEAM_MEMBERS = [
  { id: "u1", name: "Alex Kumar",  color: "bg-purple-500" },
  { id: "u2", name: "Priya Singh", color: "bg-blue-500" },
  { id: "u3", name: "Sam Tiwari",  color: "bg-emerald-500" },
];
