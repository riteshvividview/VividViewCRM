"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap, Briefcase, Plus, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface EducationEntry {
  id: string;
  qualification: string;
  institution: string;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  grade: string | null;
}

interface WorkHistoryEntry {
  id: string;
  company_name: string;
  designation: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string | null;
}

const EMPTY_EDU = {
  qualification: "",
  institution: "",
  field_of_study: "",
  start_year: "",
  end_year: "",
  grade: "",
};

const EMPTY_WORK = {
  company_name: "",
  designation: "",
  start_date: "",
  end_date: "",
  is_current: false,
  responsibilities: "",
};

function fmtMonthYear(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function EmployeeBackgroundTab({
  employeeId,
  workspaceId,
  viewerRole,
}: {
  employeeId: string;
  workspaceId: string;
  viewerRole: UserRole;
}) {
  const isHR = viewerRole === "super_admin" || viewerRole === "hr";

  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [eduOpen, setEduOpen] = useState(false);
  const [eduForm, setEduForm] = useState(EMPTY_EDU);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [savingEdu, setSavingEdu] = useState(false);

  const [workOpen, setWorkOpen] = useState(false);
  const [workForm, setWorkForm] = useState(EMPTY_WORK);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [savingWork, setSavingWork] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [eduRes, workRes] = await Promise.all([
      supabase.from("hr_employee_education")
        .select("id, qualification, institution, field_of_study, start_year, end_year, grade")
        .eq("employee_id", employeeId)
        .order("end_year", { ascending: false }),
      supabase.from("hr_employee_work_history")
        .select("id, company_name, designation, start_date, end_date, is_current, responsibilities")
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false }),
    ]);
    setEducation((eduRes.data ?? []) as unknown as EducationEntry[]);
    setWorkHistory((workRes.data ?? []) as unknown as WorkHistoryEntry[]);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  // ── Education handlers ──────────────────────────────────────────────────
  function openAddEdu() {
    setEduForm(EMPTY_EDU);
    setEditingEduId(null);
    setEduOpen(true);
  }

  function openEditEdu(entry: EducationEntry) {
    setEduForm({
      qualification: entry.qualification,
      institution: entry.institution,
      field_of_study: entry.field_of_study ?? "",
      start_year: entry.start_year ? String(entry.start_year) : "",
      end_year: entry.end_year ? String(entry.end_year) : "",
      grade: entry.grade ?? "",
    });
    setEditingEduId(entry.id);
    setEduOpen(true);
  }

  async function saveEdu() {
    if (!eduForm.qualification.trim()) { toast.error("Qualification is required"); return; }
    if (!eduForm.institution.trim()) { toast.error("Institution is required"); return; }

    setSavingEdu(true);
    const supabase = createClient();
    const payload = {
      workspace_id: workspaceId,
      employee_id: employeeId,
      qualification: eduForm.qualification.trim(),
      institution: eduForm.institution.trim(),
      field_of_study: eduForm.field_of_study.trim() || null,
      start_year: eduForm.start_year ? Number(eduForm.start_year) : null,
      end_year: eduForm.end_year ? Number(eduForm.end_year) : null,
      grade: eduForm.grade.trim() || null,
    };

    try {
      const { error } = editingEduId
        ? await supabase.from("hr_employee_education").update(payload).eq("id", editingEduId)
        : await supabase.from("hr_employee_education").insert(payload);
      if (error) throw error;

      toast.success(editingEduId ? "Education entry updated" : "Education entry added");
      setEduOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to save education entry");
    } finally {
      setSavingEdu(false);
    }
  }

  async function deleteEdu(entryId: string) {
    if (!confirm("Delete this education entry?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("hr_employee_education").delete().eq("id", entryId);
    if (error) { toast.error(error.message); return; }
    toast.success("Education entry deleted");
    await load();
  }

  // ── Work history handlers ───────────────────────────────────────────────
  function openAddWork() {
    setWorkForm(EMPTY_WORK);
    setEditingWorkId(null);
    setWorkOpen(true);
  }

  function openEditWork(entry: WorkHistoryEntry) {
    setWorkForm({
      company_name: entry.company_name,
      designation: entry.designation,
      start_date: entry.start_date ?? "",
      end_date: entry.end_date ?? "",
      is_current: entry.is_current,
      responsibilities: entry.responsibilities ?? "",
    });
    setEditingWorkId(entry.id);
    setWorkOpen(true);
  }

  async function saveWork() {
    if (!workForm.company_name.trim()) { toast.error("Company name is required"); return; }
    if (!workForm.designation.trim()) { toast.error("Designation is required"); return; }

    setSavingWork(true);
    const supabase = createClient();
    const payload = {
      workspace_id: workspaceId,
      employee_id: employeeId,
      company_name: workForm.company_name.trim(),
      designation: workForm.designation.trim(),
      start_date: workForm.start_date || null,
      end_date: workForm.is_current ? null : (workForm.end_date || null),
      is_current: workForm.is_current,
      responsibilities: workForm.responsibilities.trim() || null,
    };

    try {
      const { error } = editingWorkId
        ? await supabase.from("hr_employee_work_history").update(payload).eq("id", editingWorkId)
        : await supabase.from("hr_employee_work_history").insert(payload);
      if (error) throw error;

      toast.success(editingWorkId ? "Work experience updated" : "Work experience added");
      setWorkOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to save work experience");
    } finally {
      setSavingWork(false);
    }
  }

  async function deleteWork(entryId: string) {
    if (!confirm("Delete this work experience entry?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("hr_employee_work_history").delete().eq("id", entryId);
    if (error) { toast.error(error.message); return; }
    toast.success("Work experience deleted");
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Education ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-500" />Education
          </h3>
          {isHR && (
            <Button size="sm" variant="outline" onClick={openAddEdu}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add
            </Button>
          )}
        </div>

        {education.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No education records yet.</p>
        ) : (
          <div className="space-y-3">
            {education.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{e.qualification}</p>
                  <p className="text-sm text-gray-500">
                    {e.institution}{e.field_of_study ? ` · ${e.field_of_study}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {e.start_year ?? "—"} – {e.end_year ?? "Present"}
                    {e.grade ? ` · ${e.grade}` : ""}
                  </p>
                </div>
                {isHR && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditEdu(e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteEdu(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Work Experience ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-500" />Work Experience
          </h3>
          {isHR && (
            <Button size="sm" variant="outline" onClick={openAddWork}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add
            </Button>
          )}
        </div>

        {workHistory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No prior work experience recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {workHistory.map((w) => (
              <div key={w.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{w.designation}</p>
                  <p className="text-sm text-gray-500">{w.company_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtMonthYear(w.start_date)} – {w.is_current ? "Present" : fmtMonthYear(w.end_date)}
                  </p>
                  {w.responsibilities && (
                    <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{w.responsibilities}</p>
                  )}
                </div>
                {isHR && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditWork(w)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteWork(w.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add/Edit Education dialog ─────────────────────────────────── */}
      <Dialog open={eduOpen} onOpenChange={(o) => { if (!savingEdu) setEduOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEduId ? "Edit Education" : "Add Education"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Qualification *</Label>
              <Input placeholder="B.Tech, MBA, 12th Grade…" value={eduForm.qualification} onChange={(e) => setEduForm((f) => ({ ...f, qualification: e.target.value }))} />
            </div>
            <div>
              <Label>Institution *</Label>
              <Input placeholder="University / School name" value={eduForm.institution} onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))} />
            </div>
            <div>
              <Label>Field of Study</Label>
              <Input placeholder="Computer Science…" value={eduForm.field_of_study} onChange={(e) => setEduForm((f) => ({ ...f, field_of_study: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Year</Label>
                <Input type="number" placeholder="2018" value={eduForm.start_year} onChange={(e) => setEduForm((f) => ({ ...f, start_year: e.target.value }))} />
              </div>
              <div>
                <Label>End Year</Label>
                <Input type="number" placeholder="2022" value={eduForm.end_year} onChange={(e) => setEduForm((f) => ({ ...f, end_year: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Grade / Score</Label>
              <Input placeholder="8.5 CGPA, 85%…" value={eduForm.grade} onChange={(e) => setEduForm((f) => ({ ...f, grade: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEduOpen(false)} disabled={savingEdu}>Cancel</Button>
            <Button onClick={saveEdu} disabled={savingEdu}>{savingEdu ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Work Experience dialog ───────────────────────────── */}
      <Dialog open={workOpen} onOpenChange={(o) => { if (!savingWork) setWorkOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWorkId ? "Edit Work Experience" : "Add Work Experience"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company *</Label>
              <Input placeholder="Company name" value={workForm.company_name} onChange={(e) => setWorkForm((f) => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div>
              <Label>Designation *</Label>
              <Input placeholder="Job title" value={workForm.designation} onChange={(e) => setWorkForm((f) => ({ ...f, designation: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={workForm.start_date} onChange={(e) => setWorkForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={workForm.end_date} disabled={workForm.is_current} onChange={(e) => setWorkForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_current"
                checked={workForm.is_current}
                onCheckedChange={(checked) => setWorkForm((f) => ({ ...f, is_current: checked === true, end_date: checked === true ? "" : f.end_date }))}
              />
              <Label htmlFor="is_current" className="cursor-pointer">Currently working here</Label>
            </div>
            <div>
              <Label>Responsibilities</Label>
              <Textarea rows={3} placeholder="Key responsibilities…" value={workForm.responsibilities} onChange={(e) => setWorkForm((f) => ({ ...f, responsibilities: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkOpen(false)} disabled={savingWork}>Cancel</Button>
            <Button onClick={saveWork} disabled={savingWork}>{savingWork ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
