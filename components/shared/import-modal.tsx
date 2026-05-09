"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ImportField = { key: string; label: string; required?: boolean };

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  fields: ImportField[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  entityName: string;
}

type Step = "drop" | "map" | "preview" | "done";

export function ImportModal({ open, onClose, fields, onImport, entityName }: ImportModalProps) {
  const [step, setStep] = useState<Step>("drop");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("drop"); setFileName(""); setHeaders([]); setRows([]); setMapping({}); };

  const handleClose = () => { reset(); onClose(); };

  const parseFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv" || ext === "txt") {
        const Papa = (await import("papaparse")).default;
        const text = await file.text();
        const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
        const [hdrs, ...data] = result.data as string[][];
        setHeaders(hdrs);
        setRows(data);
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
        const [hdrs, ...rest] = data;
        setHeaders(hdrs.map(String));
        setRows(rest);
      }

      // Auto-map obvious matches
      const autoMap: Record<string, string> = {};
      fields.forEach((f) => {
        const match = headers.find((h) => h.toLowerCase().replace(/[^a-z]/g, "").includes(f.key.replace(/_/g, "").toLowerCase()) || h.toLowerCase() === f.label.toLowerCase());
        if (match) autoMap[f.key] = match;
      });
      setMapping(autoMap);
      setStep("map");
    } catch {
      toast.error("Could not parse file. Please use .csv or .xlsx format.");
    }
  }, [fields, headers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const previewRows = rows.slice(0, 5).map((row) => {
    const obj: Record<string, string> = {};
    fields.forEach((f) => {
      const col = mapping[f.key];
      if (col) { const idx = headers.indexOf(col); obj[f.key] = idx >= 0 ? (row[idx] ?? "") : ""; }
    });
    return obj;
  });

  const handleConfirmImport = async () => {
    setImporting(true);
    const mapped = rows.map((row) => {
      const obj: Record<string, string> = {};
      fields.forEach((f) => {
        const col = mapping[f.key];
        if (col) { const idx = headers.indexOf(col); obj[f.key] = idx >= 0 ? (row[idx] ?? "") : ""; }
      });
      return obj;
    });
    try {
      await onImport(mapped);
      setStep("done");
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {entityName}</DialogTitle>
          <DialogDescription>Upload a CSV or Excel file to bulk-import {entityName.toLowerCase()}.</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-2">
          {(["drop", "map", "preview", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                step === s ? "bg-purple-700 text-white" : ["drop","map","preview","done"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                {["drop","map","preview","done"].indexOf(step) > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 3 && <div className={cn("w-8 h-0.5", ["drop","map","preview","done"].indexOf(step) > i ? "bg-emerald-500" : "bg-muted")} />}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground capitalize">{step}</span>
        </div>

        {step === "drop" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn("border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors",
              isDragging ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-purple-400 hover:bg-muted/40")}
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", isDragging ? "bg-purple-100 dark:bg-purple-900/50" : "bg-muted")}>
              <FileSpreadsheet className={cn("w-7 h-7 transition-colors", isDragging ? "text-purple-600" : "text-muted-foreground")} />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Drop your Excel or CSV here</p>
              <p className="text-sm text-muted-foreground mt-0.5">or click to browse — .csv, .xlsx, .xls supported</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-foreground">{fileName}</span>
              <span>— {rows.length} rows detected</span>
            </div>
            <p className="text-sm font-medium text-foreground">Map your columns to CRM fields</p>
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {fields.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <span className="text-sm text-foreground">{f.label}</span>
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Select value={mapping[f.key] ?? ""} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="— skip —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("drop")}>Back</Button>
              <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white" onClick={() => setStep("preview")}>Preview →</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Showing first 5 of <strong className="text-foreground">{rows.length}</strong> rows</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>{fields.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="px-3 py-2 text-left font-semibold text-muted-foreground">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      {fields.filter((f) => mapping[f.key]).map((f) => <td key={f.key} className="px-3 py-2 text-foreground truncate max-w-[120px]">{row[f.key] || <span className="text-muted-foreground italic">empty</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{rows.length} records will be imported. This cannot be undone.</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setStep("map")}>Back</Button>
              <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white" onClick={handleConfirmImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${rows.length} records`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-foreground">Import successful!</h3>
            <p className="text-sm text-muted-foreground">{rows.length} {entityName.toLowerCase()} have been added to your CRM.</p>
            <Button size="sm" className="mt-2 bg-purple-700 hover:bg-purple-800 text-white" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Page-level drop zone hook
export function usePageDrop(onFile: (file: File) => void) {
  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const counter = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) { counter.current++; setIsDraggingPage(true); }
  }, []);
  const handleDragLeave = useCallback(() => {
    counter.current--;
    if (counter.current <= 0) { counter.current = 0; setIsDraggingPage(false); }
  }, []);
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); counter.current = 0; setIsDraggingPage(false);
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  }, [onFile]);
  const handleDragOver = useCallback((e: DragEvent) => e.preventDefault(), []);

  const bind = useCallback(() => {
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragover", handleDragOver);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragover", handleDragOver);
    };
  }, [handleDragEnter, handleDragLeave, handleDrop, handleDragOver]);

  return { isDraggingPage, bind };
}
