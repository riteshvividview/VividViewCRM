"use client";

import { dateLocale } from "@/lib/user-prefs";
import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faSpinner, faFolderOpen, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FILE_SECTIONS, fileIcon } from "./task-files";
import { formatFileSize } from "../lib/upload";
import { cn } from "@/lib/utils";

interface BrandFile {
  id: string; task_id: string; kind: "brief" | "main"; file_name: string; size_bytes: number | null; mime_type: string | null;
  link_url: string | null; url: string | null; created_at: string; task_title: string; task_number: number | null; task_done: boolean; month: string;
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(dateLocale(), { month: "long", year: "numeric" });

/** Brand archive: the brief and main files of every task of the brand, grouped by month. */
export function BrandFiles({ projectId, onOpenTask }: { projectId: string; onOpenTask: (taskId: string) => void }) {
  const [files, setFiles] = useState<BrandFile[] | null>(null);
  const [kind, setKind] = useState<"all" | "main" | "brief">("all");

  useEffect(() => {
    setFiles(null);
    fetch(`/api/tasks/projects/${projectId}/files`).then((r) => r.json()).then((j) => setFiles(j.files ?? [])).catch(() => setFiles([]));
  }, [projectId]);

  const months = useMemo(() => {
    const map = new Map<string, BrandFile[]>();
    for (const f of (files ?? []).filter((x) => kind === "all" || x.kind === kind)) map.set(f.month, [...(map.get(f.month) ?? []), f]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [files, kind]);

  if (!files) return <div className="flex justify-center py-24"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-muted p-1">
          {([["all", "All files"], ["main", "Main files"], ["brief", "Briefs"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setKind(v)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium", kind === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Brief and main files are kept forever. References and chat media are removed 30 days after a task is completed.</p>
      </div>

      {months.length === 0 && (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <FontAwesomeIcon icon={faFolderOpen} className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-medium">No files yet</p>
          <p className="text-sm text-muted-foreground">Briefs and main files of this brand&apos;s tasks appear here, month by month.</p>
        </div>
      )}

      {months.map(([month, list]) => (
        <section key={month} className="mb-6">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FontAwesomeIcon icon={faFolderOpen} className="h-3.5 w-3.5 text-muted-foreground" />{monthLabel(month)}
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{list.length}</span>
          </h3>
          <div className="overflow-hidden rounded-xl border bg-card">
            {list.map((f) => {
              const meta = FILE_SECTIONS[f.kind];
              return (
                <div key={f.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><FontAwesomeIcon icon={fileIcon(f.mime_type, !!f.link_url)} className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:underline">{f.file_name}</a>
                    <button onClick={() => onOpenTask(f.task_id)} className="block max-w-full truncate text-left text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                      {f.task_number ? `#${f.task_number} · ` : ""}{f.task_title}
                    </button>
                  </div>
                  <span className={cn("hidden items-center gap-1.5 text-xs sm:inline-flex", meta.accent)}><FontAwesomeIcon icon={meta.icon} className="h-3 w-3" />{meta.title}</span>
                  <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{f.link_url ? "Link" : formatFileSize(f.size_bytes)}</span>
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" title={f.link_url ? "Open link" : "Download"} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <FontAwesomeIcon icon={f.link_url ? faArrowUpRightFromSquare : faDownload} className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
