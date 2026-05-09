"use client";

import { useEffect, useRef, useState } from "react";
import { X, Flag, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task, TaskPriority } from "../types";
import { PRIORITY_CONFIG } from "../types";
import { cn } from "@/lib/utils";

interface QuickAddTaskProps {
  open: boolean;
  onClose: () => void;
  onAdd: (t: Partial<Task>) => void;
}

export function QuickAddTask({ open, onClose, onAdd }: QuickAddTaskProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTitle("");
      setPriority("medium");
      setDueDate("");
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), priority, due_date: dueDate || null });
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-foreground">Quick Add Task</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <Input
              ref={inputRef}
              className="h-10 text-sm"
              placeholder="Task title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
            <div className="flex gap-2">
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <span className={cn("flex items-center gap-1.5", PRIORITY_CONFIG[priority].color)}>
                    <Flag className="h-3 w-3" />{PRIORITY_CONFIG[priority].label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className={cn("flex items-center gap-2", PRIORITY_CONFIG[p].color)}>
                        <Flag className="h-3.5 w-3.5" />{PRIORITY_CONFIG[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <CalendarDays className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input type="date" className="h-8 text-xs pl-7" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSubmit} disabled={!title.trim()}>
                Add Task
              </Button>
            </div>
          </div>
          <div className="px-4 pb-3 border-t border-border/50 pt-2">
            <p className="text-[10px] text-muted-foreground">Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to save · <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to cancel</p>
          </div>
        </div>
      </div>
    </>
  );
}
