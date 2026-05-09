"use client";

import { useRef, useState } from "react";
import { Upload, FileImage, FileVideo, FileText, File, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CampaignAsset } from "../types";
import { cn } from "@/lib/utils";

function AssetIcon({ type }: { type: CampaignAsset["type"] }) {
  if (type === "image") return <FileImage className="h-6 w-6 text-blue-500" />;
  if (type === "video") return <FileVideo className="h-6 w-6 text-purple-500" />;
  if (type === "pdf")   return <FileText className="h-6 w-6 text-red-500" />;
  return <File className="h-6 w-6 text-slate-400" />;
}

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

interface AssetLibraryProps {
  assets: CampaignAsset[];
  onAdd: (asset: CampaignAsset) => void;
  onDelete: (id: string) => void;
}

export function AssetLibrary({ assets, onAdd, onDelete }: AssetLibraryProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function typeFromMime(mime: string): CampaignAsset["type"] {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime === "application/pdf") return "pdf";
    return "doc";
  }

  function addFile(file: File) {
    const asset: CampaignAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      type: typeFromMime(file.type),
      url: URL.createObjectURL(file),
      size_kb: Math.round(file.size / 1024),
      uploaded_at: new Date().toISOString(),
    };
    onAdd(asset);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(addFile);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(addFile);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-colors",
          dragging ? "border-purple-400 bg-purple-50/50 dark:bg-purple-950/10" : "border-border hover:border-purple-300 dark:hover:border-purple-700"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInput} />
        <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Drop creatives here or <span className="text-purple-600 font-medium">browse</span></p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Images, PDFs, Videos, Docs</p>
      </div>

      {/* Asset grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:bg-muted/30 transition-colors group">
              <div className="shrink-0"><AssetIcon type={asset.type} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(asset.size_kb)}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {asset.url && (
                  <a href={asset.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No assets uploaded yet</p>
      )}
    </div>
  );
}
