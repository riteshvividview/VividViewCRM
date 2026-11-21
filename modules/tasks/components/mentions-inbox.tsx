"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAt, faCheck, faCheckDouble, faCirclePause, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Mention {
  id: string; at: string; text: string;
  by: { id: string; full_name: string; avatar_url: string | null } | null;
  task: { id: string; title: string; code: string | null; status: string; on_hold: boolean; brand: { name: string; color: string | null } | null };
}

const when = (iso: string) => {
  const d = new Date(iso), mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Every chat message where I was @mentioned, until I tick it off. Opening one opens its task. */
export function MentionsInbox({ onOpen }: { onOpen: (taskId: string) => void }) {
  const [items, setItems] = useState<Mention[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/tasks/mentions", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Could not load mentions"); setItems([]); return; }
    setError(null); setItems(j.items ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // New messages arrive live: re-read when the tasks sync or a notification comes in.
  useEffect(() => {
    const f = () => void load();
    window.addEventListener("tasks:sync", f);
    window.addEventListener("focus", f);
    return () => { window.removeEventListener("tasks:sync", f); window.removeEventListener("focus", f); };
  }, [load]);

  async function clear(ids: string[] | "all") {
    setBusy(true);
    const before = items;
    setItems((l) => (ids === "all" ? [] : (l ?? []).filter((m) => !ids.includes(m.id))));
    try {
      const r = await fetch("/api/tasks/mentions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
      if (!r.ok) { setItems(before); toast.error("Could not clear"); }
    } finally { setBusy(false); }
  }

  if (items === null) return <div className="py-20 text-center text-muted-foreground"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /></div>;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length ? `${items.length} mention${items.length === 1 ? "" : "s"} to read. Tick one when you're done with it.` : ""}</p>
        {items.length > 1 && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={busy} onClick={() => clear("all")}>
            <FontAwesomeIcon icon={faCheckDouble} className="h-3.5 w-3.5" />Clear all
          </Button>
        )}
      </div>
      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {items.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <FontAwesomeIcon icon={faAt} className="h-7 w-7 text-muted-foreground" />
          <p className="mt-2 font-medium">You're all caught up</p>
          <p className="text-sm text-muted-foreground">When someone mentions you in a task's chat, it shows up here.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {items.map((m) => (
            <li key={m.id} className="group flex items-start gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30">
              <button type="button" onClick={() => onOpen(m.task.id)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.by?.full_name ?? "Someone"}</span>
                  <span>mentioned you in</span>
                  {m.task.brand && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: m.task.brand.color ?? "#94a3b8" }} />{m.task.brand.name}</span>}
                  {m.task.code && <span className="font-medium text-foreground">{m.task.code}</span>}
                  <span className="truncate font-medium text-foreground">{m.task.title}</span>
                  {m.task.on_hold && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"><FontAwesomeIcon icon={faCirclePause} className="h-2.5 w-2.5" />On hold</span>}
                  <span className="ml-auto shrink-0">{when(m.at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm">{m.text}</p>
              </button>
              <button
                type="button" disabled={busy} onClick={() => clear([m.id])} title="Done, remove from the list" aria-label="Mark as done"
                className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40")}
              >
                <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
