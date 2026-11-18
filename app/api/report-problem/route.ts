import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/app/api/tasks/_lib/helpers";
import { hasFeature } from "@/lib/dev/server";
import { caller } from "../dev/_lib";

/** POST { page_path, page_title, message }: someone reports a problem on the page they're on. */
export async function POST(request: NextRequest) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = adminClient();
  if (!(await hasFeature(admin, me.userId, "report_problem"))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const message = typeof b.message === "string" ? b.message.trim() : "";
  const path = typeof b.page_path === "string" ? b.page_path.slice(0, 500) : "";
  if (!message) return NextResponse.json({ error: "Please describe the problem" }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "Please keep it under 4000 characters" }, { status: 400 });
  if (!path.startsWith("/")) return NextResponse.json({ error: "Missing page" }, { status: 400 });

  const { error } = await admin.from("bug_reports").insert({
    workspace_id: me.workspaceId, user_id: me.userId, page_path: path,
    page_title: typeof b.page_title === "string" ? b.page_title.slice(0, 200) : null, message,
  });
  if (error) return NextResponse.json({ error: "Could not send. Please try again." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
