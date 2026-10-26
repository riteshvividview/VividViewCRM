"use client";

import { useState } from "react";
import { Plus, X, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskMember, TaskTeam } from "../types";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function AssigneeAvatar({ member, size = "sm" }: { member: TaskMember; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  return (
    <Avatar className={cn(dim, "border border-background")}>
      {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name} />}
      <AvatarFallback className="text-[10px]">{initials(member.full_name)}</AvatarFallback>
    </Avatar>
  );
}

/** Compact overlapping avatar stack for table/board cards. */
export function AssigneeStack({ members, max = 3 }: { members: TaskMember[]; max?: number }) {
  if (members.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((m) => <AssigneeAvatar key={m.id} member={m} size="xs" />)}
      {extra > 0 && (
        <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
          +{extra}
        </div>
      )}
    </div>
  );
}

interface AssigneePickerProps {
  value: TaskMember[];
  members: TaskMember[];
  teams?: TaskTeam[];
  onAddUsers: (userIds: string[]) => void;
  onAddTeam?: (teamId: string) => void;
  onRemove: (userId: string) => void;
}

/** Multi-assignee picker — pick individual members, a group of members, or expand an entire team. */
export function AssigneePicker({ value, members, teams = [], onAddUsers, onAddTeam, onRemove }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(value.map((v) => v.id));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {value.map((m) => (
        <div key={m.id} className="group flex items-center gap-1 bg-muted rounded-full pl-1 pr-1.5 py-0.5">
          <AssigneeAvatar member={m} size="xs" />
          <span className="text-xs text-foreground">{m.full_name.split(" ")[0]}</span>
          <button type="button" onClick={() => onRemove(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ))}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-dashed border-border">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
          {teams.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />Teams
              </DropdownMenuLabel>
              {teams.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => onAddTeam?.(t.id)} className="text-sm justify-between">
                  {t.name}
                  <span className="text-xs text-muted-foreground">{t.member_ids.length}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</DropdownMenuLabel>
          {members.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.id}
              checked={selectedIds.has(m.id)}
              onCheckedChange={(checked) => {
                if (checked) onAddUsers([m.id]);
                else onRemove(m.id);
              }}
              onSelect={(e) => e.preventDefault()}
              className="text-sm gap-2"
            >
              <AssigneeAvatar member={m} size="xs" />
              {m.full_name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
