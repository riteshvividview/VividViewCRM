import type { SupabaseClient } from "@supabase/supabase-js";

export type StatusKey = "todo" | "in_progress" | "waiting" | "done";

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  position: number;
  status_key: StatusKey;
  is_done_column: boolean;
}

const DEFAULT_COLUMNS: { name: string; color: string; status_key: StatusKey }[] = [
  { name: "To do", color: "#94a3b8", status_key: "todo" },
  { name: "In progress", color: "#3b82f6", status_key: "in_progress" },
  { name: "Waiting", color: "#f59e0b", status_key: "waiting" },
  { name: "Done", color: "#10b981", status_key: "done" },
];

export const COLUMN_SELECT = "id, board_id, name, color, position, status_key, is_done_column";

/**
 * Every project owns one kanban board with custom status columns (Bordio "statuses").
 * Creates the board and the four default columns the first time a project is used.
 */
export async function ensureProjectBoard(
  admin: SupabaseClient,
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<{ boardId: string; columns: BoardColumn[] }> {
  let { data: board } = await admin.from("task_boards").select("id")
    .eq("project_id", projectId).is("archived_at", null).order("position").limit(1).maybeSingle();

  if (!board) {
    const created = await admin.from("task_boards").insert({
      project_id: projectId, workspace_id: workspaceId, name: "Board", type: "kanban",
      owner_id: userId, created_by: userId,
    }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    board = created.data;
  }

  let { data: columns } = await admin.from("task_board_columns").select(COLUMN_SELECT)
    .eq("board_id", board!.id).order("position");
  if (!columns || columns.length === 0) {
    const inserted = await admin.from("task_board_columns").insert(
      DEFAULT_COLUMNS.map((c, i) => ({
        board_id: board!.id, workspace_id: workspaceId, name: c.name, color: c.color,
        position: i, status_key: c.status_key, is_done_column: c.status_key === "done",
      })),
    ).select(COLUMN_SELECT);
    if (inserted.error) throw new Error(inserted.error.message);
    columns = inserted.data;
  }
  return { boardId: board!.id, columns: (columns ?? []) as BoardColumn[] };
}

/** First column of a project board that represents the given base status. */
export function columnForStatus(columns: BoardColumn[], status: StatusKey): BoardColumn | undefined {
  return columns.find((c) => c.status_key === status) ?? columns[0];
}
