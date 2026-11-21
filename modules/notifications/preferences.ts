import type { Notification } from "./types";

/** The kinds of task notification a person can switch on or off. */
export type NotificationCategory =
  | "task_assigned" | "task_status" | "task_completed" | "task_deleted" | "task_deadlines" | "task_messages" | "task_mentions"
  // CEO only: the whole workspace, not "your tasks"
  | "task_on_hold" | "hold_summary" | "ceo_created" | "ceo_completed" | "ceo_overdue";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "task_assigned", "task_status", "task_completed", "task_deleted", "task_deadlines", "task_messages", "task_mentions",
  "task_on_hold", "hold_summary", "ceo_created", "ceo_completed", "ceo_overdue",
];

/**
 * Notification preferences. Saved on the user's account (so they follow the
 * person to any device) and mirrored in the browser for instant reads.
 * Each category has an in-app switch (bell, popup, sound) and a browser-alert switch.
 */
export interface NotificationPrefs {
  /** Master switch: off silences everything. */
  all: boolean;
  task_assigned: boolean;
  task_messages: boolean;
  task_status: boolean;
  task_mentions: boolean;
  task_deadlines: boolean;
  task_completed: boolean;
  task_deleted: boolean;
  /** CEO: someone put a task on hold. */
  task_on_hold: boolean;
  /** CEO: the Monday summary of tasks on hold. */
  hold_summary: boolean;
  /** CEO: anyone created a task. */
  ceo_created: boolean;
  /** CEO: anyone completed a task. */
  ceo_completed: boolean;
  /** CEO: once a day, how many tasks are overdue across the workspace. */
  ceo_overdue: boolean;
  /** Desktop alerts from the browser while the app is in the background, per category. */
  browser: Record<NotificationCategory, boolean>;
  /** Show the popup in the corner (the bell still collects notifications when off). */
  popups: boolean;
  sound: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  all: true,
  task_assigned: true,
  task_messages: true,
  task_status: true,
  task_mentions: true,
  task_deadlines: true,
  task_completed: true,
  task_deleted: true,
  task_on_hold: true,
  hold_summary: true,
  ceo_created: false,
  ceo_completed: true,
  ceo_overdue: true,
  browser: {
    task_assigned: true, task_status: false, task_completed: false, task_deleted: false, task_deadlines: false, task_messages: true, task_mentions: true,
    task_on_hold: true, hold_summary: false, ceo_created: false, ceo_completed: false, ceo_overdue: false,
  },
  popups: true,
  sound: true,
};

const KEY = "vividview-notification-prefs";
export const NOTIFICATION_PREFS_EVENT = "notification-prefs:changed";

/** Fills in defaults for anything missing (also used on the server with the saved account copy). */
export const normalizeNotificationPrefs = (p: Partial<NotificationPrefs> | null | undefined): NotificationPrefs =>
  ({ ...DEFAULT_NOTIFICATION_PREFS, ...(p ?? {}), browser: { ...DEFAULT_NOTIFICATION_PREFS.browser, ...(p?.browser ?? {}) } });

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeNotificationPrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

/** Updates the browser copy (used after loading the account's saved values). */
export function cacheNotificationPrefs(prefs: Partial<NotificationPrefs>) {
  try { localStorage.setItem(KEY, JSON.stringify(normalizeNotificationPrefs(prefs))); } catch {}
  window.dispatchEvent(new Event(NOTIFICATION_PREFS_EVENT));
}

/** Saves to the browser and to the user's account. */
export function saveNotificationPrefs(prefs: NotificationPrefs) {
  cacheNotificationPrefs(prefs);
  import("@/lib/user-prefs").then((m) => m.saveAccountMeta({ notification_prefs: prefs })).catch(() => {});
}

/** Which preference a notification falls under (null = always shown, e.g. HR notices). */
export function notificationCategory(n: Pick<Notification, "type" | "entity_type">): NotificationCategory | null {
  if (n.entity_type === "task_ceo_created") return "ceo_created";
  if (n.entity_type === "task_ceo_completed") return "ceo_completed";
  if (n.entity_type === "ceo_overdue") return "ceo_overdue";
  if (n.type === "task_on_hold") return "task_on_hold";
  if (n.type === "hold_digest") return "hold_summary";
  if (n.type === "task_resumed") return "task_status";
  if (n.type === "mention") return "task_mentions";
  if (n.type === "task_due") return "task_deadlines";
  if (n.type === "task_completed") return "task_completed";
  if (n.type === "task_assigned") {
    if (n.entity_type === "task_message") return "task_messages";
    if (n.entity_type === "task_deleted") return "task_deleted";
    if (n.entity_type === "task_status" || n.entity_type === "task_update") return "task_status";
    return "task_assigned";
  }
  return null;
}

export function notificationAllowed(prefs: NotificationPrefs, n: Pick<Notification, "type" | "entity_type">): boolean {
  if (!prefs.all) return false;
  const category = notificationCategory(n);
  return category ? prefs[category] : true;
}

/** Whether this notification should also raise a desktop alert from the browser. */
export function browserAlertAllowed(prefs: NotificationPrefs, n: Pick<Notification, "type" | "entity_type">): boolean {
  if (!notificationAllowed(prefs, n)) return false;
  const category = notificationCategory(n);
  return category ? !!prefs.browser[category] : false;
}
