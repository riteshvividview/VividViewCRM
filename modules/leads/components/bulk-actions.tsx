"use client";

import { Users, Tag, Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionsProps {
  selectedCount: number;
  onAssign: () => void;
  onChangeStatus: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActions({ selectedCount, onAssign, onChangeStatus, onExport, onDelete, onClear }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="animate-slide-in-left flex items-center gap-2 bg-purple-700 text-white rounded-xl px-4 py-2.5 shadow-lg shadow-purple-200/50 dark:shadow-purple-900/50">
      <span className="text-sm font-semibold">{selectedCount} selected</span>
      <div className="w-px h-4 bg-white/20 mx-1" />
      <Button variant="ghost" size="sm" className="h-7 text-white hover:bg-white/20 gap-1.5 text-xs" onClick={onAssign}>
        <Users className="h-3.5 w-3.5" />Assign
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-white hover:bg-white/20 gap-1.5 text-xs" onClick={onChangeStatus}>
        <Tag className="h-3.5 w-3.5" />Status
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-white hover:bg-white/20 gap-1.5 text-xs" onClick={onExport}>
        <Download className="h-3.5 w-3.5" />Export
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-white hover:bg-white/20 gap-1.5 text-xs" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />Delete
      </Button>
      <button onClick={onClear} className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
