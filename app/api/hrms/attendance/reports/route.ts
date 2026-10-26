import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";
import { computeMonthlyReports } from "../_lib/reports";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  const departmentId = request.nextUrl.searchParams.get("department_id");
  const employeeIdFilter = request.nextUrl.searchParams.get("employee_id");

  const nowIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  const year = Number(request.nextUrl.searchParams.get("year")) || Number(nowIST[0]);
  const month = Number(request.nextUrl.searchParams.get("month")) || Number(nowIST[1]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const reports = await computeMonthlyReports(admin, ctx.workspaceId, year, month, {
    departmentId: departmentId || undefined,
    employeeIds: employeeIdFilter ? [employeeIdFilter] : undefined,
  });

  return NextResponse.json({ year, month, reports });
}
