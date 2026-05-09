"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, AlignLeft, AlignCenter, AlignRight, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailBlock, EmailBlockType } from "../types";
import { BLOCK_PALETTE } from "../types";
import { cn } from "@/lib/utils";

// ── Block Preview ────────────────────────────────────────────────────────────
function BlockPreview({ block }: { block: EmailBlock }) {
  const align = block.align ?? "center";
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";

  switch (block.type) {
    case "header":
      return (
        <div style={{ backgroundColor: block.bgColor ?? "#7C3AED" }} className="px-8 py-6 rounded-t-lg">
          <p style={{ color: block.textColor ?? "#ffffff" }} className={cn("text-xl font-bold", alignClass)}>{block.content || "Header"}</p>
        </div>
      );
    case "text":
      return (
        <div className={cn("px-8 py-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed", alignClass)}>
          {block.content || <span className="text-muted-foreground/40 italic">Add text content…</span>}
        </div>
      );
    case "image":
      return (
        <div className={cn("px-8 py-3", alignClass)}>
          {block.url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={block.url} alt={block.alt ?? ""} className="max-w-full rounded-lg mx-auto" />
            : (
              <div className="w-full h-32 bg-muted/50 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Drop image or enter URL</span>
              </div>
            )}
        </div>
      );
    case "button":
      return (
        <div className={cn("px-8 py-4", alignClass)}>
          <span
            style={{ backgroundColor: block.bgColor ?? "#7C3AED", color: block.textColor ?? "#ffffff" }}
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
          >
            {block.content || "Button Text"}
          </span>
        </div>
      );
    case "divider":
      return <div className="px-8 py-3"><hr className="border-border" /></div>;
    case "spacer":
      return <div style={{ height: 32 }} />;
    case "footer":
      return (
        <div className={cn("px-8 py-4 text-xs whitespace-pre-wrap rounded-b-lg bg-slate-50 dark:bg-slate-900", alignClass)}
          style={{ color: block.textColor ?? "#94a3b8" }}>
          {block.content || "Footer text — Unsubscribe"}
        </div>
      );
    default:
      return null;
  }
}

// ── Sortable Block Row ────────────────────────────────────────────────────────
function SortableBlockRow({ block, isSelected, onSelect, onDelete }: {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative border-2 rounded-lg cursor-pointer transition-all",
        isSelected ? "border-purple-500" : "border-transparent hover:border-purple-200 dark:hover:border-purple-800",
        isDragging && "opacity-40"
      )}
      onClick={onSelect}
    >
      <BlockPreview block={block} />
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div {...attributes} {...listeners} className="p-1 rounded bg-background border border-border cursor-grab">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <button
        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-background border border-border text-destructive transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Block Editor Panel ────────────────────────────────────────────────────────
