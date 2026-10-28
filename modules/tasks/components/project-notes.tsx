"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan, faSpinner, faCheck } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { RichTextEditor } from "./rich-text-editor";
import { cn } from "@/lib/utils";

interface Note { id: string; title: string; content: string; updated_at: string; created_by: string | null }

const preview = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const short = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Bordio notes: list on the left, rich text document on the right, autosaved. */
export function ProjectNotes({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: string }>({});

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
    setTitle(active?.title === "Untitled" ? "" : active?.title ?? "");
    setContent(active?.content ?? "");
    setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function scheduleSave(next: { title?: string; content?: string }) {
    if (!activeId) return;
    pending.current = { ...pending.current, ...next };
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    const id = activeId;
    timer.current = setTimeout(async () => {
      const body = pending.current;
      pending.current = {};
      const res = await fetch(`/api/tasks/projects/${projectId}/notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Could not save note"); setState("idle"); return; }
      setNotes((ns) => ns.map((n) => (n.id === id ? json.note : n)));
      setState("saved");
    }, 700);
  }

  async function create() {
    const res = await fetch(`/api/tasks/projects/${projectId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New note" }) });
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
    <div className="-m-4 flex h-[calc(100%+2rem)] min-h-[60vh]">
      <aside className="w-[250px] shrink-0 overflow-y-auto border-r">
        <button onClick={create} className="flex w-full items-center gap-2 border-b px-4 py-3 text-[13px] font-medium text-sky-500 hover:bg-muted/50">
          <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />New note
        </button>
        {notes.map((n) => (
          <button key={n.id} onClick={() => setActiveId(n.id)}
            className={cn("group block w-full border-b px-4 py-3 text-left", n.id === activeId ? "bg-sky-500/10" : "hover:bg-muted/50")}>
            <span className="flex items-center gap-2">
              <span className="flex-1 truncate text-[13px] font-semibold">{n.title || "New note"}</span>
              <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3 opacity-0 group-hover:opacity-50" onClick={(e) => { e.stopPropagation(); remove(n.id); }} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{preview(n.content) || "No text yet"}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{short(n.updated_at)}</span>
          </button>
        ))}
        {notes.length === 0 && <p className="px-4 py-6 text-xs text-muted-foreground">Briefs, meeting notes, links — keep them here.</p>}
      </aside>
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end gap-1.5 px-6 pt-3 text-xs text-muted-foreground">
            {state === "saving" && <><FontAwesomeIcon icon={faSpinner} spin className="h-3 w-3" />Saving</>}
            {state === "saved" && <><FontAwesomeIcon icon={faCheck} className="h-3 w-3" />Saved</>}
            {state === "idle" && <>Last edited: {short(active.updated_at)}</>}
          </div>
          <div className="px-6">
            <input
              value={title} placeholder="Title"
              onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value || "New note" }); }}
              className="w-full bg-transparent py-3 text-[28px] font-bold placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <RichTextEditor key={active.id} value={content} toolbar="top" minHeight={400} className="h-full border-0"
              onChange={(html) => { setContent(html); scheduleSave({ content: html }); }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select or create a note</div>
      )}
    </div>
  );
}
