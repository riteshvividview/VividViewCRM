import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient, getAuthContext, isHR, isValidDateString, istToday } from "../_lib/helpers";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const employeeId = request.nextUrl.searchParams.get("employee_id");

  if (employeeId) {
    if (!isHR(ctx.role) && employeeId !== ctx.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data, error } = await admin
      .from("hr_shift_assignments")
      .select("id, effective_from, effective_to, hr_shifts(id, name, code)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("employee_id", employeeId)
      .order("effective_from", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignments: data ?? [] });
  }

  // Roster mode — HR/super_admin only
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [employeesRes, assignmentsRes, defaultShiftRes] = await Promise.all([
    admin
      .from("hr_employees")
      .select("id, employee_code, designation, hr_departments!department_id(name), profiles(full_name, avatar_url)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .order("employee_code"),
    admin
      .from("hr_shift_assignments")
      .select("id, employee_id, effective_from, hr_shifts(id, name, code)")
      .eq("workspace_id", ctx.workspaceId)
      .is("effective_to", null),
    admin
      .from("hr_shifts")
      .select("id, name, code")
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (employeesRes.error) return NextResponse.json({ error: employeesRes.error.message }, { status: 400 });

  const assignmentByEmployee = new Map((assignmentsRes.data ?? []).map((a) => [a.employee_id, a]));
  const defaultShift = defaultShiftRes.data;

  const roster = (employeesRes.data ?? []).map((emp) => {
    const assignment = assignmentByEmployee.get(emp.id);
    return {
      employee: emp,
      assignment_id: assignment?.id ?? null,
      effective_from: assignment?.effective_from ?? null,
      shift: assignment?.hr_shifts ?? defaultShift ?? null,
      is_default_fallback: !assignment,
    };
  });

  return NextResponse.json({ roster });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const employeeId: string = body.employee_id ?? "";
  const shiftId: string = body.shift_id ?? "";
  const effectiveFrom: string = body.effective_from ?? istToday();

  if (!employeeId || !shiftId) return NextResponse.json({ error: "employee_id and shift_id are required" }, { status: 400 });
  if (!isValidDateString(effectiveFrom)) return NextResponse.json({ error: "Invalid effective_from date" }, { status: 400 });

  const admin = adminClient();

  const [{ data: employee }, { data: shift }] = await Promise.all([
    admin.from("hr_employees").select("id").eq("id", employeeId).eq("workspace_id", ctx.workspaceId).maybeSingle(),
    admin.from("hr_shifts").select("id").eq("id", shiftId).eq("workspace_id", ctx.workspaceId).eq("status", "active").maybeSingle(),
  ]);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const { data: open } = await admin
    .from("hr_shift_assignments")
    .select("id, shift_id, effective_from")
    .eq("workspace_id", ctx.workspaceId)
    .eq("employee_id", employeeId)
    .is("effective_to", null)
    .maybeSingle();

  if (open) {
    if (open.shift_id === shiftId) {
      return NextResponse.json({ success: true, unchanged: true });
    }
    if (open.effective_from === effectiveFrom) {
      const { data, error } = await admin
        .from("hr_shift_assignments")
        .update({ shift_id: shiftId })
        .eq("id", open.id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ assignment: data });
    }
    if (open.effective_from > effectiveFrom) {
      return NextResponse.json({ error: `Employee already has a shift assignment starting ${open.effective_from}. Choose a later date.` }, { status: 400 });
    }

    const prevDay = new Date(`${effectiveFrom}T00:00:00Z`);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const closeDate = prevDay.toISOString().split("T")[0];

    const { error: closeError } = await admin
      .from("hr_shift_assignments")
      .update({ effective_to: closeDate })
      .eq("id", open.id);
    if (closeError) return NextResponse.json({ error: closeError.message }, { status: 400 });
  }

  const { data, error } = await admin
    .from("hr_shift_assignments")
    .insert({
      workspace_id: ctx.workspaceId,
      employee_id: employeeId,
      shift_id: shiftId,
      effective_from: effectiveFrom,
      created_by: ctx.userId,
    })
    .select("*, hr_shifts(name, code)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}
