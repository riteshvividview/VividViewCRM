"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock, Plus, Pencil, Trash2, Star, Moon, ArrowRightLeft, CalendarDays,
} from "lucide-react";
import { HRGuard } from "@/components/hrms/hr-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface Shift {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  is_night_shift: boolean;
  is_flexible: boolean;
  flexible_hours_per_day: number | null;
  working_days: number[];
  break_minutes: number;
  grace_period_minutes: number;
  half_day_threshold_minutes: number;
  full_day_threshold_minutes: number;
  overtime_threshold_minutes: number;
  is_default: boolean;
  status: string;
}

interface RosterRow {
  employee: {
    id: string;
    employee_code: string;
    designation: string | null;
    hr_departments: { name: string } | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  };
  assignment_id: string | null;
  effective_from: string | null;
  shift: { id: string; name: string; code: string } | null;
  is_default_fallback: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  holiday_type: string;
  department_ids: string[] | null;
}

// ── Shared helpers ────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function toTimeInput(t: string) {
  return t.slice(0, 5);
}

function fmtTimeOfDay(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function workingDaysLabel(days: number[]) {
  if (!days || days.length === 0) return "—";
  const sorted = [...days].sort();
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  national: "National",
  regional: "Regional",
  company: "Company",
  optional: "Optional",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function ShiftsHolidaysPage() {
  return (
    <HRGuard>
      <ShiftsHolidaysContent />
    </HRGuard>
  );
}

function ShiftsHolidaysContent() {
  return (
    <div className="space-y-6">
      <PageHeader title="Shifts & Holidays" subtitle="Manage shift schedules, employee shift assignments, and the holiday calendar" />

      <Tabs defaultValue="shifts" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts"><ShiftsTab /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
        <TabsContent value="holidays"><HolidaysTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shifts Tab ────────────────────────────────────────────────────────────

const EMPTY_SHIFT_FORM = {
  name: "",
  code: "",
  start_time: "09:00",
  end_time: "18:00",
  is_night_shift: false,
  is_flexible: false,
  flexible_hours_per_day: "8",
  working_days: [1, 2, 3, 4, 5] as number[],
  break_minutes: "60",
  grace_period_minutes: "10",
  half_day_threshold_minutes: "240",
  full_day_threshold_minutes: "480",
  overtime_threshold_minutes: "480",
  is_default: false,
};

function ShiftsTab() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState(EMPTY_SHIFT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/attendance/shifts");
      const json = await res.json();
      if (res.ok) setShifts(json.shifts ?? []);
      else toast.error(json.error ?? "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_SHIFT_FORM);
    setDialogOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditTarget(shift);
    setForm({
      name: shift.name,
      code: shift.code,
      start_time: toTimeInput(shift.start_time),
      end_time: toTimeInput(shift.end_time),
      is_night_shift: shift.is_night_shift,
      is_flexible: shift.is_flexible,
      flexible_hours_per_day: String(shift.flexible_hours_per_day ?? 8),
      working_days: shift.working_days ?? [1, 2, 3, 4, 5],
      break_minutes: String(shift.break_minutes),
      grace_period_minutes: String(shift.grace_period_minutes),
      half_day_threshold_minutes: String(shift.half_day_threshold_minutes),
      full_day_threshold_minutes: String(shift.full_day_threshold_minutes),
      overtime_threshold_minutes: String(shift.overtime_threshold_minutes),
      is_default: shift.is_default,
    });
    setDialogOpen(true);
  }

  function toggleDay(idx: number, checked: boolean) {
    setForm((f) => ({
      ...f,
      working_days: checked ? [...f.working_days, idx].sort((a, b) => a - b) : f.working_days.filter((d) => d !== idx),
    }));
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Shift name is required"); return; }
    if (!editTarget && !form.code.trim()) { toast.error("Shift code is required"); return; }
    if (form.working_days.length === 0) { toast.error("Select at least one working day"); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        is_night_shift: form.is_night_shift,
        is_flexible: form.is_flexible,
        flexible_hours_per_day: form.is_flexible ? Number(form.flexible_hours_per_day) || 8 : null,
        working_days: form.working_days,
        break_minutes: Number(form.break_minutes) || 0,
        grace_period_minutes: Number(form.grace_period_minutes) || 0,
        half_day_threshold_minutes: Number(form.half_day_threshold_minutes) || 0,
        full_day_threshold_minutes: Number(form.full_day_threshold_minutes) || 0,
        overtime_threshold_minutes: Number(form.overtime_threshold_minutes) || 0,
        is_default: form.is_default,
      };

      const url = editTarget ? `/api/hrms/attendance/shifts/${editTarget.id}` : "/api/hrms/attendance/shifts";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save shift");

      toast.success(editTarget ? "Shift updated" : "Shift created");
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hrms/attendance/shifts/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to deactivate shift");
      toast.success("Shift deactivated");
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Shift</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No shifts configured</p>
          <p className="text-sm text-gray-400 mb-4">Add a shift schedule to get started.</p>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Shift</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div key={shift.id} className={cn("bg-white rounded-xl border border-gray-100 p-5", shift.status !== "active" && "opacity-60")}>
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  {shift.is_night_shift ? <Moon className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(shift)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {!shift.is_default && shift.status === "active" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget(shift)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{shift.name}</h3>
                <Badge variant="secondary" className="text-[10px]">{shift.code}</Badge>
              </div>

              <p className="text-sm text-gray-500">
                {shift.is_flexible
                  ? `Flexible · ${shift.flexible_hours_per_day ?? 8}h/day`
                  : `${fmtTimeOfDay(shift.start_time)} – ${fmtTimeOfDay(shift.end_time)}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">Working days: {workingDaysLabel(shift.working_days)}</p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {shift.is_default && <Badge className="bg-indigo-100 text-indigo-700 text-[10px] gap-1"><Star className="h-3 w-3" />Default</Badge>}
                {shift.is_night_shift && <Badge className="bg-slate-100 text-slate-700 text-[10px]">Night Shift</Badge>}
                {shift.is_flexible && <Badge className="bg-purple-100 text-purple-700 text-[10px]">Flexible</Badge>}
                {shift.status !== "active" && <Badge className="bg-gray-100 text-gray-500 text-[10px]">Inactive</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                <div>
                  <p className="text-xs font-semibold text-gray-700">{shift.grace_period_minutes}m</p>
                  <p className="text-[10px] text-gray-400">Grace</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{shift.half_day_threshold_minutes}m</p>
                  <p className="text-[10px] text-gray-400">Half-day</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{shift.overtime_threshold_minutes}m</p>
                  <p className="text-[10px] text-gray-400">OT after</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Shift" : "New Shift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Shift Name *</Label>
                <Input placeholder="e.g. Morning Shift" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  placeholder="e.g. MORNING"
                  value={form.code}
                  disabled={!!editTarget}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Label className="mb-0">Flexible Shift</Label>
                <p className="text-xs text-gray-400">No fixed start/end time, no lateness tracking</p>
              </div>
              <Switch checked={form.is_flexible} onCheckedChange={(v) => setForm({ ...form, is_flexible: v })} />
            </div>

            {form.is_flexible ? (
              <div>
                <Label>Required Hours / Day</Label>
                <Input type="number" min="1" max="24" value={form.flexible_hours_per_day} onChange={(e) => setForm({ ...form, flexible_hours_per_day: e.target.value })} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
            )}

            {!form.is_flexible && (
              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <Label className="mb-0">Night Shift</Label>
                  <p className="text-xs text-gray-400">End time is on the following day</p>
                </div>
                <Switch checked={form.is_night_shift} onCheckedChange={(v) => setForm({ ...form, is_night_shift: v })} />
              </div>
            )}

            <div>
              <Label>Working Days</Label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const checked = form.working_days.includes(idx);
                  return (
                    <label key={idx} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer", checked ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500")}>
                      <Checkbox checked={checked} onCheckedChange={(v) => toggleDay(idx, !!v)} />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Break (minutes)</Label>
                <Input type="number" min="0" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Grace Period (minutes)</Label>
                <Input type="number" min="0" value={form.grace_period_minutes} onChange={(e) => setForm({ ...form, grace_period_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Half-day Threshold (min)</Label>
                <Input type="number" min="0" value={form.half_day_threshold_minutes} onChange={(e) => setForm({ ...form, half_day_threshold_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Full-day Threshold (min)</Label>
                <Input type="number" min="0" value={form.full_day_threshold_minutes} onChange={(e) => setForm({ ...form, full_day_threshold_minutes: e.target.value })} />
              </div>
              <div>
                <Label>Overtime After (min)</Label>
                <Input type="number" min="0" value={form.overtime_threshold_minutes} onChange={(e) => setForm({ ...form, overtime_threshold_minutes: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Label className="mb-0">Default Shift</Label>
                <p className="text-xs text-gray-400">Used for employees without a shift assignment</p>
              </div>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editTarget ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Deactivate Shift?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{deleteTarget?.name}</span> will be marked inactive and can no longer be assigned to employees.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeactivate} disabled={deleting}>{deleting ? "Deactivating…" : "Deactivate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Assignments Tab ───────────────────────────────────────────────────────

function AssignmentsTab() {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<RosterRow | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(istToday());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterRes, shiftsRes] = await Promise.all([
        fetch("/api/hrms/attendance/shift-assignments"),
        fetch("/api/hrms/attendance/shifts"),
      ]);
      const rosterJson = await rosterRes.json();
      const shiftsJson = await shiftsRes.json();
      if (rosterRes.ok) setRoster(rosterJson.roster ?? []);
      else toast.error(rosterJson.error ?? "Failed to load roster");
      if (shiftsRes.ok) setShifts((shiftsJson.shifts ?? []).filter((s: Shift) => s.status === "active"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAssign(row: RosterRow) {
    setTarget(row);
    setShiftId(row.shift?.id ?? "");
    setEffectiveFrom(istToday());
  }

  async function save() {
    if (!target || !shiftId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hrms/attendance/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: target.employee.id, shift_id: shiftId, effective_from: effectiveFrom }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to assign shift");
      toast.success("Shift assigned");
      setTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Since</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : roster.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No active employees</td></tr>
              ) : (
                roster.map((row) => (
                  <tr key={row.employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={row.employee.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                            {initials(row.employee.profiles?.full_name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{row.employee.profiles?.full_name ?? "—"}</p>
                          <p className="text-xs text-gray-400">{row.employee.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{row.employee.hr_departments?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.shift ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{row.shift.code}</Badge>
                          <span className="text-gray-700">{row.shift.name}</span>
                          {row.is_default_fallback && <span className="text-[10px] text-gray-400">(default)</span>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{row.effective_from ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAssign(row)}>
                        <ArrowRightLeft className="h-3.5 w-3.5" />Change
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assign Shift</DialogTitle></DialogHeader>
          {target && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-500">
                {target.employee.profiles?.full_name ?? target.employee.employee_code}
              </p>
              <div>
                <Label>Shift</Label>
                <Select value={shiftId} onValueChange={setShiftId}>
                  <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Effective From</Label>
                <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !shiftId}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Holidays Tab ──────────────────────────────────────────────────────────

function HolidaysTab() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", holiday_type: "company" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`/api/hrms/attendance/holidays?from=${year}-01-01&to=${year + 1}-03-31`);
      const json = await res.json();
      if (res.ok) setHolidays(json.holidays ?? []);
      else toast.error(json.error ?? "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ name: "", date: "", holiday_type: "company" });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Holiday name is required"); return; }
    if (!form.date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/hrms/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save holiday");
      toast.success("Holiday added");
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hrms/attendance/holidays/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete holiday");
      toast.success("Holiday removed");
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Holiday</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holiday</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(4)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : holidays.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">No holidays added yet</td></tr>
              ) : (
                holidays.map((h) => {
                  const d = new Date(`${h.date}T00:00:00Z`);
                  return (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarDays className="h-4 w-4 text-gray-400" />
                          {d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", weekday: "short" })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {h.name}
                        {h.department_ids && h.department_ids.length > 0 && (
                          <span className="ml-2 text-[10px] text-gray-400">({h.department_ids.length} dept{h.department_ids.length > 1 ? "s" : ""})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant="secondary" className="text-[10px]">{HOLIDAY_TYPE_LABEL[h.holiday_type] ?? h.holiday_type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget(h)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Holiday Name *</Label>
              <Input placeholder="e.g. Diwali" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.holiday_type} onValueChange={(v) => setForm({ ...form, holiday_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(HOLIDAY_TYPE_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove Holiday?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            Remove <span className="font-medium text-gray-900">{deleteTarget?.name}</span> from the holiday calendar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? "Removing…" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
