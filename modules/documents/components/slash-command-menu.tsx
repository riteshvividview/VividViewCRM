"use client";

import { useEffect, useRef, useState } from "react";
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code2, Image, Minus, MessageSquare,
} from "lucide-react";
import type { BlockType } from "../types";
import { cn } from "@/lib/utils";

export interface SlashCommand {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  keywords: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { type: "paragraph",  label: "Text",            description: "Plain paragraph",           icon: Type,          keywords: ["text", "paragraph", "p"] },
  { type: "h1",         label: "Heading 1",        description: "Large section heading",     icon: Heading1,      keywords: ["h1", "heading", "title"] },
  { type: "h2",         label: "Heading 2",        description: "Medium section heading",    icon: Heading2,      keywords: ["h2", "heading", "subtitle"] },
  { type: "h3",         label: "Heading 3",        description: "Small section heading",     icon: Heading3,      keywords: ["h3", "heading"] },
  { type: "bullet",     label: "Bulleted List",    description: "Unordered list",            icon: List,          keywords: ["bullet", "list", "ul", "-"] },
  { type: "numbered",   label: "Numbered List",    description: "Ordered list",              icon: ListOrdered,   keywords: ["numbered", "ordered", "ol", "1."] },
  { type: "todo",       label: "To-do",            description: "Checkbox task",             icon: CheckSquare,   keywords: ["todo", "task", "check", "[]"] },
  { type: "quote",      label: "Quote",            description: "Block quotation",           icon: Quote,         keywords: ["quote", "blockquote", ">"] },
  { type: "callout",    label: "Callout",          description: "Highlighted callout box",   icon: MessageSquare, keywords: ["callout", "info", "tip", "note"] },
  { type: "code",       label: "Code",             description: "Monospace code block",      icon: Code2,         keywords: ["code", "pre", "```"] },
  { type: "image",      label: "Image",            description: "Embed an image",            icon: Image,         keywords: ["image", "img", "photo", "picture"] },
  { type: "divider",    label: "Divider",          description: "Horizontal rule",           icon: Minus,         keywords: ["divider", "hr", "rule", "---"] },
];

interface SlashCommandMenuProps {
  query: string;
  rect: DOMRect;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ query, rect, onSelect, onClose }: SlashCommandMenuProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? SLASH_COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : SLASH_COMMANDS;

  // Reset active index when filter changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].type);
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, activeIdx, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;

  return (
    <div
      ref={menuRef}
      style={{ top, left, minWidth: 260 }}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden py-1"
    >
      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Blocks
      </p>
      <div className="max-h-72 overflow-y-auto">
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.type}
              data-idx={i}
              onMouseDown={(e) => { e.preventDefault(); onSelect(cmd.type); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", i === activeIdx ? "bg-background shadow-sm" : "bg-muted")}>
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{cmd.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{cmd.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
