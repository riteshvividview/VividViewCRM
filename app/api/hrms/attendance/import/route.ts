import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import {
  adminClient, getAuthContext, isHR, isValidDateString,
  istToday, istDateTimeToISO, writeAuditLog,
} from "../_lib/helpers";
import { runAttendanceProcessing, MAX_PROCESS_DAYS } from "../_lib/automation";

const VALID_STATUSES = ["present", "late", "half_day", "work_from_home", "on_leave", "holiday", "weekend", "absent"];
const VALID_WORK_MODES = ["office", "work_from_home"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_ROWS = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

interface ImportRowResult {
  row: number;
  employee_code: string;
  date: string;
  status: "imported" | "skipped" | "error";
  message?: string;
}

function cellToDateStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const s = String(value).trim();
  return isValidDateString(s) ? s : null;
}

function cellToTimeStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  const s = String(value).trim();
  return TIME_RE.test(s) ? s : null;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Downloadable .xlsx template for bulk attendance import. HR/super_admin only. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Employee Code", "Date", "Check In", "Check Out", "Status", "Work Mode"],
    ["EMP001", "2026-06-01", "09:05", "18:10", "", "office"],
    ["EMP002", "2026-06-01", "", "", "on_leave", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance_import_template.xlsx"',
    },
  });
}

