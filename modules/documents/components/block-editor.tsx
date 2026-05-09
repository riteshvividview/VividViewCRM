"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Lightbulb } from "lucide-react";
import type { Block, BlockType } from "../types";
import { SlashCommandMenu, SLASH_COMMANDS } from "./slash-command-menu";
import { cn } from "@/lib/utils";

// ─── Block renderer ───────────────────────────────────────────────────────────
function BlockContent({ block, onChange, onKeyDown, blockRef }: {
  block: Block;
  onChange: (content: string, extra?: Partial<Block>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  blockRef: React.RefObject<HTMLDivElement>;
}) {
  if (block.type === "divider") {
    return <hr className="my-3 border-border" />;
  }

  if (block.type === "image") {
    return (
      <div className="my-2 rounded-xl overflow-hidden bg-muted">
        {block.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={block.imageUrl} alt={block.imageAlt ?? ""} className="w-full rounded-xl" />
          : <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Drop an image or enter URL</div>}
      </div>
    );
  }

  const baseProps = {
    ref: blockRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: (e: React.FormEvent<HTMLDivElement>) => onChange((e.target as HTMLDivElement).innerText),
    onKeyDown,
    "data-placeholder": getPlaceholder(block.type),
    className: cn("outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40", getBlockClass(block.type)),
  };

  if (block.type === "todo") {
    return (
      <div className="flex items-start gap-2.5 group/todo">
        <input
          type="checkbox"
          checked={block.checked ?? false}
          onChange={(e) => onChange(block.content, { checked: e.target.checked })}
          className="mt-1 h-4 w-4 rounded border-border text-purple-600 cursor-pointer shrink-0"
        />
        <div
          {...baseProps}
          className={cn("outline-none flex-1 min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40", block.checked && "line-through text-muted-foreground")}
        >
          {block.content}
        </div>
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 my-1">
        {block.emoji
          ? <span className="text-xl shrink-0 mt-0.5">{block.emoji}</span>
          : <Lightbulb className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />}
        <div {...baseProps}>{block.content}</div>
      </div>
    );
  }

  if (block.type === "quote") {
    return (
      <div className="border-l-4 border-purple-400 pl-4 my-1 italic">
        <div {...baseProps}>{block.content}</div>
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <div className="bg-slate-900 dark:bg-slate-950 rounded-xl my-2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-400 font-mono">{block.language ?? "plaintext"}</span>
        </div>
        <div
          ref={blockRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.target as HTMLDivElement).innerText)}
          onKeyDown={onKeyDown}
          className="px-4 py-3 font-mono text-sm text-emerald-400 outline-none whitespace-pre-wrap"
        >
          {block.content}
        </div>
      </div>
    );
  }

  return (
    <div {...baseProps}>
      {block.type === "bullet" && <span className="mr-2 text-muted-foreground">•</span>}
      {block.type === "numbered" && <span className="mr-2 text-muted-foreground font-medium">1.</span>}
      {block.content}
    </div>
  );
}

function getBlockClass(type: BlockType): string {
  switch (type) {
    case "h1": return "text-3xl font-bold text-foreground leading-tight";
    case "h2": return "text-xl font-semibold text-foreground leading-snug mt-2";
    case "h3": return "text-base font-semibold text-foreground";
    case "bullet": return "text-sm text-foreground pl-4";
    case "numbered": return "text-sm text-foreground pl-4";
    case "code": return "font-mono text-sm text-emerald-400";
    default: return "text-sm text-foreground leading-relaxed";
  }
}

