import type { TaskActivityEntry, TaskMember, TaskStatus, TaskPriority } from "../types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "../types";

// Internal bookkeeping fields never shown in the activity feed.
const HIDDEN_FIELDS = new Set(["updated_at", "board_id", "board_column_id", "completed_at", "position", "started_at", "assignee_id", "assignee_name"]);

function describeUpdate(newValue: Record<string, unknown>, metadata?: Record<string, unknown> | null): string[] {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(newValue)) {
    if (HIDDEN_FIELDS.has(field)) continue;
    switch (field) {
      case "status":
        parts.push(`changed the task status to ${(metadata?.column_name as string) ?? STATUS_CONFIG[value as TaskStatus]?.label ?? value}`);
        break;
      case "planned_date":
        parts.push(value ? `scheduled the task for ${new Date(value as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "moved the task to the waiting list");
        break;
      case "type_id":
        parts.push(`changed the type${metadata?.type_name ? ` to ${metadata.type_name}` : ""}`);
        break;
      case "project_id":
        parts.push("moved the task to another project");
        break;
      case "color":
        parts.push("changed the colour");
        break;
      case "priority":
        parts.push(`changed priority to ${PRIORITY_CONFIG[value as TaskPriority]?.label ?? value}`);
        break;
      case "due_date":
        parts.push(value ? `set due date to ${new Date(value as string).toLocaleDateString()}` : "cleared the due date");
        break;
      case "title":
        parts.push(`renamed the task to "${value}"`);
        break;
      case "description":
        parts.push("updated the description");
        break;
      case "estimated_hours":
        parts.push(value != null ? `set estimated time to ${value}h` : "cleared the estimated time");
        break;
      case "actual_hours":
        parts.push(`logged ${value}h`);
        break;
      case "start_date":
        parts.push(value ? `set start date to ${new Date(value as string).toLocaleDateString()}` : "cleared the start date");
        break;
      case "story_points":
        parts.push(`set story points to ${value}`);
        break;
      case "recurring_pattern":
        parts.push(value ? `set this task to repeat ${value}` : "removed the recurrence");
        break;
      case "sub_tasks":
        parts.push("updated the sub-tasks");
        break;
      case "tags":
        parts.push("updated the tags");
        break;
      case "completed_at":
        break;
      default:
        parts.push(`updated ${field.replace(/_/g, " ")}`);
    }
  }
  return parts;
}

export function formatActivity(entry: TaskActivityEntry, profiles: Record<string, TaskMember>): string {
  const actor = profiles[entry.actor_id]?.full_name ?? "Someone";
  switch (entry.action) {
    case "created":
      return `${actor} created this task`;
    case "updated": {
      const parts = describeUpdate((entry.new_value ?? {}) as Record<string, unknown>, entry.metadata as Record<string, unknown> | null);
      return parts.length > 0 ? `${actor} ${parts.join(" and ")}` : `${actor} updated this task`;
    }
    case "assignee_added": {
      const ids = (entry.new_value?.user_ids ?? []) as string[];
      const names = ids.map((uid) => profiles[uid]?.full_name ?? "someone").join(", ");
      return `${actor} assigned ${names || "someone"}`;
    }
    case "assignee_removed": {
      const uid = entry.new_value?.user_id as string | undefined;
      return `${actor} removed ${uid ? (profiles[uid]?.full_name ?? "someone") : "someone"} from assignees`;
    }
    case "attachment_added": {
      const files = ((entry.metadata?.files ?? []) as string[]).join(", ");
      return `${actor} attached ${files || "a file"}`;
    }
    case "label_added":
      return `${actor} added the "${entry.new_value?.label_name ?? "label"}" label`;
    case "label_removed":
      return `${actor} removed the "${entry.new_value?.label_name ?? "label"}" label`;
    default:
      return `${actor} ${entry.action.replace(/_/g, " ")}`;
  }
}
