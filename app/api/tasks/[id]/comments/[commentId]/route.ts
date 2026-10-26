import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../../../_lib/helpers";

/** Soft-deletes a comment. Only the author or HR/admin can delete. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const admin = adminClient();

  const { data: comment } = await admin
    .from("task_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .eq("task_id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  if (comment.author_id !== ctx.userId && !isHR(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("task_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
