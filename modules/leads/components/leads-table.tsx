"use client";

import { useState, useMemo } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  type ColumnDef, type SortingState, flexRender,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScorePill } from "@/components/shared/score-pill";
import { STATUS_CONFIG, type Lead, type LeadStatus } from "../types";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LeadsTableProps {
  leads: Lead[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}

function StatusChip({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", dot: "bg-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border", cfg.color, cfg.bg, cfg.border)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {status}
    </span>
  );
}

function InlineEditCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full bg-background border border-purple-400 rounded px-1.5 py-0.5 text-sm outline-none ring-1 ring-purple-400"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); if (val !== value) onSave(val); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (val !== value) onSave(val); } if (e.key === "Escape") { setEditing(false); setVal(value); } }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer group flex items-center gap-1 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      onDoubleClick={() => setEditing(true)}
    >
      {value || <span className="text-muted-foreground/50">—</span>}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </span>
  );
}

const AVATAR_COLORS = ["bg-purple-100 text-purple-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

export function LeadsTable({ leads, selectedIds, onSelectionChange, onEditLead, onDeleteLead, onStatusChange }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(leads.map((l) => l.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={selectedIds.has(row.original.id)} onCheckedChange={() => toggleOne(row.original.id)} />
      ),
      size: 40, enableSorting: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortHeader column={column} label="Name" />,
      cell: ({ row }) => {
        const lead = row.original;
        const colorClass = AVATAR_COLORS[lead.name.charCodeAt(0) % AVATAR_COLORS.length];
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className={cn("text-xs font-semibold", colorClass)}>{getInitials(lead.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <InlineEditCell value={lead.name} onSave={(v) => {}} />
              {lead.email && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{lead.email}</p>}
            </div>
          </div>
        );
      },
      size: 240,
    },
    {
      accessorKey: "company",
      header: ({ column }) => <SortHeader column={column} label="Company" />,
      cell: ({ row }) => <span className="text-sm text-foreground">{row.original.company || <span className="text-muted-foreground/50">—</span>}</span>,
      size: 160,
    },
    {
      accessorKey: "source",
      header: ({ column }) => <SortHeader column={column} label="Source" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.source || "—"}</span>,
      size: 130,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortHeader column={column} label="Status" />,
      cell: ({ row }) => <StatusChip status={row.original.status} />,
      size: 130,
    },
    {
      accessorKey: "score",
      header: ({ column }) => <SortHeader column={column} label="Score" />,
      cell: ({ row }) => <ScorePill score={row.original.score} showBar />,
      size: 110,
    },
    {
      accessorKey: "assigned_name",
      header: ({ column }) => <SortHeader column={column} label="Assigned To" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.assigned_name || <span className="text-muted-foreground/50">—</span>}</span>
      ),
      size: 130,
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <SortHeader column={column} label="Created" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.created_at)}</span>,
      size: 110,
    },
    {
      id: "actions",
      enableSorting: false,
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover/row:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEditLead(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteLead(row.original.id)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [leads, selectedIds, allSelected, someSelected]);

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left whitespace-nowrap"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group/row cursor-pointer", selectedIds.has(row.original.id) && "bg-purple-50/50 dark:bg-purple-950/20")}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5" style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={columns.length} className="py-16 text-center text-sm text-muted-foreground">No leads found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({ column, label }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: () => void }; label: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {label}
      {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}
