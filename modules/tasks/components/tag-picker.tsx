"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag, faPlus, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { TaskLabel } from "../types";
import { cn } from "@/lib/utils";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

/**
 * Tag picker with inline create: type to search, Enter (or "Create …") to make a new tag.
 * `onCreated` lets the parent add the new tag to its shared list.
 */
export function TagPicker({ labels, selectedIds, onToggle, onCreated, button }: {
  labels: TaskLabel[];
  selectedIds: string[];
  onToggle: (labelId: string, selected: boolean) => void;
  onCreated: (label: TaskLabel) => void;
  /** Custom trigger content; defaults to "Add tag". */
  button?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState(COLORS[5]);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = labels.filter((l) => l.name.toLowerCase().includes(q));
  const exact = labels.find((l) => l.name.toLowerCase() === q);

  async function create() {
    const name = query.trim();
    if (!name || creating) return;
    if (exact) { if (!selectedIds.includes(exact.id)) onToggle(exact.id, true); setQuery(""); return; }
    setCreating(true);
    const res = await fetch("/api/tasks/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) });
    const json = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) { toast.error(json.error ?? "Could not create tag"); return; }
    onCreated(json.label);
    onToggle(json.label.id, true);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-secondary px-3 text-[13px] font-medium hover:bg-secondary/80">
        {button ?? <><FontAwesomeIcon icon={faTag} className="h-3.5 w-3.5" />Add tag</>}
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-50 w-64 rounded-lg border bg-popover p-2 shadow-lg">
          <input
            autoFocus value={query} placeholder="Search or create a tag…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") setOpen(false); }}
            className="h-8 w-full rounded-md border bg-background px-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-1.5 max-h-52 overflow-y-auto">
            {filtered.map((l) => {
              const on = selectedIds.includes(l.id);
              return (
                <button key={l.id} type="button" onClick={() => onToggle(l.id, !on)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="flex-1 truncate">{l.name}</span>
                  {on && <FontAwesomeIcon icon={faCheck} className="h-3 w-3 text-muted-foreground" />}
                </button>
              );
            })}
            {filtered.length === 0 && !q && <p className="px-2 py-1.5 text-xs text-muted-foreground">No tags yet — type a name to create one.</p>}
          </div>
          {q && !exact && (
            <div className="mt-1.5 border-t pt-2">
              <div className="mb-2 flex gap-1.5 px-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                    className={cn("h-4 w-4 rounded-full", color === c && "ring-2 ring-foreground ring-offset-1 ring-offset-popover")} style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="button" onClick={create} disabled={creating}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-muted">
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />Create tag &ldquo;<span className="truncate font-medium">{query.trim()}</span>&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Selected tag chips with a remove button. */
export function TagChips({ labels, onRemove }: { labels: TaskLabel[]; onRemove?: (id: string) => void }) {
  return (
    <>
      {labels.map((l) => (
        <span key={l.id} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${l.color}26`, color: l.color }}>
          {l.name}
          {onRemove && <button type="button" onClick={() => onRemove(l.id)} aria-label={`Remove ${l.name}`}><FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" /></button>}
        </span>
      ))}
    </>
  );
}
