"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faFile, faFileImage, faFileVideo, faFilePdf, faTrashCan } from "@fortawesome/free-regular-svg-icons";
import {
  faFileLines, faImages, faCircleCheck, faCloudArrowUp, faLink, faSpinner, faArrowUpRightFromSquare, faDownload, faLock,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { TaskAttachment, TaskFileKind } from "../types";
import { addTaskLink, formatFileSize, uploadTaskFile } from "../lib/upload";
import { cn } from "@/lib/utils";
import { useShellProfile } from "@/lib/supabase/profile-context";

type SectionKind = Exclude<TaskFileKind, "chat">;

export const FILE_SECTIONS: Record<SectionKind, { title: string; purpose: string; hint: string; notePlaceholder: string; icon: IconDefinition; accent: string }> = {
  brief: {
    title: "Brief", purpose: "The concept and requirements: what to make and how it should look.", hint: "What needs to be done. Kept forever.", notePlaceholder: "Short note about the brief (optional)",
    icon: faFileLines, accent: "text-sky-500",
  },
  reference: {
    title: "References", purpose: "Examples and inspiration to follow, such as past work or other brands.", hint: "Examples to follow. Removed 30 days after the task is completed.", notePlaceholder: "Short note about the references (optional)",
    icon: faImages, accent: "text-violet-500",
  },
  main: {
    title: "Main file", purpose: "The final deliverable. Upload it to complete the task.", hint: "The final deliverable. Required to complete the task. Kept forever.", notePlaceholder: "Short note about the final file (optional)",
    icon: faCircleCheck, accent: "text-emerald-500",
  },
};

export function fileIcon(mime: string | null, isLink = false): IconDefinition {
  if (isLink) return faLink;
  if (mime?.startsWith("image/")) return faFileImage;
  if (mime?.startsWith("video/")) return faFileVideo;
  if (mime === "application/pdf") return faFilePdf;
  return faFile;
}

/** Dashed drop area + browse button shared by the task view and the Create task dialog. */
export function DropZone({ onFiles, busy, progress, disabled, compact, label = "Drop files here or click to upload" }: {
  onFiles: (files: File[]) => void; busy?: boolean; progress?: number | null; disabled?: boolean; compact?: boolean; label?: string;
}) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button" disabled={disabled || busy}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { if (!disabled && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files)); }}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors",
        compact ? "px-3 py-2.5" : "px-3 py-4",
        over ? "border-primary bg-primary/5 text-foreground" : "hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground",
        (disabled || busy) && "cursor-not-allowed opacity-70",
      )}
    >
      <FontAwesomeIcon icon={busy ? faSpinner : faCloudArrowUp} spin={busy} className="h-4 w-4" />
      {busy ? `Uploading${progress != null ? ` ${progress}%` : "…"}` : label}
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
    </button>
  );
}

