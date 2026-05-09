"use client";

import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Target } from "../types";
import { TARGET_CONFIG } from "../types";
import { cn } from "@/lib/utils";

function formatVal(type: Target["type"], n: number) {
  if (type === "revenue") {
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    return `₹${(n / 1000).toFixed(0)}K`;
  }
  return n.toLocaleString();
}

function pct(current: number, value: number) {
  if (!value) return 0;
  return Math.min(100, Math.round((current / value) * 100));
}

interface TargetRowProps {
  target: Target;
  onUpdate?: (t: Target) => void;
  editable?: boolean;
}

export function TargetRow({ target, onUpdate, editable = false }: TargetRowProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(target.value));
  const cfg = TARGET_CONFIG[target.type];
  const p = pct(target.current, target.value);

  function save() {
    const n = parseInt(editVal);
    if (!isNaN(n) && n > 0 && onUpdate) onUpdate({ ...target, value: n });
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <cfg.icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
          <span className="text-sm font-medium text-foreground">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <Input
                className="h-7 w-24 text-xs text-right"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                autoFocus
              />
              <button onClick={save} className="p-1 rounded hover:bg-emerald-100 text-emerald-600"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-red-100 text-red-500"><X className="h-3 w-3" /></button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {formatVal(target.type, target.current)} / {formatVal(target.type, target.value)}
              </span>
              <span className={cn("text-xs font-semibold", p >= 100 ? "text-emerald-600" : p >= 70 ? "text-blue-600" : "text-amber-600")}>
                {p}%
              </span>
              {editable && (
                <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100">
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", cfg.barColor)}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

interface TargetProgressProps {
  targets: Target[];
  onUpdate?: (t: Target) => void;
  editable?: boolean;
  compact?: boolean;
}

export function TargetProgress({ targets, onUpdate, editable = false, compact = false }: TargetProgressProps) {
  return (
    <div className={cn("space-y-4 group", compact && "space-y-3")}>
      {targets.map((t) => (
        <TargetRow key={t.id} target={t} onUpdate={onUpdate} editable={editable} />
      ))}
    </div>
  );
}
