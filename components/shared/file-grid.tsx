"use client";
import { useState } from "react";
import { FileText, Image, FileSpreadsheet, File, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "./file-drop-zone";
import { formatBytes } from "./file-drop-zone";
import { formatDate, cn } from "@/lib/utils";

interface FileGridProps {
  files: UploadedFile[];
  onDelete?: (id: string) => void;
}

function FileTypeIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
  if (mime.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes("sheet") || mime.includes("csv")) return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function FileGrid({ files, onDelete }: FileGridProps) {
  const [preview, setPreview] = useState<UploadedFile | null>(null);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <File className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No files yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {files.map((file) => {
          const isImage = file.mime_type.startsWith("image/");
          return (
            <div key={file.id} className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-sm transition-all">
              {isImage ? (
                <div className="h-28 bg-muted cursor-pointer" onClick={() => setPreview(file)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ) : (
                <div className="h-28 bg-muted/60 flex items-center justify-center">
                  <FileTypeIcon mime={file.mime_type} />
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {/* Hover actions */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={file.url} download={file.name} onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="secondary" className="h-6 w-6 shadow"><Download className="h-3 w-3" /></Button>
                </a>
                {onDelete && (
                  <Button size="icon" variant="destructive" className="h-6 w-6 shadow" onClick={() => onDelete(file.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={preview.name} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 text-white/70 text-sm">{preview.name} · {formatBytes(preview.size)}</div>
        </div>
      )}
    </>
  );
}
