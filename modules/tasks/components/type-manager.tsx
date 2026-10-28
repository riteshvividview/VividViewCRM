"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TaskType } from "../types";

const PALETTE = ["#5b6472", "#8a6a45", "#0e7490", "#15803d", "#6d28d9", "#1d4ed8", "#be185d", "#b45309", "#0f766e", "#4d7c0f"];

/** Create / rename / recolour / delete task types (card colours). */
export function TypeManagerDialog({ open, onOpenChange, types, onChange }: {
  open: boolean; onOpenChange: (o: boolean) => void; types: TaskType[]; onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[2]);

  async function call(method: string, body?: unknown, qs = "") {
    const res = await fetch(`/api/tasks/types${qs}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error ?? "Failed"); return false; }
    onChange();
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Task types</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">A task&apos;s type sets its card colour on boards and calendars.</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {types.map((t) => (
            <div key={t.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
              <label className="relative h-6 w-6 shrink-0 cursor-pointer rounded" style={{ backgroundColor: t.color }}>
                <input type="color" className="absolute inset-0 opacity-0" defaultValue={t.color} onBlur={(e) => e.target.value !== t.color && call("PATCH", { id: t.id, color: e.target.value })} />
              </label>
              <Input defaultValue={t.name} className="h-8 border-transparent bg-transparent text-sm hover:border-border"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) call("PATCH", { id: t.id, name: v }); }} />
              <button className="opacity-0 group-hover:opacity-60" aria-label={`Delete ${t.name}`}
                onClick={() => window.confirm(`Delete "${t.name}"? Tasks of this type become untyped.`) && call("DELETE", undefined, `?id=${t.id}`)}>
                <FontAwesomeIcon icon={faTrashCan} className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <div className="flex gap-1.5">
            {PALETTE.map((c) => <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded" style={{ backgroundColor: c, outline: color === c ? "2px solid currentColor" : undefined, outlineOffset: 2 }} />)}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New type name" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={async (e) => { if (e.key === "Enter" && name.trim() && await call("POST", { name, color })) setName(""); }} />
            <Button disabled={!name.trim()} onClick={async () => { if (await call("POST", { name, color })) setName(""); }}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
