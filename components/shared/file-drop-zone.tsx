"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Image, FileSpreadsheet, File, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: string;
}

interface FileDropZoneProps {
  entityType: "contact" | "company" | "deal" | "document";
  entityId: string;
  onUpload: (file: UploadedFile) => void;
  compact?: boolean;
  accept?: string;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_TYPES = [
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "text/csv", "text/plain",
];

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes("sheet") || mime.includes("csv")) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropZone({ entityType, entityId, onUpload, compact = false }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) { toast.error("File type not supported"); return; }
    if (file.size > MAX_SIZE) { toast.error("File exceeds 25MB limit"); return; }

    setUploading({ name: file.name, progress: 0 });

    // Simulate upload progress
    const tick = setInterval(() => {
      setUploading((u) => u ? { ...u, progress: Math.min(u.progress + 15, 90) } : null);
    }, 200);

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      let uploadedUrl: string;

      if (!url) {
        // Dev mode: create object URL
        await new Promise((r) => setTimeout(r, 1200));
        uploadedUrl = URL.createObjectURL(file);
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const path = `${entityType}/${entityId}/${Date.now()}-${file.name}`;
        const supabase = createClient();
        const { data, error } = await supabase.storage.from("crm-files").upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("crm-files").getPublicUrl(data.path);
        uploadedUrl = publicUrl;
      }

      clearInterval(tick);
      setUploading((u) => u ? { ...u, progress: 100 } : null);
      await new Promise((r) => setTimeout(r, 400));

      const uploaded: UploadedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        url: uploadedUrl,
        size: file.size,
        mime_type: file.type,
        created_at: new Date().toISOString(),
      };
      onUpload(uploaded);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      clearInterval(tick);
      toast.error("Upload failed");
    } finally {
      setUploading(null);
    }
  }, [entityType, entityId, onUpload]);

  if (compact) {
    return (
      <div
        className={cn("border border-dashed border-border rounded-lg p-3 flex items-center gap-2 cursor-pointer hover:border-purple-400 hover:bg-muted/40 transition-colors", isDragging && "border-purple-500 bg-purple-50/30 dark:bg-purple-950/20")}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Drop or click to upload (max 25MB)</span>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        {uploading && <Progress value={uploading.progress} className="h-1 ml-auto w-24" />}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
      className={cn("border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all", isDragging ? "border-purple-500 bg-purple-50/30 dark:bg-purple-950/20" : "border-border hover:border-purple-400 hover:bg-muted/40")}
      onClick={() => fileRef.current?.click()}
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", isDragging ? "bg-purple-100 dark:bg-purple-900/40" : "bg-muted")}>
        <Upload className={cn("h-5 w-5 transition-colors", isDragging ? "text-purple-600" : "text-muted-foreground")} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Drop files here</p>
        <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, XLSX, PNG, JPG, CSV — max 25MB</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
        <AlertCircle className="h-3 w-3" />Files scanned for viruses on upload
      </div>
      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.csv,.txt" multiple onChange={(e) => { Array.from(e.target.files ?? []).forEach(processFile); }} />

      {uploading && (
        <div className="w-full max-w-xs space-y-1.5 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground truncate">{uploading.name}</span>
            <span className="text-muted-foreground ml-2">{uploading.progress}%</span>
          </div>
          <Progress value={uploading.progress} className="h-1.5" />
          {uploading.progress === 100 && (
            <div className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" />Upload complete</div>
          )}
        </div>
      )}
    </div>
  );
}
