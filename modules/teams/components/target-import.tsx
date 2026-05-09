"use client";

import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImportedRow {
  name: string;
  revenue: number;
  calls: number;
  emails: number;
  closures: number;
}

interface TargetImportProps {
  onImport: (rows: ImportedRow[]) => void;
}

export function TargetImport({ onImport }: TargetImportProps) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function parseFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
      const parsed: ImportedRow[] = rows.map((r) => ({
        name:     String(r["Name"] ?? r["name"] ?? ""),
        revenue:  Number(r["Revenue"] ?? r["revenue"] ?? 0),
        calls:    Number(r["Calls"] ?? r["calls"] ?? 0),
        emails:   Number(r["Emails"] ?? r["emails"] ?? 0),
        closures: Number(r["Closures"] ?? r["closures"] ?? 0),
      })).filter((r) => r.name);
      if (!parsed.length) throw new Error("No valid rows found. Ensure columns: Name, Revenue, Calls, Emails, Closures.");
      setPreview(parsed.slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
      setPreview([]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  }

  function handleImport() {
    onImport(preview);
    setImported(true);
    setTimeout(() => setImported(false), 3000);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
          dragging ? "border-purple-400 bg-purple-50/50 dark:bg-purple-950/10" : "border-border hover:border-purple-300 dark:hover:border-purple-700"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInput} />
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Drop your Excel / CSV file here</p>
        <p className="text-xs text-muted-foreground mt-1">Columns: Name, Revenue, Calls, Emails, Closures</p>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          <Upload className="h-3.5 w-3.5" />Browse file
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-4 py-3 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview ({fileName})</p>
            {imported ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Imported!</span>
            ) : (
              <Button size="sm" className="h-7 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleImport}>
                Import {preview.length} rows
              </Button>
            )}
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>{["Name","Revenue","Calls","Emails","Closures"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">₹{r.revenue.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.calls}</td>
                    <td className="px-3 py-2">{r.emails}</td>
                    <td className="px-3 py-2">{r.closures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
