"use client";

import Link from "next/link";
import { ArrowUpDown, Clock, CheckCircle, XCircle, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LOCATION_CONFIG, STAGE_CONFIG, type Deal } from "../types";
import { formatDate, getInitials, cn } from "@/lib/utils";

interface DealsListProps {
  deals: Deal[];
  onWon: (id: string) => void;
  onLost: (id: string) => void;
}

export function DealsList({ deals, onWon, onLost }: DealsListProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {["Deal", "Stage", "Value", "Location", "Assigned", "Close Date", "Days in Stage", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left">
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {h} {h && h !== "" && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => {
              const stageCfg = STAGE_CONFIG[deal.stage];
              const locCfg = deal.location ? LOCATION_CONFIG[deal.location] : LOCATION_CONFIG.Other;
              return (
                <tr key={deal.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <Link href={`/dashboard/deals/${deal.id}`} className="font-medium text-foreground hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
                      {deal.title}
                    </Link>
                    {deal.company && <p className="text-xs text-muted-foreground mt-0.5">{deal.company}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", stageCfg.bg, stageCfg.color)}>
                      {deal.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-foreground">
                    ₹{(deal.value / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3.5">
                    {deal.location && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", locCfg.bg, locCfg.color)}>
                        {deal.location}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {deal.assigned_name && (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-purple-100 text-purple-700 text-[10px] font-semibold">
                            {getInitials(deal.assigned_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{deal.assigned_name.split(" ")[0]}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {deal.close_date ? formatDate(deal.close_date) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{deal.days_in_stage}d
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild><Link href={`/dashboard/deals/${deal.id}`}>View Details</Link></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600" onClick={() => onWon(deal.id)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Mark Won
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onLost(deal.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />Mark Lost
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {deals.length === 0 && (
              <tr><td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">No deals found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
