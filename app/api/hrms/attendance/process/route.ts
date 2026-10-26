import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isValidDateString } from "../_lib/helpers";
import { runAttendanceProcessing, MAX_PROCESS_DAYS } from "../_lib/automation";

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const fromDate: string = body.from_date;
  const toDate: string = body.to_date ?? fromDate;
  const employeeId: string | undefined = body.employee_id || undefined;

  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    return NextResponse.json({ error: "from_date and to_date must be valid YYYY-MM-DD dates" }, { status: 400 });
  }
  if (fromDate > toDate) {
    return NextResponse.json({ error: "from_date must be on or before to_date" }, { status: 400 });
  }

  const days = (new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000 + 1;
  if (days > MAX_PROCESS_DAYS) {
    return NextResponse.json({ error: `Date range cannot exceed ${MAX_PROCESS_DAYS} days` }, { status: 400 });
  }

  const admin = adminClient();

  if (employeeId) {
    const { data: emp } = await admin.from("hr_employees").select("id").eq("id", employeeId).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  try {
    const summary = await runAttendanceProcessing(admin, ctx.workspaceId, fromDate, toDate, ctx.userId, employeeId);
    return NextResponse.json({ summary });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
