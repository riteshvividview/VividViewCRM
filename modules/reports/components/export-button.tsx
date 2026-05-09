"use client";

import { useState } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  filename: string;
  data: Record<string, unknown>[];
  columns?: string[];
}

export function ExportButton({ filename, data, columns }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function exportXlsx() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally { setExporting(false); }
  }

  function exportCsv() {
    const keys = columns ?? (data[0] ? Object.keys(data[0]) : []);
    const header = keys.join(",");
    const rows = data.map((r) => keys.map((k) => {
      const v = r[k];
      const s = v == null ? "" : String(v);
      return s.includes(",") ? `"${s}"` : s;
    }).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPrint() {
    window.print();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={exporting}>
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={exportXlsx}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-emerald-600" />Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCsv}>
          <FileText className="h-3.5 w-3.5 mr-2 text-blue-600" />CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPrint}>
          <Printer className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
