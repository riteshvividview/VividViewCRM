export type NotificationType =
  | "task_assigned"
  | "deal_stage_changed"
  | "lead_assigned"
  | "mention"
  | "event_reminder"
  | "task_due";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}
