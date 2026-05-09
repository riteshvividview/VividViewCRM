"use client";

import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TERRITORIES, type Territory } from "../types";
import { MOCK_TEAMS } from "../hooks/use-teams";
import { cn } from "@/lib/utils";

export function TerritoryManager() {
  const [territories, setTerritories] = useState<Territory[]>(TERRITORIES);

  function assignTeam(territoryId: string, teamId: string | null) {
    setTerritories((p) => p.map((t) => t.id === territoryId ? { ...t, assigned_team_id: teamId } : t));
  }

  const TEAM_COLORS: Record<string, string> = { tm1: "bg-purple-500", tm2: "bg-blue-500", tm3: "bg-emerald-500" };

  return (
    <div className="space-y-2">
      {territories.map((ter) => {
        const team = MOCK_TEAMS.find((t) => t.id === ter.assigned_team_id);
        return (
          <div key={ter.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{ter.name}</p>
                <p className="text-xs text-muted-foreground">{ter.state}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border border-border hover:bg-muted transition-colors">
                  {team ? (
                    <>
                      <div className={cn("w-2 h-2 rounded-full", TEAM_COLORS[team.id])} />
                      {team.name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => assignTeam(ter.id, null)}>
                  <span className="text-muted-foreground">Unassigned</span>
                </DropdownMenuItem>
                {MOCK_TEAMS.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => assignTeam(ter.id, t.id)}>
                    <div className={cn("w-2 h-2 rounded-full mr-2", TEAM_COLORS[t.id])} />{t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
