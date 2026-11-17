"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faFlag } from "@fortawesome/free-regular-svg-icons";
import { faArrowsRotate, faXmark, faSpinner, faLink, faBullseye } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { TaskPriority, TaskMember, TaskTeam, TaskProjectListItem, TaskType, BoardColumn, RecurringPattern, TaskStatus, Task } from "../types";
import { RECURRING_OPTIONS, STATUS_CONFIG } from "../types";
import { AssigneePicker } from "./assignee-picker";
import { RichTextEditor } from "./rich-text-editor";
import { DropZone, FILE_SECTIONS, fileIcon } from "./task-files";
import type { AddTaskInput } from "../hooks/use-tasks";
import { addTaskLink, formatFileSize, uploadTaskFile } from "../lib/upload";
import { initials } from "../lib/bordio";
import { PriorityLabel } from "./task-icons";
import { todayISO } from "../dates";
import { cn } from "@/lib/utils";
import { useShellProfile } from "@/lib/supabase/profile-context";

/** Explanations of how files are kept are shown to the CEO and team leads only. */
function useShowFileHints(): boolean {
  const role = useShellProfile()?.role;
  return role === "super_admin" || role === "team_lead";
}

interface QuickAddTaskProps {
  open: boolean;
  onClose: () => void;
  onAdd: (t: AddTaskInput) => Promise<Task | null | void>;
  /** Called after the task's files finished uploading, so counters refresh. */
  onUploaded?: (taskId: string) => void;
  members: TaskMember[];
  teams: TaskTeam[];
  projects: TaskProjectListItem[];
  types?: TaskType[];
  currentUserId?: string | null;
  defaults?: Partial<AddTaskInput>;
}

const NONE = "__none__";
const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const STATUSES: TaskStatus[] = ["todo", "in_progress", "waiting"];
// shadcn-style form controls for the properties column
const trigger = "h-9 w-full bg-background text-[13px] shadow-sm";
const box = "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-[13px] shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring";
const noteInput = "block min-h-[34px] w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</p>
      {children}
    </div>
  );
}

/** Trigger content: icon/dot + text, left aligned (the chevron stays on the right). */
const T = ({ children }: { children: React.ReactNode }) => (
  <span className="min-w-0"><span className="flex min-w-0 items-center gap-2 truncate">{children}</span></span>
);

