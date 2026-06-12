"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  work_minutes: number;
  hr_employees: {
    employee_code: string;
    designation: string;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  present: { label: "Present", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600 bg-green-50" },
  absent: { label: "Absent", icon: <XCircle className="h-4 w-4" />, color: "text-red-600 bg-red-50" },
  late: { label: "Late", icon: <AlertCircle className="h-4 w-4" />, color: "text-yellow-600 bg-yellow-50" },
  on_leave: { label: "On Leave", icon: <Clock className="h-4 w-4" />, color: "text-blue-600 bg-blue-50" },
  half_day: { label: "Half Day", icon: <AlertCircle className="h-4 w-4" />, color: "text-orange-600 bg-orange-50" },
};

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, on_leave: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) return;

      const { data } = await supabase
        .from("hr_attendance")
        .select("id, employee_id, status, check_in, check_out, work_minutes, hr_employees(employee_code, designation, profiles(full_name, avatar_url))")
        .eq("workspace_id", profile.workspace_id)
        .eq("date", selectedDate)
        .order("check_in", { ascending: true });

      const recs = (data ?? []) as unknown as AttendanceRecord[];
      setRecords(recs);
      setSummary({
        present: recs.filter((r) => r.status === "present").length,
        absent: recs.filter((r) => r.status === "absent").length,
        late: recs.filter((r) => r.status === "late").length,
        on_leave: recs.filter((r) => r.status === "on_leave").length,
      });
      setLoading(false);
    }
    load();
  }, [selectedDate]);

  function shiftDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" subtitle="Daily attendance tracking" />

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)} disabled={selectedDate >= new Date().toISOString().split("T")[0]}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {selectedDate === new Date().toISOString().split("T")[0] && (
          <Badge variant="secondary">Today</Badge>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "present", label: "Present", color: "text-green-700 bg-green-50" },
          { key: "absent", label: "Absent", color: "text-red-700 bg-red-50" },
          { key: "late", label: "Late", color: "text-yellow-700 bg-yellow-50" },
          { key: "on_leave", label: "On Leave", color: "text-blue-700 bg-blue-50" },
        ].map((s) => (
          <div key={s.key} className={cn("rounded-xl p-4", s.color)}>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{loading ? "—" : summary[s.key as keyof typeof summary]}</p>
          </div>
        ))}
      </div>

      {/* Records table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check In</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Check Out</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Hours</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No attendance records for this date</td></tr>
              ) : (
                records.map((r) => {
                  const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.absent;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.hr_employees?.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                              {initials(r.hr_employees?.profiles?.full_name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{r.hr_employees?.profiles?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400">{r.hr_employees?.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{formatTime(r.check_in)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{formatTime(r.check_out)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{formatMinutes(r.work_minutes)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sc.color)}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
