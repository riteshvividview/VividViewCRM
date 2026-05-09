"use client";

import { useState } from "react";
import { MoreHorizontal, Play, Pause, Trash2, BarChart2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Campaign } from "../types";
import { STATUS_CONFIG } from "../types";
import { cn } from "@/lib/utils";

function StatCell({ value, label, highlight }: { value: number | string; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn("text-sm font-semibold", highlight ? "text-purple-600 dark:text-purple-400" : "text-foreground")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function rate(n: number, d: number) {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

interface CampaignListProps {
  campaigns: Campaign[];
  onEdit: (c: Campaign) => void;
  onAnalytics: (c: Campaign) => void;
  onDelete: (id: string) => void;
  onDuplicate: (c: Campaign) => void;
  onTogglePause: (c: Campaign) => void;
}

export function CampaignList({ campaigns, onEdit, onAnalytics, onDelete, onDuplicate, onTogglePause }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3 text-2xl">📧</div>
        <p className="text-sm font-medium text-foreground">No campaigns yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Campaign</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Audience</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Sent</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Open Rate</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Click Rate</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scheduled</th>
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {campaigns.map((c) => {
            const cfg = STATUS_CONFIG[c.status];
            const isLive = c.status === "sent" || c.status === "sending";
            return (
              <tr key={c.id} className="group hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <button className="text-left" onClick={() => (isLive ? onAnalytics(c) : onEdit(c))}>
                    <p className="text-sm font-medium text-foreground hover:text-purple-700 dark:hover:text-purple-400 transition-colors">{c.name}</p>
                    {c.subject && <p className="text-[11px] text-muted-foreground truncate max-w-[260px] mt-0.5">{c.subject}</p>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot, c.status === "sending" && "animate-pulse")} />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatCell value={c.audience_config?.count ?? "—"} label="recipients" />
                </td>
                <td className="px-4 py-3">
                  <StatCell value={c.stats.sent || "—"} label="sent" />
                </td>
                <td className="px-4 py-3">
                  <StatCell
                    value={rate(c.stats.opened, c.stats.sent)}
                    label="opened"
                    highlight={c.stats.sent > 0}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatCell
                    value={rate(c.stats.clicked, c.stats.sent)}
                    label="clicked"
                    highlight={c.stats.sent > 0}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {c.schedule_time
                    ? new Date(c.schedule_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : c.drip_sequence.length > 0 ? "Drip sequence" : "—"}
                </td>
                <td className="px-3 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {isLive && (
                        <DropdownMenuItem onClick={() => onAnalytics(c)}>
                          <BarChart2 className="h-3.5 w-3.5 mr-2" />Analytics
                        </DropdownMenuItem>
                      )}
                      {!isLive && (
                        <DropdownMenuItem onClick={() => onEdit(c)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                      )}
                      {(c.status === "scheduled" || c.status === "sending") && (
                        <DropdownMenuItem onClick={() => onTogglePause(c)}>
                          <Pause className="h-3.5 w-3.5 mr-2" />Pause
                        </DropdownMenuItem>
                      )}
                      {c.status === "paused" && (
                        <DropdownMenuItem onClick={() => onTogglePause(c)}>
                          <Play className="h-3.5 w-3.5 mr-2" />Resume
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onDuplicate(c)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
