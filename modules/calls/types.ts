export type CallDirection = "inbound" | "outbound";
export type CallOutcome = "answered" | "voicemail" | "no_answer" | "busy";

export interface CallLog {
  id: string;
  contact_id: string | null;
  contact_name: string;
  phone_number: string;
  duration: number; // seconds
  direction: CallDirection;
  outcome: CallOutcome;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export const OUTCOME_CONFIG: Record<CallOutcome, { label: string; color: string; bg: string; icon: string }> = {
  answered:  { label: "Answered",   color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: "✅" },
  voicemail: { label: "Voicemail",  color: "text-blue-700 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30",       icon: "📱" },
  no_answer: { label: "No Answer",  color: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-900/30",     icon: "📵" },
  busy:      { label: "Busy",       color: "text-red-700 dark:text-red-400",         bg: "bg-red-100 dark:bg-red-900/30",         icon: "🔴" },
};

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
