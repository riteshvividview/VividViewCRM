import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  adminClient, getAuthContext, getActiveShift, getShiftById, resolveShiftForCheckIn, computeCheckIn, computeCheckOut,
  istToday, istMinutesNow, tsToISTMinutes,
} from "../_lib/helpers";
import { buildPunchLocation, type PunchCoordinates } from "../_lib/geo";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });

  const admin = adminClient();
  const today = istToday();

  const [{ data: attendance }, shift] = await Promise.all([
    admin.from("hr_attendance").select("*").eq("employee_id", ctx.employeeId).eq("date", today).maybeSingle(),
    getActiveShift(admin, ctx.workspaceId, ctx.employeeId, today),
  ]);

  let activeBreak = null;
  if (attendance) {
    const { data } = await admin
      .from("hr_attendance_breaks")
      .select("*")
      .eq("attendance_id", attendance.id)
      .is("break_end", null)
      .maybeSingle();
    activeBreak = data ?? null;
  }

  return NextResponse.json({ attendance: attendance ?? null, shift, active_break: activeBreak });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.employeeId) return NextResponse.json({ error: "No employee record linked to this account" }, { status: 404 });

  const body = await request.json();
  const action: string = body.action ?? "";
  if (!["check_in", "check_out", "break_start", "break_end"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = adminClient();
  const today = istToday();
  const now = new Date();
  const nowISO = now.toISOString();
  const nowMinutes = istMinutesNow();

  const { data: attendance } = await admin
    .from("hr_attendance")
    .select("*")
    .eq("employee_id", ctx.employeeId)
    .eq("date", today)
    .maybeSingle();

  if (action === "check_in") {
    if (attendance?.check_in) return NextResponse.json({ error: "Already checked in today" }, { status: 400 });

    const shift = await resolveShiftForCheckIn(admin, ctx.workspaceId, ctx.employeeId, today, nowMinutes);
    if (!shift) return NextResponse.json({ error: "No shift configured for your workspace" }, { status: 400 });

    const { late_minutes, status } = computeCheckIn(shift, nowMinutes);
    const workMode = body.work_mode === "work_from_home" ? "work_from_home" : "office";
    const checkInLocation = await buildPunchLocation(admin, ctx.workspaceId, body.location as PunchCoordinates | undefined, nowISO);

    const { data, error } = await admin
      .from("hr_attendance")
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          employee_id: ctx.employeeId,
          date: today,
          check_in: nowISO,
          check_in_location: checkInLocation,
          shift_id: shift.id,
          work_mode: workMode,
          late_minutes,
          status,
          source: body.source === "mobile" ? "mobile" : "web",
        },
        { onConflict: "employee_id,date" }
      )
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ attendance: data });
  }

  if (!attendance?.check_in) {
    return NextResponse.json({ error: "You must check in first" }, { status: 400 });
  }

  if (action === "break_start") {
    if (attendance.check_out) return NextResponse.json({ error: "Already checked out for today" }, { status: 400 });

    const { data: openBreak } = await admin
      .from("hr_attendance_breaks")
      .select("id")
      .eq("attendance_id", attendance.id)
      .is("break_end", null)
      .maybeSingle();
    if (openBreak) return NextResponse.json({ error: "A break is already in progress" }, { status: 400 });

    const breakType = ["lunch", "tea", "personal", "break"].includes(body.break_type) ? body.break_type : "break";
    const { data, error } = await admin
      .from("hr_attendance_breaks")
      .insert({ workspace_id: ctx.workspaceId, attendance_id: attendance.id, break_start: nowISO, break_type: breakType })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ break: data });
  }

  if (action === "break_end") {
    const { data: openBreak } = await admin
      .from("hr_attendance_breaks")
      .select("id")
      .eq("attendance_id", attendance.id)
      .is("break_end", null)
      .maybeSingle();
    if (!openBreak) return NextResponse.json({ error: "No active break to end" }, { status: 400 });

    const { data, error } = await admin
      .from("hr_attendance_breaks")
      .update({ break_end: nowISO })
      .eq("id", openBreak.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ break: data });
  }

  // action === "check_out"
  if (attendance.check_out) return NextResponse.json({ error: "Already checked out today" }, { status: 400 });

  // Use the same shift that applied at check-in (avoids inconsistent thresholds if assignments changed mid-day).
  const shift = (attendance.shift_id && (await getShiftById(admin, attendance.shift_id)))
    || (await getActiveShift(admin, ctx.workspaceId, ctx.employeeId, today));
  if (!shift) return NextResponse.json({ error: "No shift configured for your workspace" }, { status: 400 });

  // Auto-close any break left running at checkout time.
  const { data: openBreak } = await admin
    .from("hr_attendance_breaks")
    .select("id")
    .eq("attendance_id", attendance.id)
    .is("break_end", null)
    .maybeSingle();
  if (openBreak) {
    await admin.from("hr_attendance_breaks").update({ break_end: nowISO }).eq("id", openBreak.id);
  }

  const { data: breaks } = await admin
    .from("hr_attendance_breaks")
    .select("break_start, break_end")
    .eq("attendance_id", attendance.id);

  const totalBreakMinutes = (breaks ?? []).reduce((sum, b) => {
    if (!b.break_end) return sum;
    return sum + Math.max(0, (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
  }, 0);

  const rawMinutes = Math.max(0, (now.getTime() - new Date(attendance.check_in).getTime()) / 60000);
  const workMinutes = Math.max(0, Math.round(rawMinutes - totalBreakMinutes));

  const workMode = body.work_mode === "work_from_home" ? "work_from_home" : attendance.work_mode;
  const checkOutMinutes = tsToISTMinutes(nowISO);
  const { status, overtime_minutes, early_leave_minutes } = computeCheckOut(
    shift, workMinutes, checkOutMinutes, workMode, attendance.late_minutes ?? 0
  );
  const checkOutLocation = await buildPunchLocation(admin, ctx.workspaceId, body.location as PunchCoordinates | undefined, nowISO);

  const { data, error } = await admin
    .from("hr_attendance")
    .update({
      check_out: nowISO,
      check_out_location: checkOutLocation,
      work_minutes: workMinutes,
      total_break_minutes: Math.round(totalBreakMinutes),
      overtime_minutes,
      early_leave_minutes,
      status,
      work_mode: workMode,
      updated_at: nowISO,
    })
    .eq("id", attendance.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ attendance: data });
}
