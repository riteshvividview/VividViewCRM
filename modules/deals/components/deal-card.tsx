"use client";

import Link from "next/link";
import { Clock, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LOCATION_CONFIG, type Deal } from "../types";
import { formatCurrency, getInitials, cn } from "@/lib/utils";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
  onWon?: (id: string) => void;
  onLost?: (id: string) => void;
}

export function DealCard({ deal, overlay = false, onWon, onLost }: DealCardProps) {
  const locCfg = deal.location ? LOCATION_CONFIG[deal.location] : LOCATION_CONFIG.Other;

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-3 shadow-sm cursor-pointer select-none group",
      "border-l-[3px]", locCfg.border,
      overlay && "shadow-2xl rotate-1 scale-[1.03]",
    )}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <Link href={`/dashboard/deals/${deal.id}`} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold text-foreground truncate hover:text-purple-700 dark:hover:text-purple-300 transition-colors leading-snug">
            {deal.title}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mr-1">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild><Link href={`/dashboard/deals/${deal.id}`}>View Details</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600" onClick={() => onWon?.(deal.id)}>
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Mark Won
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onLost?.(deal.id)}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" />Mark Lost
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {deal.company && (
        <p className="text-xs text-muted-foreground truncate mb-2">{deal.company}</p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-foreground">
          ₹{deal.value >= 100000 ? `${(deal.value / 100000).toFixed(1)}L` : `${(deal.value / 1000).toFixed(0)}K`}
        </span>
        {deal.location && (
          <span className={cn("text-[10px] font-medium rounded-full px-1.5 py-0.5", locCfg.bg, locCfg.color)}>
            {deal.location}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        {deal.assigned_name ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-purple-100 text-purple-700 text-[10px] font-semibold">
                {getInitials(deal.assigned_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground">{deal.assigned_name.split(" ")[0]}</span>
          </div>
        ) : <span />}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {deal.days_in_stage}d
        </div>
      </div>
    </div>
  );
}