function FileRow({ f, onRemove }: { f: TaskAttachment; onRemove?: () => void }) {
  const purged = !!f.purged_at;
  const isLink = !!f.link_url;
  return (
    <div className="group flex items-center gap-2.5 rounded-md border bg-background px-2.5 py-1.5 shadow-sm">
      {f.mime_type?.startsWith("image/") && f.url && !purged ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><FontAwesomeIcon icon={fileIcon(f.mime_type, isLink)} className="h-3.5 w-3.5" /></span>
      )}
      <div className="min-w-0 flex-1">
        {purged ? (
          <p className="truncate text-[13px] text-muted-foreground line-through">{f.file_name}</p>
        ) : (
          <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:underline">{f.file_name}</a>
        )}
        <p className="text-[11px] text-muted-foreground">
          {purged ? "Was attached here; the file has been cleaned up" : isLink ? "Link" : formatFileSize(f.size_bytes)}
        </p>
      </div>
      {!purged && f.url && (
        <a href={isLink ? f.url : f.download_url ?? f.url} target={isLink ? "_blank" : undefined} rel="noreferrer" title={isLink ? "Open link" : "Download"} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <FontAwesomeIcon icon={isLink ? faArrowUpRightFromSquare : faDownload} className="h-3 w-3" />
        </a>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove" className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-red-500 group-hover:opacity-100">
          <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Section({ taskId, kind, files, note, canUpload, readOnly, onNoteSave, onChanged }: {
  taskId: string; kind: SectionKind; files: TaskAttachment[]; note: string | null; canUpload: boolean; readOnly?: boolean;
  onNoteSave: (note: string | null) => void; onChanged: () => void;
}) {
  const meta = FILE_SECTIONS[kind];
  // How files are kept is explained to the CEO and team leads only.
  const role = useShellProfile()?.role;
  const showHints = role === "super_admin" || role === "team_lead";
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function upload(list: File[]) {
    setBusy(true);
    let ok = 0;
    for (const file of list) {
      setProgress(0);
      try { await uploadTaskFile(taskId, file, kind, setProgress); ok++; }
      catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    }
    setBusy(false);
    setProgress(null);
    if (ok) { toast.success(kind === "main" ? "Main file submitted" : ok > 1 ? `${ok} files added` : "File added"); onChanged(); }
  }

  async function saveLink() {
    if (!link?.trim()) { setLink(null); return; }
    try { await addTaskLink(taskId, link.trim(), kind); setLink(null); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not add link"); }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${taskId}/attachments?attachment_id=${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
    else toast.error((await res.json().catch(() => ({}))).error ?? "Could not remove file");
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4", kind === "main" && files.length === 0 && "border-dashed border-emerald-500/50")}>
      <div className="mb-2.5 flex items-start gap-2.5">
        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted", meta.accent)}><FontAwesomeIcon icon={meta.icon} className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {meta.title}
            {files.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{files.length}</span>}
            {kind === "main" && files.length === 0 && <span className="rounded-full bg-amber-500/15 px-2 py-px text-[11px] font-medium text-amber-600 dark:text-amber-400">Required</span>}
          </p>
          <p className="text-xs text-muted-foreground">{meta.purpose}</p>
          {showHints && <p className="text-[11px] text-muted-foreground/80">{meta.hint}</p>}
        </div>
      </div>

      <textarea
        key={`${taskId}-${kind}-${note ?? ""}`} rows={1} defaultValue={note ?? ""} placeholder={readOnly ? "No note" : meta.notePlaceholder} maxLength={2000} readOnly={readOnly}
        onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (note ?? null)) onNoteSave(v); }}
        className="mb-2.5 block min-h-[34px] w-full resize-y rounded-md border border-transparent bg-muted/40 px-2.5 py-1.5 text-[13px] placeholder:text-muted-foreground hover:border-border focus:border-input focus:bg-background focus:outline-none"
      />

      {files.length > 0 && (
        <div className="mb-2.5 space-y-1.5">
          {files.map((f) => <FileRow key={f.id} f={f} onRemove={f.purged_at || readOnly ? undefined : () => remove(f.id)} />)}
        </div>
      )}

      {readOnly ? (
        files.length === 0 && <p className="text-xs text-muted-foreground">No files.</p>
      ) : canUpload ? (
        <>
          <DropZone onFiles={upload} busy={busy} progress={progress} compact
            label={kind === "main" ? "Drop the final file here or click to upload" : "Drop files here or click to upload"} />
          {(kind === "reference" || kind === "brief") && (
            link === null ? (
              <button type="button" onClick={() => setLink("")} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <FontAwesomeIcon icon={faLink} className="h-3 w-3" />Paste a link instead
              </button>
            ) : (
              <input autoFocus value={link} placeholder="https://… then press Enter" onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveLink(); if (e.key === "Escape") setLink(null); }} onBlur={saveLink}
                className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            )
          )}
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FontAwesomeIcon icon={faLock} className="h-3 w-3" />Only the assignees can submit the main file.</p>
      )}
    </div>
  );
}

/** Brief, References and Main file sections of a task. */
export function TaskFiles({ taskId, version, readOnly, notes, onNoteSave, onFilesChanged }: {
  /** View only: files can be opened and downloaded but not added or removed. */
  readOnly?: boolean;
  taskId: string;
  /** Changes when the task's files change elsewhere, to re-read the list. */
  version?: string;
  notes: Record<SectionKind, string | null>;
  onNoteSave: (kind: SectionKind, note: string | null) => void;
  /** Called after any upload / removal so the task (has_main_file, counters) can refresh. */
  onFilesChanged: () => void;
}) {
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [canSubmitMain, setCanSubmitMain] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/attachments`);
    if (!res.ok) return;
    const json = await res.json();
    setFiles(json.attachments ?? []);
    setCanSubmitMain(json.can_submit_main !== false);
  }, [taskId]);

  useEffect(() => { setFiles([]); load(); }, [load]);
  useEffect(() => { load(); }, [load, version]);

  const changed = () => { load(); onFilesChanged(); };
  return (
    <section className="space-y-3 border-t px-4 py-4 sm:px-6">
      {(["brief", "reference", "main"] as SectionKind[]).map((kind) => (
        <Section key={kind} taskId={taskId} kind={kind} files={files.filter((f) => f.kind === kind)} note={notes[kind]}
          canUpload={kind !== "main" || canSubmitMain} readOnly={readOnly} onNoteSave={(n) => onNoteSave(kind, n)} onChanged={changed} />
      ))}
    </section>
  );
}