/** Files and an optional note picked before the task exists; uploaded right after it is created. */
function PendingSection({ kind, note, onNote, files, onFiles, links, onLinks }: {
  kind: "brief" | "reference" | "main"; note: string; onNote: (v: string) => void;
  files: File[]; onFiles: (f: File[]) => void; links?: string[]; onLinks?: (l: string[]) => void;
}) {
  const meta = FILE_SECTIONS[kind];
  const showHints = useShowFileHints();
  const [link, setLink] = useState<string | null>(null);
  const addLink = () => {
    const v = link?.trim();
    if (v && /^https?:\/\/\S+$/i.test(v)) onLinks?.([...(links ?? []), v]);
    else if (v) toast.error("Links must start with http:// or https://");
    setLink(null);
  };
  return (
    <div className="rounded-xl border bg-muted/20 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md bg-background shadow-sm", meta.accent)}><FontAwesomeIcon icon={meta.icon} className="h-3 w-3" /></span>
        <p className="shrink-0 text-[13px] font-semibold">{meta.title}</p>
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={showHints ? `${meta.purpose} ${meta.hint}` : meta.purpose}>{meta.purpose}</p>
      </div>
      <textarea rows={1} value={note} maxLength={2000} placeholder={meta.notePlaceholder} onChange={(e) => onNote(e.target.value)} className={cn(noteInput, "mb-2")} />
      {(files.length > 0 || (links?.length ?? 0) > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={`f${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-sm">
              <FontAwesomeIcon icon={fileIcon(f.type)} className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{f.name}</span>
              <span className="font-normal text-muted-foreground">{formatFileSize(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground"><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>
            </span>
          ))}
          {(links ?? []).map((l, i) => (
            <span key={`l${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-sm">
              <FontAwesomeIcon icon={faLink} className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{l.replace(/^https?:\/\//i, "")}</span>
              <button type="button" aria-label="Remove link" onClick={() => onLinks?.(links!.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground"><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <DropZone compact onFiles={(f) => onFiles([...files, ...f])} />
      {onLinks && (link === null ? (
        <button type="button" onClick={() => setLink("")} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <FontAwesomeIcon icon={faLink} className="h-3 w-3" />Paste a link instead
        </button>
      ) : (
        <input autoFocus value={link} placeholder="https://… then press Enter" onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } if (e.key === "Escape") { e.stopPropagation(); setLink(null); } }} onBlur={addLink}
          className={cn(box, "mt-2")} />
      ))}
    </div>
  );
}

/** Create task dialog (also opened by the T shortcut). */
export function QuickAddTask({ open, onClose, onAdd, onUploaded, members, teams, projects, types = [], currentUserId, defaults = {} }: QuickAddTaskProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [columnId, setColumnId] = useState("");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [assignees, setAssignees] = useState<TaskMember[]>([]);
  const [planned, setPlanned] = useState<string>("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [repeat, setRepeat] = useState<string>("");
  const [briefNote, setBriefNote] = useState("");
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [refNote, setRefNote] = useState("");
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refLinks, setRefLinks] = useState<string[]>([]);
  const [briefLinks, setBriefLinks] = useState<string[]>([]);
  const [mainNote, setMainNote] = useState("");
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [mainLinks, setMainLinks] = useState<string[]>([]);
  const showHints = useShowFileHints();
  const [saving, setSaving] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset everything whenever the dialog opens or closes, so nothing leaks into the next task.
  useEffect(() => {
    setAssignees([]); setBriefFiles([]); setRefFiles([]); setRefLinks([]); setBriefLinks([]); setMainFiles([]); setMainLinks([]);
    if (!open) return;
    setTitle(""); setDescription(""); setRepeat(""); setBriefNote(""); setRefNote(""); setMainNote("");
    setProjectId(defaults.project_id ?? "");
    setTeamId(defaults.team_id ?? "");
    setTypeId(defaults.type_id ?? "");
    setColumnId(defaults.board_column_id ?? "");
    setStatus(defaults.status && defaults.status !== "done" ? (defaults.status as TaskStatus) : "todo");
    setPlanned(defaults.planned_date === undefined ? todayISO() : defaults.planned_date ?? "");
    setDue(defaults.due_date ?? "");
    setPriority((defaults.priority as TaskPriority) ?? "none");
    // Every new task starts unassigned unless the caller pre-selects someone (e.g. a Team row).
    const defaultTeam = teams.find((t) => t.id === defaults.team_id);
    setAssignees(defaults.assignee_ids?.length ? members.filter((m) => defaults.assignee_ids!.includes(m.id) && (!defaultTeam || defaultTeam.member_ids.includes(m.id))) : []);
    setTimeout(() => titleRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setColumns([]);
    if (!projectId) return;
    fetch(`/api/tasks/projects/${projectId}`).then((r) => r.json()).then((j) => {
      // A new task has no main file yet, so it cannot start in a "done" column.
      const cols: BoardColumn[] = (j.columns ?? []).filter((c: BoardColumn) => c.status_key !== "done");
      setColumns(cols);
      setColumnId((cur) => (cols.some((c) => c.id === cur) ? cur : cols[0]?.id ?? ""));
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  const brandMissing = projects.length > 0 && !projectId;
  // With a team chosen, only its members can be assigned.
  const chosenTeam = teams.find((t) => t.id === teamId);
  const pickable = chosenTeam ? members.filter((m) => chosenTeam.member_ids.includes(m.id)) : members;
  const pickableTeams = chosenTeam ? [chosenTeam] : teams;
  const canSubmit = !!title.trim() && !brandMissing && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving("Creating task…");
    const created = await onAdd({
      title: title.trim(),
      description,
      project_id: projectId || null,
      team_id: teamId || null,
      board_column_id: projectId ? columnId || null : null,
      status: projectId ? undefined : status,
      type_id: typeId || null,
      planned_date: planned || null,
      due_date: due || null,
      priority,
      recurring_pattern: (repeat || null) as RecurringPattern,
      brief_note: briefNote.trim() || null,
      reference_note: refNote.trim() || null,
      main_note: mainNote.trim() || null,
      assignee_ids: assignees.map((m) => m.id),
      assign_to_me: false,
    });
    if (created) {
      const uploads: { file: File; kind: "brief" | "reference" | "main" }[] = [
        ...briefFiles.map((file) => ({ file, kind: "brief" as const })),
        ...refFiles.map((file) => ({ file, kind: "reference" as const })),
        ...mainFiles.map((file) => ({ file, kind: "main" as const })),
      ];
      let failed = 0;
      for (const [i, u] of uploads.entries()) {
        try {
          await uploadTaskFile(created.id, u.file, u.kind, (pct) => setSaving(`Uploading file ${i + 1} of ${uploads.length} · ${pct}%`));
        } catch { failed++; }
      }
      for (const [url, kind] of [...briefLinks.map((u) => [u, "brief"] as const), ...refLinks.map((u) => [u, "reference"] as const), ...mainLinks.map((u) => [u, "main"] as const)]) {
        try { await addTaskLink(created.id, url, kind); } catch { failed++; }
      }
      if (failed) toast.error(`Task created, but ${failed} file${failed === 1 ? "" : "s"} could not be uploaded. Open the task to try again.`);
      if (uploads.length || refLinks.length || briefLinks.length || mainLinks.length) onUploaded?.(created.id);
    }
    setSaving(null);
    if (created) onClose();
  }

  if (!open) return null;
  const type = types.find((t) => t.id === typeId);
  const column = columns.find((c) => c.id === columnId);
  const brand = projects.find((p) => p.id === projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[4vh] backdrop-blur-[2px]" onClick={() => { if (!saving) onClose(); }}>
      <div className="flex w-full max-w-[940px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col p-7">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Create task</h2>
              <p className="text-sm text-muted-foreground">Pick the brand, add the brief and references, then assign it.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><FontAwesomeIcon icon={faXmark} className="h-4 w-4" /></button>
          </div>
          <input
            ref={titleRef} value={title} maxLength={500} placeholder="Task name"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            className="mb-3 h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] font-medium shadow-sm placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <RichTextEditor value={description} onChange={setDescription} placeholder="Add a description…" minHeight={110} />

          <div className="mt-4 space-y-3">
            <PendingSection kind="brief" note={briefNote} onNote={setBriefNote} files={briefFiles} onFiles={setBriefFiles} links={briefLinks} onLinks={setBriefLinks} />
            <PendingSection kind="reference" note={refNote} onNote={setRefNote} files={refFiles} onFiles={setRefFiles} links={refLinks} onLinks={setRefLinks} />
            <PendingSection kind="main" note={mainNote} onNote={setMainNote} files={mainFiles} onFiles={setMainFiles} links={mainLinks} onLinks={setMainLinks} />
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 border-t pt-5 md:mt-6">
            {saving && <span className="mr-auto text-xs text-muted-foreground">{saving}</span>}
            <Button variant="outline" onClick={onClose} disabled={!!saving}>Cancel</Button>
            <Button className="px-6" onClick={submit} disabled={!canSubmit} title={brandMissing ? "Select a brand first" : undefined}>
              {saving && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Create task
            </Button>
          </div>
        </div>

        {/* Right: properties */}
        <div className="w-full shrink-0 space-y-4 border-t bg-muted/30 p-6 md:w-[290px] md:border-l md:border-t-0">
          <Field label="Brand" required={projects.length > 0}>
            <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
              <SelectTrigger className={cn(trigger, brandMissing && "border-amber-500/60")}>
                <T>{brand
                  ? <><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold text-white" style={{ backgroundColor: brand.color ?? "#6366f1" }}>{initials(brand.name)}</span><span className="truncate">{brand.name}</span></>
                  : <span className="text-muted-foreground">{projects.length ? "Select a brand" : "No brands yet"}</span>}</T>
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 && <SelectItem value={NONE}>No brand</SelectItem>}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color ?? "#6366f1" }} />{p.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && <p className="text-[11px] text-muted-foreground">A team lead can add brands from the Brands tab.</p>}
          </Field>
          <Field label="Create in">
            <Select value={teamId || NONE} onValueChange={(v) => {
              const next = v === NONE ? "" : v;
              setTeamId(next);
              // Only the chosen team's members can be assigned; drop anyone else.
              const t = teams.find((x) => x.id === next);
              if (t) setAssignees((p) => {
                const kept = p.filter((m) => t.member_ids.includes(m.id));
                if (kept.length < p.length) toast.info(`Removed assignees who are not in ${t.name}`);
                return kept;
              });
            }}>
              <SelectTrigger className={trigger}>
                <T>{teams.find((t) => t.id === teamId)
                  ? <><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: teams.find((t) => t.id === teamId)?.color ?? "#6366f1" }} /><span className="truncate">{teams.find((t) => t.id === teamId)?.name}</span></>
                  : <span className="text-muted-foreground">Everyone (no team)</span>}</T>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Everyone (no team)</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color ?? "#6366f1" }} />{t.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{teamId ? "Only this team's members can see the task." : "Everyone can see the task."}</p>
          </Field>
          <Field label="Type">
            <Select value={typeId || NONE} onValueChange={(v) => setTypeId(v === NONE ? "" : v)}>
              <SelectTrigger className={trigger}><T>{type ? <><span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: type.color }} />{type.name}</> : <span className="text-muted-foreground">No type</span>}</T></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No type</SelectItem>
                {types.map((t) => <SelectItem key={t.id} value={t.id}><span className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ backgroundColor: t.color }} />{t.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            {columns.length > 0 ? (
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger className={trigger}><T><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: column?.color ?? "#94a3b8" }} />{column?.name}</T></SelectTrigger>
                <SelectContent>{columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className={trigger}><T><span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_CONFIG[status].dot)} />{STATUS_CONFIG[status].label}</T></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Assignee">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 shadow-sm">
              <AssigneePicker emptyLabel="Unassigned" value={assignees} members={pickable} teams={pickableTeams}
                onAddUsers={(ids) => setAssignees((p) => [...p, ...members.filter((m) => ids.includes(m.id) && !p.some((x) => x.id === m.id))])}
                onAddTeam={(tid) => { const t = teams.find((x) => x.id === tid); if (t) setAssignees((p) => [...p, ...members.filter((m) => t.member_ids.includes(m.id) && !p.some((x) => x.id === m.id))]); }}
                onRemove={(id) => setAssignees((p) => p.filter((m) => m.id !== id))} />
            </div>
          </Field>
          <Field label="Schedule this task for">
            <label className={cn(box, "cursor-pointer")}>
              <FontAwesomeIcon icon={faCalendar} className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} className="flex-1 bg-transparent focus:outline-none" />
            </label>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{planned ? (planned === todayISO() ? "Today" : "Scheduled") : "In waiting list"}</span>
              {planned && <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => setPlanned("")}>Move to waiting list</button>}
            </div>
          </Field>
          <Field label="Deadline">
            <label className={cn(box, "cursor-pointer")}>
              <FontAwesomeIcon icon={faBullseye} className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1 bg-transparent focus:outline-none" />
            </label>
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className={trigger}><T>{priority === "none" ? <><FontAwesomeIcon icon={faFlag} className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">No priority</span></> : <PriorityLabel priority={priority} />}</T></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}><PriorityLabel priority={p} /></SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Repeat">
            <Select value={repeat || NONE} onValueChange={(v) => setRepeat(v === NONE ? "" : v)}>
              <SelectTrigger className={trigger}>
                <T><FontAwesomeIcon icon={faArrowsRotate} className="h-3 w-3 text-muted-foreground" />{RECURRING_OPTIONS.find((o) => o.value === repeat)?.label ?? <span className="text-muted-foreground">Does not repeat</span>}</T>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Does not repeat</SelectItem>
                {RECURRING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Created by">
            <span className={cn(box, "bg-muted/40 text-muted-foreground")}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">{initials(members.find((m) => m.id === currentUserId)?.full_name)}</span>
              <span className="text-foreground">Me</span>
            </span>
          </Field>
        </div>
      </div>
    </div>
  );
}