function getPlaceholder(type: BlockType): string {
  switch (type) {
    case "h1": return "Heading 1";
    case "h2": return "Heading 2";
    case "h3": return "Heading 3";
    case "bullet": return "List item";
    case "numbered": return "Numbered item";
    case "todo": return "To-do";
    case "quote": return "Quote";
    case "callout": return "Callout text";
    case "code": return "Code…";
    default: return "Type '/' for commands…";
  }
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────
function SortableBlock({ block, isActive, children }: { block: Block; isActive: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/block relative flex items-start gap-1.5 -mx-2 px-2 rounded-lg hover:bg-muted/30 transition-colors", isDragging && "opacity-40", isActive && "bg-muted/20")}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="shrink-0 mt-1 opacity-0 group-hover/block:opacity-100 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────
interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export function BlockEditor({ blocks, onChange, readOnly = false }: BlockEditorProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string; rect: DOMRect } | null>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, ...updates } : b));
  }, [blocks, onChange]);

  const addBlockAfter = useCallback((afterId: string, type: BlockType = "paragraph") => {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const newBlock: Block = { id: crypto.randomUUID(), type, content: "" };
    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    onChange(next);
    // Focus new block on next tick
    setTimeout(() => { blockRefs.current.get(newBlock.id)?.focus(); }, 20);
  }, [blocks, onChange]);

  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) return;
    const idx = blocks.findIndex((b) => b.id === id);
    const prev = blocks[idx - 1];
    onChange(blocks.filter((b) => b.id !== id));
    if (prev) setTimeout(() => { const el = blockRefs.current.get(prev.id); if (el) { el.focus(); moveCursorToEnd(el); } }, 20);
  }, [blocks, onChange]);

  function handleContentChange(id: string, content: string, extra?: Partial<Block>) {
    // Detect slash command
    if (content === "/" && !readOnly) {
      const el = blockRefs.current.get(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({ blockId: id, query: "", rect });
      }
    } else if (slashMenu?.blockId === id) {
      const q = content.startsWith("/") ? content.slice(1) : content;
      if (content.includes("\n") || !content.startsWith("/")) {
        setSlashMenu(null);
      } else {
        setSlashMenu((m) => m ? { ...m, query: q } : null);
      }
    }
    updateBlock(id, { content, ...extra });
  }

  function handleKeyDown(id: string, e: React.KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLDivElement;
    const content = el.innerText ?? "";

    // Close slash menu on Escape
    if (e.key === "Escape" && slashMenu) {
      setSlashMenu(null);
      return;
    }

    // Enter: add new block
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (slashMenu) { setSlashMenu(null); return; }
      addBlockAfter(id);
    }

    // Backspace on empty block: delete
    if (e.key === "Backspace" && content === "") {
      e.preventDefault();
      deleteBlock(id);
    }

    // Markdown shortcuts
    if (e.key === " ") {
      const shortcuts: Record<string, BlockType> = {
        "#": "h1", "##": "h2", "###": "h3",
        "-": "bullet", "*": "bullet",
        "1.": "numbered", "[]": "todo", ">": "quote",
        "```": "code", "---": "divider",
      };
      const type = shortcuts[content.trimEnd()];
      if (type) {
        e.preventDefault();
        el.innerText = "";
        updateBlock(id, { type, content: "" });
        return;
      }
    }
  }

  function applySlashCommand(type: BlockType) {
    if (!slashMenu) return;
    const el = blockRefs.current.get(slashMenu.blockId);
    if (el) { el.innerText = ""; }
    updateBlock(slashMenu.blockId, { type, content: "" });
    setSlashMenu(null);
    setTimeout(() => { blockRefs.current.get(slashMenu.blockId)?.focus(); }, 20);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    onChange(arrayMove(blocks, oldIdx, newIdx));
  }

  return (
    <div className="relative">
      <DndContext sensors={sensors} onDragStart={({ active }) => setDragActiveId(active.id as string)} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {blocks.map((block) => (
              <SortableBlock key={block.id} block={block} isActive={activeBlockId === block.id}>
                <BlockContent
                  block={block}
                  onChange={(content, extra) => handleContentChange(block.id, content, extra)}
                  onKeyDown={(e) => handleKeyDown(block.id, e as React.KeyboardEvent<HTMLDivElement>)}
                  blockRef={{ current: blockRefs.current.get(block.id) ?? null } as React.RefObject<HTMLDivElement>}
                />
              </SortableBlock>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {dragActiveId && (() => {
            const b = blocks.find((bl) => bl.id === dragActiveId);
            return b ? <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-xl opacity-90 text-sm">{b.content || b.type}</div> : null;
          })()}
        </DragOverlay>
      </DndContext>

      {/* Add block button at end */}
      {!readOnly && (
        <button
          className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors px-8"
          onClick={() => addBlockAfter(blocks[blocks.length - 1]?.id ?? "", "paragraph")}
        >
          <Plus className="h-3.5 w-3.5" />Click to add a block
        </button>
      )}

      {/* Slash command menu */}
      {slashMenu && (
        <SlashCommandMenu
          query={slashMenu.query}
          rect={slashMenu.rect}
          onSelect={applySlashCommand}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
}

function moveCursorToEnd(el: HTMLElement) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}
