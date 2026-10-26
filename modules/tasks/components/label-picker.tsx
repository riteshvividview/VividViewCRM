"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { TaskLabel } from "../types";

interface LabelPickerProps {
  value: TaskLabel[];
  labels: TaskLabel[];
  onAdd: (labelId: string) => void;
  onRemove: (labelId: string) => void;
}

/** Picks workspace labels ("Type") onto a task — reusable across detail panel, table, and board. */
export function LabelPicker({ value, labels, onAdd, onRemove }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(value.map((v) => v.id));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {value.map((l) => (
        <span
          key={l.id}
          className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${l.color}1a`, color: l.color }}
        >
          {l.name}
          <button type="button" onClick={() => onRemove(l.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-dashed border-border">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Labels</DropdownMenuLabel>
          {labels.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet</p>}
          {labels.map((l) => (
            <DropdownMenuCheckboxItem
              key={l.id}
              checked={selectedIds.has(l.id)}
              onCheckedChange={(checked) => { if (checked) onAdd(l.id); else onRemove(l.id); }}
              onSelect={(e) => e.preventDefault()}
              className="text-sm gap-2"
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
              {l.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
