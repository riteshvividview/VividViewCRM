"use client";

import { useState, useMemo } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type SortingState, type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Circle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "../types";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "../types";
import { cn } from "@/lib/utils";

function SortHeader({ column, label }: { column: any; label: string }) {
  const s = column.getIsSorted();
  return (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => column.toggleSorting(s === "asc")}>
      {label}
      {s === "asc" ? <ArrowUp className="h-3 w-3" /> : s === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

interface TaskTableProps {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onStatusToggle: (id: string, status: Task["status"]) => void;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  globalFilter?: string;
}

export function TaskTable({ tasks, onTaskClick, onStatusToggle, selectedIds, onSelectChange, globalFilter = "" }: TaskTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Task>[]>(() => [
    {
      id: "select",
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => { table.toggleAllPageRowsSelected(!!v); onSelectChange(v ? tasks.map((t) => t.id) : []); }} />,
      cell: ({ row }) => <Checkbox checked={selectedIds.includes(row.original.id)} onCheckedChange={(v) => { onSelectChange(v ? [...selectedIds, row.original.id] : selectedIds.filter((id) => id !== row.original.id)); }} onClick={(e) => e.stopPropagation()} />,
      size: 40,
    },
    {
      id: "done",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <button onClick={(e) => { e.stopPropagation(); onStatusToggle(t.id, t.status === "done" ? "todo" : "done"); }}>
            {t.status === "done"
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : <Circle className="h-4 w-4 text-muted-foreground hover:text-emerald-500 transition-colors" />}
          </button>
        );
      },
      size: 40,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <SortHeader column={column} label="Title" />,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="min-w-0">
            <p className={cn("text-sm font-medium truncate", t.status === "done" && "line-through text-muted-foreground")}>
              {t.title}
            </p>
            {t.linked_entity_name && <p className="text-[11px] text-muted-foreground truncate">{t.linked_entity_name}</p>}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortHeader column={column} label="Status" />,
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status];
        return (
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />{cfg.label}
          </span>
        );
      },
    },
    {
      accessorKey: "priority",
      header: ({ column }) => <SortHeader column={column} label="Priority" />,
      cell: ({ row }) => {
        const cfg = PRIORITY_CONFIG[row.original.priority];
        return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>{cfg.label}</span>;
      },
    },
    {
      accessorKey: "due_date",
      header: ({ column }) => <SortHeader column={column} label="Due Date" />,
      cell: ({ row }) => {
        const t = row.original;
        if (!t.due_date) return <span className="text-muted-foreground/40 text-sm">—</span>;
        const isOverdue = new Date(t.due_date) < new Date() && t.status !== "done";
        return (
          <span className={cn("text-sm", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            {isOverdue && "⚠ "}{new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        );
      },
    },
    {
      accessorKey: "assignee_name",
      header: "Assignee",
      cell: ({ row }) => row.original.assignee_name
        ? <span className="text-sm text-foreground">{row.original.assignee_name}</span>
        : <span className="text-muted-foreground/40 text-sm">—</span>,
    },
  ], [tasks, selectedIds, onSelectChange, onStatusToggle]);

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group/row hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onTaskClick(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">No tasks found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