/**
 * Bulk-imports attendance punches/day-statuses from an uploaded .xlsx/.xls/.csv file
 * (Excel Attendance Import). Expected columns: Employee Code, Date (YYYY-MM-DD),
 * Check In / Check Out (HH:MM, optional), Status (optional), Work Mode (optional).
 * Rows for months already closed (see /monthly-process) or attendance records
 * locked via an approved correction (is_regularized) are skipped. After upserting,
 * affected employees' date ranges are reprocessed via runAttendanceProcessing so
 * late/overtime/status are recalculated from the current shift rules.
 * HR/super_admin only.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isHR(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = (file as File).name ?? "";
  const isCSV = filename.toLowerCase().endsWith(".csv");

  let workbook: XLSX.WorkBook;
  try {
    workbook = isCSV
      ? XLSX.read(buffer.toString("utf8"), { type: "string", cellDates: true })
      : XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file. Please upload a valid .xlsx, .xls or .csv file." }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return NextResponse.json({ error: "The uploaded file has no data rows" }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Cannot import more than ${MAX_ROWS} rows at a time` }, { status: 400 });

  const admin = adminClient();
  const today = istToday();

  const [{ data: employees }, { data: closures }] = await Promise.all([
    admin.from("hr_employees").select("id, employee_code").eq("workspace_id", ctx.workspaceId).eq("status", "active"),
    admin.from("hr_attendance_monthly_closures").select("year, month").eq("workspace_id", ctx.workspaceId).eq("status", "closed"),
  ]);
  const employeeByCode = new Map((employees ?? []).map((e) => [e.employee_code.trim().toUpperCase(), e]));
  const closedMonths = new Set((closures ?? []).map((c) => `${c.year}-${pad(c.month)}`));

  const results: ImportRowResult[] = [];

  interface ParsedRow {
    rowNum: number; employeeCode: string; employeeId: string; date: string;
    checkIn: string | null; checkOut: string | null; status: string | null; workMode: string | null;
  }
  const parsed: ParsedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-indexed data row, accounting for the header row
    const raw = rows[i];
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) normalized[normalizeKey(k)] = v;

    const employeeCode = String(normalized["employeecode"] ?? "").trim();
    const date = cellToDateStr(normalized["date"]);
    const checkIn = cellToTimeStr(normalized["checkin"]);
    const checkOut = cellToTimeStr(normalized["checkout"]);
    const statusRaw = String(normalized["status"] ?? "").trim().toLowerCase();
    const workModeRaw = String(normalized["workmode"] ?? "").trim().toLowerCase();

    if (!employeeCode && !normalized["date"]) continue; // skip fully blank rows

    if (!employeeCode) { results.push({ row: rowNum, employee_code: "", date: date ?? "", status: "error", message: "Missing employee code" }); continue; }
    const emp = employeeByCode.get(employeeCode.toUpperCase());
    if (!emp) { results.push({ row: rowNum, employee_code: employeeCode, date: date ?? "", status: "error", message: "Unknown or inactive employee code" }); continue; }

    if (!date) { results.push({ row: rowNum, employee_code: employeeCode, date: "", status: "error", message: "Missing or invalid date (expected YYYY-MM-DD)" }); continue; }
    if (date > today) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: "Date is in the future" }); continue; }

    if (normalized["checkin"] && !checkIn) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: "Invalid Check In time (expected HH:MM)" }); continue; }
    if (normalized["checkout"] && !checkOut) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: "Invalid Check Out time (expected HH:MM)" }); continue; }
    if (statusRaw && !VALID_STATUSES.includes(statusRaw)) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: `Invalid status "${statusRaw}"` }); continue; }
    if (workModeRaw && !VALID_WORK_MODES.includes(workModeRaw)) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: `Invalid work mode "${workModeRaw}"` }); continue; }
    if (!checkIn && !checkOut && !statusRaw) { results.push({ row: rowNum, employee_code: employeeCode, date, status: "error", message: "Nothing to import — provide Check In/Out or Status" }); continue; }

    if (closedMonths.has(date.slice(0, 7))) {
      results.push({ row: rowNum, employee_code: employeeCode, date, status: "skipped", message: "Month is closed for processing" });
      continue;
    }

    parsed.push({ rowNum, employeeCode, employeeId: emp.id, date, checkIn, checkOut, status: statusRaw || null, workMode: workModeRaw || null });
  }

  const upsertByKey = new Map<string, Record<string, unknown>>();
  const affectedRanges = new Map<string, { min: string; max: string }>();

  if (parsed.length > 0) {
    const employeeIds = [...new Set(parsed.map((p) => p.employeeId))];
    const dates = parsed.map((p) => p.date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const { data: existingRows } = await admin
      .from("hr_attendance")
      .select("employee_id, date, is_regularized")
      .eq("workspace_id", ctx.workspaceId)
      .in("employee_id", employeeIds)
      .gte("date", minDate)
      .lte("date", maxDate);
    const existingByKey = new Map((existingRows ?? []).map((r) => [`${r.employee_id}_${r.date}`, r]));

    const nowISO = new Date().toISOString();
    for (const p of parsed) {
      const key = `${p.employeeId}_${p.date}`;
      const existing = existingByKey.get(key);
      if (existing?.is_regularized) {
        results.push({ row: p.rowNum, employee_code: p.employeeCode, date: p.date, status: "skipped", message: "Record is locked by an HR-approved correction" });
        continue;
      }

      const fields: Record<string, unknown> = {
        workspace_id: ctx.workspaceId, employee_id: p.employeeId, date: p.date,
        source: "import", is_auto_generated: false, updated_at: nowISO,
      };
      if (p.checkIn) fields.check_in = istDateTimeToISO(p.date, p.checkIn);
      if (p.checkOut) fields.check_out = istDateTimeToISO(p.date, p.checkOut);
      if (p.workMode) fields.work_mode = p.workMode;
      if (p.status) fields.status = p.status;
      else if (p.checkIn) fields.status = "present"; // placeholder — recomputed by attendance processing below

      upsertByKey.set(key, fields);

      if (p.checkIn || p.checkOut) {
        const range = affectedRanges.get(p.employeeId) ?? { min: p.date, max: p.date };
        if (p.date < range.min) range.min = p.date;
        if (p.date > range.max) range.max = p.date;
        affectedRanges.set(p.employeeId, range);
      }

      results.push({ row: p.rowNum, employee_code: p.employeeCode, date: p.date, status: "imported" });
    }
  }

  const toUpsert = [...upsertByKey.values()];
  if (toUpsert.length > 0) {
    const { error } = await admin.from("hr_attendance").upsert(toUpsert, { onConflict: "employee_id,date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Reprocess affected employees' date ranges so late/overtime/status reflect current shift rules.
  for (const [employeeId, range] of affectedRanges) {
    let from = range.min;
    while (from <= range.max) {
      const chunkStart = new Date(`${from}T00:00:00Z`);
      const chunkEndDate = new Date(chunkStart);
      chunkEndDate.setUTCDate(chunkEndDate.getUTCDate() + MAX_PROCESS_DAYS - 1);
      const chunkEnd = chunkEndDate.toISOString().slice(0, 10);
      const to = chunkEnd > range.max ? range.max : chunkEnd;

      await runAttendanceProcessing(admin, ctx.workspaceId, from, to, ctx.userId, employeeId);

      const nextDate = new Date(`${to}T00:00:00Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      from = nextDate.toISOString().slice(0, 10);
    }
  }

  const summary = {
    total_rows: results.length,
    imported: results.filter((r) => r.status === "imported").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  await writeAuditLog(admin, ctx.workspaceId, {
    entity_type: "attendance_import",
    action: "import",
    description: `Imported attendance from "${filename || "uploaded file"}": ${summary.imported} imported, ${summary.skipped} skipped, ${summary.errors} errors (${summary.total_rows} rows)`,
    changes: summary,
    performed_by: ctx.userId,
  });

  return NextResponse.json({ summary, results });
}
