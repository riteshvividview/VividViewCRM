import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, istToday, isValidDateString } from "../_lib/helpers";
import { getOfficeLocations } from "../_lib/geo";

/** HR-only: punch locations for a given date, for the Attendance Map. */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam && isValidDateString(dateParam) ? dateParam : istToday();

  const admin = adminClient();

  const [{ data: records, error }, offices] = await Promise.all([
    admin
      .from("hr_attendance")
      .select(
        "id, employee_id, status, check_in, check_out, check_in_location, check_out_location, work_mode, hr_employees(employee_code, designation, profiles(full_name, avatar_url))"
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("date", date)
      .order("check_in", { ascending: true }),
    getOfficeLocations(admin, ctx.workspaceId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const punches = (records ?? [])
    .filter((r) => r.check_in_location || r.check_out_location)
    .map((r) => ({
      attendance_id: r.id,
      employee_id: r.employee_id,
      employee: r.hr_employees,
      status: r.status,
      work_mode: r.work_mode,
      check_in: r.check_in,
      check_out: r.check_out,
      check_in_location: r.check_in_location,
      check_out_location: r.check_out_location,
    }));

  return NextResponse.json({ date, offices, punches });
}
