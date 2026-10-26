import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR } from "../_lib/helpers";

interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  captured_at: string;
  distance_meters: number | null;
  zone: "office" | "remote" | null;
}

/** HR-only: monthly geo-fencing report — per-employee office/remote attendance
 *  breakdown plus a detail list of remote-attendance records. */
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

  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  let employeeQuery = admin
    .from("hr_employees")
    .select("id, employee_code, designation, department_id, hr_departments!department_id(name), profiles(full_name, avatar_url)")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "active")
    .order("employee_code");
  if (departmentId) employeeQuery = employeeQuery.eq("department_id", departmentId);
  if (employeeIdFilter) employeeQuery = employeeQuery.eq("id", employeeIdFilter);

  const { data: employees, error: empError } = await employeeQuery;
  if (empError) return NextResponse.json({ error: empError.message }, { status: 400 });
  if (!employees || employees.length === 0) {
    return NextResponse.json({
      year, month, summary: [], remote_records: [],
      totals: { gps_days: 0, office_days: 0, remote_days: 0, remote_percentage: 0 },
    });
  }

  const employeeIds = employees.map((e) => e.id);

  const { data: attendance, error: attError } = await admin
    .from("hr_attendance")
    .select("id, employee_id, date, status, check_in, check_out, check_in_location, check_out_location")
    .eq("workspace_id", ctx.workspaceId)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .in("employee_id", employeeIds)
    .order("date", { ascending: true });

  if (attError) return NextResponse.json({ error: attError.message }, { status: 400 });

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const statsByEmployee = new Map<string, {
    gps_days: number; office_days: number; remote_days: number; no_zone_days: number;
    distance_sum: number; distance_count: number;
  }>();
  for (const e of employees) {
    statsByEmployee.set(e.id, { gps_days: 0, office_days: 0, remote_days: 0, no_zone_days: 0, distance_sum: 0, distance_count: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remoteRecords: any[] = [];

  for (const a of attendance ?? []) {
    const checkInLoc = a.check_in_location as PunchLocation | null;
    const checkOutLoc = a.check_out_location as PunchLocation | null;
    if (!checkInLoc && !checkOutLoc) continue;

    const zone = checkInLoc?.zone ?? checkOutLoc?.zone ?? null;
    const distance = checkInLoc?.distance_meters ?? checkOutLoc?.distance_meters ?? null;
    const address = checkInLoc?.address ?? checkOutLoc?.address ?? null;

    const stats = statsByEmployee.get(a.employee_id);
    if (stats) {
      stats.gps_days++;
      if (zone === "office") stats.office_days++;
      else if (zone === "remote") stats.remote_days++;
      else stats.no_zone_days++;
      if (distance !== null && distance !== undefined) {
        stats.distance_sum += distance;
        stats.distance_count++;
      }
    }

    if (zone === "remote") {
      const emp = employeeById.get(a.employee_id);
      remoteRecords.push({
        attendance_id: a.id,
        date: a.date,
        employee: emp
          ? { id: emp.id, employee_code: emp.employee_code, designation: emp.designation, department: emp.hr_departments, profile: emp.profiles }
          : null,
        status: a.status,
        check_in: a.check_in,
        check_out: a.check_out,
        check_in_zone: checkInLoc?.zone ?? null,
        check_out_zone: checkOutLoc?.zone ?? null,
        distance_meters: distance,
        address,
      });
    }
  }

  const summary = employees.map((e) => {
    const s = statsByEmployee.get(e.id)!;
    return {
      employee: { id: e.id, employee_code: e.employee_code, designation: e.designation, department: e.hr_departments, profile: e.profiles },
      gps_days: s.gps_days,
      office_days: s.office_days,
      remote_days: s.remote_days,
      no_zone_days: s.no_zone_days,
      remote_percentage: s.gps_days > 0 ? Math.round((s.remote_days / s.gps_days) * 1000) / 10 : 0,
      avg_distance_meters: s.distance_count > 0 ? Math.round(s.distance_sum / s.distance_count) : null,
    };
  });

  const totals = summary.reduce(
    (acc, s) => ({
      gps_days: acc.gps_days + s.gps_days,
      office_days: acc.office_days + s.office_days,
      remote_days: acc.remote_days + s.remote_days,
    }),
    { gps_days: 0, office_days: 0, remote_days: 0 }
  );

  return NextResponse.json({
    year,
    month,
    summary,
    remote_records: remoteRecords.sort((a, b) => (b.date as string).localeCompare(a.date as string)),
    totals: {
      ...totals,
      remote_percentage: totals.gps_days > 0 ? Math.round((totals.remote_days / totals.gps_days) * 1000) / 10 : 0,
    },
  });
}
