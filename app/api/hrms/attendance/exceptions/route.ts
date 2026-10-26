import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isValidDateString } from "../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const status = request.nextUrl.searchParams.get("status") ?? "open";
  const employeeId = request.nextUrl.searchParams.get("employee_id");
  const exceptionType = request.nextUrl.searchParams.get("exception_type");
  const fromDate = request.nextUrl.searchParams.get("from_date");
  const toDate = request.nextUrl.searchParams.get("to_date");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);

  let query = admin
    .from("hr_attendance_exceptions")
    .select(
      "*, hr_employees(employee_code, designation, profiles(full_name, avatar_url)), hr_attendance(date, status, check_in, check_out, late_minutes, early_leave_minutes, overtime_minutes)"
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("date", { ascending: false })
    .limit(limit);

  if (status !== "all" && ["open", "resolved", "ignored"].includes(status)) query = query.eq("status", status);
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (exceptionType) query = query.eq("exception_type", exceptionType);
  if (fromDate && isValidDateString(fromDate)) query = query.gte("date", fromDate);
  if (toDate && isValidDateString(toDate)) query = query.lte("date", toDate);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exceptions: data ?? [] });
}
