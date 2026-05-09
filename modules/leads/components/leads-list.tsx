"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScorePill } from "@/components/shared/score-pill";
import { STATUS_CONFIG, type Lead, type LeadStatus } from "../types";
import { getInitials, formatDate, cn } from "@/lib/utils";
import { MoreHorizontal, Phone, Mail, Building2 } from "lucide-react";

const AVATAR_COLORS = ["bg-purple-100 text-purple-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

interface LeadsListProps {
  leads: Lead[];
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}

export function LeadsList({ leads, onEditLead, onDeleteLead, onStatusChange }: LeadsListProps) {
  if (leads.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No leads found</div>;
  }

  return (
    <div className="space-y-2">
      {leads.map((lead) => {
        const cfg = STATUS_CONFIG[lead.status] ?? { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", dot: "bg-muted-foreground" };
        const colorClass = AVATAR_COLORS[lead.name.charCodeAt(0) % AVATAR_COLORS.length];
        return (
          <div
            key={lead.id}
            className={cn("bg-card border border-border border-l-[3px] rounded-xl px-4 py-4 flex items-center gap-4 hover:shadow-sm hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group", cfg.border)}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className={cn("text-sm font-semibold", colorClass)}>{getInitials(lead.name)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{lead.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.email && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3 shrink-0" />{lead.email}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lead.company || "—"}</span>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border", cfg.color, cfg.bg, cfg.border)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  {lead.status}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <ScorePill score={lead.score} showBar />
                <span className="text-xs text-muted-foreground">{lead.source || "—"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lead.phone && (
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground hidden lg:block">{formatDate(lead.created_at)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onEditLead(lead)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteLead(lead.id)}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
