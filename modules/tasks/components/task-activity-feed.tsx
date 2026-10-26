"use client";

import { useEffect, useState, useCallback } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TaskComment, TaskActivityEntry, TaskMember, TaskStatus, TaskPriority } from "../types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "../types";
import { AssigneeAvatar } from "./assignee-picker";

interface TaskActivityFeedProps {
  taskId: string;
  currentUserId: string | null;
  /** Bump this (e.g. a digest of status/priority/assignees/labels) to re-fetch after edits made elsewhere in the panel. */
  refreshKey?: string | number;
}

type FeedItem =
  | { kind: "activity"; id: string; created_at: string; entry: TaskActivityEntry }
  | { kind: "comment"; id: string; created_at: string; comment: TaskComment };

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function describeUpdate(newValue: Record<string, unknown>): string[] {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(newValue)) {
    switch (field) {
      case "status":
        parts.push(`changed status to ${STATUS_CONFIG[value as TaskStatus]?.label ?? value}`);
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

function formatActivity(entry: TaskActivityEntry, profiles: Record<string, TaskMember>): string {
  const actor = profiles[entry.actor_id]?.full_name ?? "Someone";
  switch (entry.action) {
    case "created":
      return `${actor} created this task`;
    case "updated": {
      const parts = describeUpdate((entry.new_value ?? {}) as Record<string, unknown>);
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
    case "label_added":
      return `${actor} added the "${entry.new_value?.label_name ?? "label"}" label`;
    case "label_removed":
      return `${actor} removed the "${entry.new_value?.label_name ?? "label"}" label`;
    default:
      return `${actor} ${entry.action.replace(/_/g, " ")}`;
  }
}

/** Combined chronological activity feed (system events + comments) with a comment composer. */
export function TaskActivityFeed({ taskId, currentUserId, refreshKey }: TaskActivityFeedProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, TaskMember>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [commentsRes, activityRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}/comments`),
        fetch(`/api/tasks/${taskId}/activity`),
      ]);
      const commentsJson = await commentsRes.json();
      const activityJson = await activityRes.json();
      if (commentsRes.ok) setComments(commentsJson.comments ?? []);
      if (activityRes.ok) {
        setActivity(activityJson.activity ?? []);
        setProfiles(activityJson.profiles ?? {});
      }
    } catch {}
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function addComment() {
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (res.ok) {
        setComments((p) => [...p, json.comment]);
        setText("");
      }
    } catch {}
    setPosting(false);
  }

  async function deleteComment(commentId: string) {
    setComments((p) => p.filter((c) => c.id !== commentId));
    try {
      await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
    } catch {}
  }

  const items: FeedItem[] = [
    ...activity.map((entry) => ({ kind: "activity" as const, id: `a-${entry.id}`, created_at: entry.created_at, entry })),
    ...comments.map((comment) => ({ kind: "comment" as const, id: `c-${comment.id}`, created_at: comment.created_at, comment })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity</p>

      <div className="space-y-3 mb-3">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && <p className="text-xs text-muted-foreground">No activity yet</p>}

        {items.map((item) => {
          if (item.kind === "activity") {
            return (
              <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                <span>{formatActivity(item.entry, profiles)}</span>
                <span className="text-[10px] text-muted-foreground/70">{formatTimestamp(item.created_at)}</span>
              </div>
            );
          }
          const { comment } = item;
          const isOwn = comment.author?.id === currentUserId;
          return (
            <div key={item.id} className="group flex gap-2">
              {comment.author
                ? <AssigneeAvatar member={comment.author} size="xs" />
                : <div className="w-5 h-5 rounded-full bg-muted shrink-0" />}
              <div className="flex-1">
                <span className="text-xs font-semibold text-foreground">{comment.author?.full_name ?? "Unknown"} </span>
                <span className="text-[10px] text-muted-foreground">{formatTimestamp(comment.created_at)}</span>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{comment.body}</p>
              </div>
              {isOwn && (
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => deleteComment(comment.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Textarea
          className="text-sm flex-1 min-h-[36px] h-9 resize-none py-1.5"
          placeholder="Write a comment… use @Full Name to mention someone"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
        />
        <Button size="sm" className="h-9 bg-purple-600 hover:bg-purple-700 text-white px-3 self-end" onClick={addComment} disabled={!text.trim() || posting}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
