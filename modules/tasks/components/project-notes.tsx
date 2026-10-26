"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Note { id: string; title: string; content: string; updated_at: string; created_by: string | null }

/** Project notes/docs with autosave. */
export function ProjectNotes({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/projects/${projectId}/notes`);
    const json = await res.json();
    if (res.ok) {
      setNotes(json.notes ?? []);
      setActiveId((cur) => cur ?? json.notes?.[0]?.id ?? null);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const active = notes.find((n) => n.id === activeId) ?? null;
  useEffect(() => {
    setTitle(active?.title ?? "");
    setContent(active?.content ?? "");
    setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function scheduleSave(next: { title?: string; content?: string }) {
    if (!activeId) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/tasks/projects/${projectId}/notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, ...next }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Could not save note"); setState("idle"); return; }
      setNotes((ns) => ns.map((n) => (n.id === activeId ? json.note : n)));
      setState("saved");
    }, 700);
  }

  async function create() {
    const res = await fetch(`/api/tasks/projects/${projectId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Could not create note"); return; }
    setNotes((ns) => [json.note, ...ns]);
    setActiveId(json.note.id);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note?")) return;
    const res = await fetch(`/api/tasks/projects/${projectId}/notes?note_id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error((await res.json()).error ?? "Could not delete"); return; }
    setNotes((ns) => ns.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr] min-h-[60vh]">
      <aside className="space-y-1">
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={create}><Plus className="h-4 w-4 mr-1.5" />New note</Button>
        {notes.map((n) => (
          <button key={n.id} onClick={() => setActiveId(n.id)}
            className={cn("group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", n.id === activeId ? "bg-muted font-medium" : "hover:bg-muted/50")}>
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{n.title}</span>
            <Trash2 className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" onClick={(e) => { e.stopPropagation(); remove(n.id); }} />
          </button>
        ))}
        {notes.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">Keep briefs, meeting notes and links for this project here.</p>}
      </aside>
      {active ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Input
              className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
              value={title}
              onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              {state === "saving" && <><Loader2 className="h-3 w-3 animate-spin" />Saving</>}
              {state === "saved" && <><Check className="h-3 w-3" />Saved</>}
            </span>
          </div>
          <Textarea
            className="mt-3 min-h-[50vh] resize-none border-0 px-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            placeholder="Start writing…"
            value={content}
            onChange={(e) => { setContent(e.target.value); scheduleSave({ content: e.target.value }); }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Select or create a note</div>
      )}
    </div>
  );
}
