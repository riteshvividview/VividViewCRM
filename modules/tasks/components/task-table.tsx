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
import { AssigneeStack } from "./assignee-picker";
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

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value}h`;
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
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        const labels = row.original.labels;
        if (!labels || labels.length === 0) return <span className="text-muted-foreground/40 text-sm">—</span>;
        return (
          <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
            {labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${l.color}1a`, color: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>
        );
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
      id: "assignees",
      header: "Assignee",
      cell: ({ row }) => <AssigneeStack members={row.original.assignees} />,
    },
    {
      id: "estimated_hours",
      header: ({ column }) => <SortHeader column={column} label="Est. Time" />,
      accessorKey: "estimated_hours",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatHours(row.original.estimated_hours)}</span>,
    },
    {
      id: "actual_hours",
      header: "Logged Time",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatHours(row.original.actual_hours)}</span>,
    },
    {
      id: "created_in",
      header: "Create In",
      cell: ({ row }) => {
        const t = row.original;
        const name = t.project?.name ?? t.board?.name;
        if (!name) return <span className="text-muted-foreground/40 text-sm">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            {t.project?.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.project.color }} />}
            {name}
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
