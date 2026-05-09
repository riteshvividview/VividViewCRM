"use client";

import { useState, useMemo } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type SortingState, type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Mail, Phone, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact } from "../types";
import { getInitials, cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  Active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function SortHeader({ column, label }: { column: any; label: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

interface ContactsTableProps {
  contacts: Contact[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  globalFilter?: string;
}

export function ContactsTable({ contacts, onView, onDelete, selectedIds, onSelectChange, globalFilter = "" }: ContactsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => {
            table.toggleAllPageRowsSelected(!!v);
            onSelectChange(v ? contacts.map((c) => c.id) : []);
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.includes(row.original.id)}
          onCheckedChange={(v) => {
            onSelectChange(v ? [...selectedIds, row.original.id] : selectedIds.filter((id) => id !== row.original.id));
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
    },
    {
      accessorKey: "full_name",
      header: ({ column }) => <SortHeader column={column} label="Name" />,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={c.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {getInitials(c.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{c.full_name}</p>
              {c.title && <p className="text-[11px] text-muted-foreground">{c.title}</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortHeader column={column} label="Email" />,
      cell: ({ row }) => (
        <a href={`mailto:${row.original.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[180px]">{row.original.email}</span>
        </a>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone
        ? <span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{row.original.phone}</span>
        : <span className="text-muted-foreground/40 text-sm">—</span>,
    },
    {
      accessorKey: "company_name",
      header: ({ column }) => <SortHeader column={column} label="Company" />,
      cell: ({ row }) => row.original.company_name
        ? <span className="text-sm text-foreground">{row.original.company_name}</span>
        : <span className="text-muted-foreground/40 text-sm">—</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_STYLE[row.original.status] ?? "bg-muted text-muted-foreground")}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.tags ?? []).slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
          {(row.original.tags ?? []).length > 2 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{row.original.tags.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover/row:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onView(row.original.id)}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />View profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row.original.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 48,
    },
  ], [contacts, selectedIds, onSelectChange, onView, onDelete]);

  const table = useReactTable({
    data: contacts,
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
              <tr
                key={row.id}
                className="group/row hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onView(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