function BlockEditor({ block, onChange }: { block: EmailBlock; onChange: (b: EmailBlock) => void }) {
  const set = <K extends keyof EmailBlock>(key: K, val: EmailBlock[K]) => onChange({ ...block, [key]: val });

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide capitalize">{block.type} Block</p>

      {(block.type === "header" || block.type === "text" || block.type === "button" || block.type === "footer") && (
        <div>
          <label className="text-xs text-muted-foreground">Content</label>
          <Textarea className="mt-1 text-sm resize-none" rows={4} value={block.content} onChange={(e) => set("content", e.target.value)} placeholder="Enter content…" />
        </div>
      )}

      {block.type === "image" && (
        <>
          <div>
            <label className="text-xs text-muted-foreground">Image URL</label>
            <Input className="mt-1 h-8 text-sm" placeholder="https://…" value={block.url ?? ""} onChange={(e) => set("url", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Alt Text</label>
            <Input className="mt-1 h-8 text-sm" value={block.alt ?? ""} onChange={(e) => set("alt", e.target.value)} />
          </div>
        </>
      )}

      {block.type === "button" && (
        <div>
          <label className="text-xs text-muted-foreground">Button URL</label>
          <Input className="mt-1 h-8 text-sm" placeholder="https://…" value={block.url ?? ""} onChange={(e) => set("url", e.target.value)} />
        </div>
      )}

      {/* Alignment */}
      {block.type !== "divider" && block.type !== "spacer" && (
        <div>
          <label className="text-xs text-muted-foreground">Alignment</label>
          <div className="flex gap-1 mt-1">
            {(["left", "center", "right"] as const).map((a) => {
              const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={a}
                  onClick={() => set("align", a)}
                  className={cn("p-1.5 rounded border transition-colors", block.align === a ? "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-700" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colors */}
      {(block.type === "header" || block.type === "button") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Background</label>
            <div className="flex items-center gap-1.5 mt-1">
              <input type="color" className="h-7 w-7 rounded cursor-pointer border border-border" value={block.bgColor ?? "#7C3AED"} onChange={(e) => set("bgColor", e.target.value)} />
              <Input className="h-7 text-xs flex-1" value={block.bgColor ?? "#7C3AED"} onChange={(e) => set("bgColor", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Text</label>
            <div className="flex items-center gap-1.5 mt-1">
              <input type="color" className="h-7 w-7 rounded cursor-pointer border border-border" value={block.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} />
              <Input className="h-7 text-xs flex-1" value={block.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Email Builder ─────────────────────────────────────────────────────────
interface EmailBuilderProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  showHtmlMode?: boolean;
}

export function EmailBuilder({ blocks, onChange, showHtmlMode = true }: EmailBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [rawHtml, setRawHtml] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  function addBlock(type: EmailBlockType) {
    const defaults: Partial<EmailBlock> = {
      header:  { content: "Email Header", bgColor: "#7C3AED", textColor: "#ffffff" },
      text:    { content: "Add your content here…" },
      button:  { content: "Click Here", url: "https://", bgColor: "#7C3AED", textColor: "#ffffff" },
      image:   { url: "", alt: "Image" },
      divider: { content: "" },
      spacer:  { content: "" },
      footer:  { content: "© 2026 Your Company · Unsubscribe", textColor: "#94a3b8" },
    }[type] ?? {};
    const b: EmailBlock = { id: crypto.randomUUID(), type, content: "", align: "center", ...defaults };
    onChange([...blocks, b]);
    setSelectedId(b.id);
  }

  function updateBlock(updated: EmailBlock) {
    onChange(blocks.map((b) => b.id === updated.id ? updated : b));
  }

  function deleteBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    onChange(arrayMove(blocks, oldIdx, newIdx));
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Block palette */}
      <div className="w-44 shrink-0 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Blocks</p>
        {BLOCK_PALETTE.map((p) => (
          <button
            key={p.type}
            onClick={() => addBlock(p.type)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card border border-border hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-left group"
          >
            <span className="text-base">{p.icon}</span>
            <span className="text-xs font-medium text-foreground">{p.label}</span>
            <Plus className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
        {showHtmlMode && (
          <button
            onClick={() => setHtmlMode((v) => !v)}
            className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left mt-3", htmlMode ? "bg-slate-900 border-slate-700 text-emerald-400" : "bg-card border-border hover:border-slate-400 text-muted-foreground")}
          >
            <Code2 className="h-4 w-4" />
            <span className="text-xs font-medium">{htmlMode ? "Visual mode" : "HTML mode"}</span>
          </button>
        )}
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto">
        {htmlMode ? (
          <div className="h-full">
            <Textarea
              className="h-full font-mono text-xs bg-slate-900 text-emerald-400 border-slate-700 resize-none"
              placeholder="Paste raw HTML here…"
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-border max-w-xl mx-auto overflow-hidden">
            <DndContext sensors={sensors} onDragStart={({ active }) => setDragId(active.id as string)} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-sm text-muted-foreground gap-2">
                    <span className="text-3xl">📧</span>
                    <p>Add blocks from the palette to start building</p>
                  </div>
                ) : (
                  blocks.map((block) => (
                    <SortableBlockRow
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  ))
                )}
              </SortableContext>
              <DragOverlay>
                {dragId && (() => {
                  const b = blocks.find((bl) => bl.id === dragId);
                  return b ? <div className="bg-card border-2 border-purple-400 rounded-lg px-4 py-3 shadow-xl text-sm font-medium opacity-90 capitalize">{b.type} block</div> : null;
                })()}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>

      {/* Right: Property editor */}
      <div className="w-56 shrink-0 bg-card border border-border rounded-xl overflow-y-auto">
        {selectedBlock
          ? <BlockEditor block={selectedBlock} onChange={updateBlock} />
          : (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4 text-sm text-muted-foreground">
              <p>Select a block to edit its properties</p>
            </div>
          )
        }
      </div>
    </div>
  );
}
