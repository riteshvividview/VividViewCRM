import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadProject } from "../../_lib";
import { signedUrls, type FileStore } from "../../../_lib/files";

/** Brand archive: every brief and main file of the brand's tasks, newest first, with download links. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadProject(id);
  if ("error" in r) return r.error;

  const { data: tasks } = await r.admin.from("tasks").select("id, title, number, status, created_at, completed_at")
    .eq("project_id", id).eq("workspace_id", r.ctx.workspaceId);
  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
  if (!taskById.size) return NextResponse.json({ files: [] });

  const { data, error } = await r.admin.from("task_attachments")
    .select("id, task_id, kind, storage, file_path, file_name, size_bytes, mime_type, link_url, created_at")
    .in("task_id", [...taskById.keys()]).in("kind", ["brief", "main"]).is("purged_at", null)
    .order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const urls = await signedUrls(r.admin, (data ?? []) as { file_path: string | null; storage: FileStore }[]);
  return NextResponse.json({
    files: (data ?? []).map(({ file_path, ...f }) => {
      const t = taskById.get(f.task_id)!;
      return {
        ...f, url: f.link_url ?? (file_path ? urls.get(file_path) ?? null : null),
        task_title: t.title, task_number: t.number, task_done: t.status === "done",
        month: (t.created_at as string).slice(0, 7),
      };
    }),
  });
}
