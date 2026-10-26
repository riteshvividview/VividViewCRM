"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TaskAttachment } from "../types";
import { cn } from "@/lib/utils";

function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** File attachments on a task (stored in the private task-attachments bucket). */
export function TaskAttachments({ taskId }: { taskId: string }) {
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/attachments`);
    if (res.ok) setFiles((await res.json()).attachments ?? []);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    const tooBig = arr.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) { toast.error(`${tooBig.name} is larger than 25 MB`); return; }
    setUploading(true);
    const form = new FormData();
    arr.forEach((f) => form.append("file", f));
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { toast.error(json.error ?? "Upload failed"); return; }
    toast.success(arr.length > 1 ? `${arr.length} files attached` : "File attached");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${taskId}/attachments?attachment_id=${id}`, { method: "DELETE" });
    if (res.ok) setFiles((f) => f.filter((x) => x.id !== id));
    else toast.error("Could not delete file");
  }

  return (
    <div
      className={cn("px-5 py-4 border-b border-border/50 transition-colors", dragOver && "bg-primary/5")}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); } }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />Files {files.length > 0 && <span className="normal-case font-normal">({files.length})</span>}
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}Upload
        </Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">Drop files here or click Upload (max 25 MB each).</p>
      ) : (
        <div className="grid grid-cols-1 gap-1">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
              {f.mime_type?.startsWith("image/") && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-8 w-8 rounded object-cover border" />
              ) : (
                <span className="h-8 w-8 rounded border flex items-center justify-center"><FileText className="h-4 w-4 text-muted-foreground" /></span>
              )}
              <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm truncate hover:underline">{f.file_name}</a>
              <span className="text-xs text-muted-foreground">{fmtSize(f.size_bytes)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(f.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
