"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrashCan, faRotateLeft, faLock, faSpinner, faMagnifyingGlass, faTriangleExclamation, faPaperclip, faGear, faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { cn } from "@/lib/utils";

interface TrashItem {
  id: string; title: string; status: string; code: string | null;
  brand: { name: string; color: string | null } | null; team: { name: string; color: string | null } | null;
  files: number; deleted_at: string; deleted_by: string | null; created_by: string | null;
  expires_at: string; days_left: number;
}
type Confirm = { kind: "delete"; ids: string[] } | { kind: "empty" } | null;

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Deleted tasks (CEO only): restore them, delete them for good, or empty the trash. */
export default function TrashPage() {
  const profile = useShellProfile();
  const isCeo = profile?.role === "super_admin";
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [days, setDays] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typed, setTyped] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/tasks/trash");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not load the trash"); setItems([]); return; }
    setItems(json.items ?? []);
    setDays(json.trash_days ?? 15);
    setSelected((s) => new Set([...s].filter((id) => (json.items ?? []).some((t: TrashItem) => t.id === id))));
  }, []);
  useEffect(() => { if (isCeo) load(); }, [isCeo, load]);

  const shown = useMemo(() => (items ?? []).filter((t) => !q.trim() || `${t.title} ${t.code ?? ""} ${t.brand?.name ?? ""} ${t.deleted_by ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);
  const allChecked = shown.length > 0 && shown.every((t) => selected.has(t.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function act(action: "restore" | "delete" | "empty", ids: string[] = []) {
    setBusy(true);
    try {
      const res = await fetch("/api/tasks/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Something went wrong"); return; }
      if (action === "restore") toast.success(`Restored ${json.restored} task${json.restored === 1 ? "" : "s"}`);
      else toast.success(`Deleted ${json.removed} task${json.removed === 1 ? "" : "s"} for good${json.failed ? `; ${json.failed} could not be deleted` : ""}`);
      setConfirm(null); setTyped(""); setSelected(new Set());
      load();
    } finally { setBusy(false); }
  }

  if (profile && !isCeo) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <FontAwesomeIcon icon={faLock} className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-medium">Only the CEO can open the trash</p>
      </div>
    );
  }

  const confirmCount = confirm?.kind === "delete" ? confirm.ids.length : items?.length ?? 0;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><FontAwesomeIcon icon={faTrashCan} className="h-4 w-4 text-primary" />Trash</h1>
          <p className="text-sm text-muted-foreground">Deleted tasks are kept here for {days} day{days === 1 ? "" : "s"} with their files and chat, then removed for good.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/actions/settings#trash"><Button variant="outline" size="sm" className="h-8"><FontAwesomeIcon icon={faGear} className="mr-1.5 h-3 w-3" />Change {days} days</Button></Link>
          <Button variant="outline" size="sm" className="h-8 text-red-600 hover:text-red-600" disabled={!items?.length || busy} onClick={() => setConfirm({ kind: "empty" })}>
            <FontAwesomeIcon icon={faTrashCan} className="mr-1.5 h-3 w-3" />Empty trash
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deleted tasks" className="h-9 pl-9 pr-8" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => act("restore", [...selected])}><FontAwesomeIcon icon={faRotateLeft} className="mr-1.5 h-3 w-3" />Restore</Button>
            <Button size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-600" disabled={busy} onClick={() => setConfirm({ kind: "delete", ids: [...selected] })}><FontAwesomeIcon icon={faTrashCan} className="mr-1.5 h-3 w-3" />Delete for good</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[32px_minmax(0,1fr)_150px_170px_110px_190px] items-center gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <Checkbox checked={allChecked} disabled={!shown.length} aria-label="Select all" onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(shown.map((t) => t.id)))} />
          <span>Task</span><span>Brand / team</span><span>Deleted</span><span>Removed in</span><span />
        </div>
        {error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FontAwesomeIcon icon={faTriangleExclamation} className="h-6 w-6 text-amber-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : items === null ? (
          <div className="flex justify-center py-14"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FontAwesomeIcon icon={faTrashCan} className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">{q ? "No deleted task matches" : "The trash is empty"}</p>
            {!q && <p className="text-xs text-muted-foreground">Deleted tasks appear here and can be restored for {days} days.</p>}
          </div>
        ) : (
          <ul className="divide-y">
            {shown.map((t) => (
              <li key={t.id} className={cn("grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[32px_minmax(0,1fr)_150px_170px_110px_190px]", selected.has(t.id) && "bg-primary/5")}>
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.title}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={t.title}>{t.code && <span className="text-muted-foreground">{t.code} </span>}{t.title}</p>
                  <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {t.status === "done" ? "Completed" : "Open"}
                    {t.files > 0 && <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faPaperclip} className="h-2.5 w-2.5" />{t.files}</span>}
                    {t.created_by && <span>· created by {t.created_by}</span>}
                  </p>
                </div>
                <div className="hidden min-w-0 text-xs md:block">
                  {t.brand ? <p className="flex items-center gap-1.5 truncate"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: t.brand.color ?? "#6366f1" }} />{t.brand.name}</p> : <p className="text-muted-foreground">No brand</p>}
                  {t.team && <p className="truncate text-muted-foreground">{t.team.name}</p>}
                </div>
                <div className="hidden text-xs md:block">
                  <p>{when(t.deleted_at)}</p>
                  <p className="truncate text-muted-foreground">by {t.deleted_by ?? "someone"}</p>
                </div>
                <div className="hidden md:block">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", t.days_left <= 2 ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground")}>
                    {t.days_left === 0 ? "Today" : `${t.days_left} day${t.days_left === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2 md:col-span-1">
                  <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => act("restore", [t.id])}><FontAwesomeIcon icon={faRotateLeft} className="mr-1.5 h-3 w-3" />Restore</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-600" disabled={busy} aria-label={`Delete ${t.title} for good`} onClick={() => setConfirm({ kind: "delete", ids: [t.id] })}>
                    <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o && !busy) { setConfirm(null); setTyped(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "empty" ? "Empty the trash?" : `Delete ${confirmCount === 1 ? "this task" : `${confirmCount} tasks`} for good?`}</DialogTitle>
            <DialogDescription>
              {confirmCount === 1 ? "The task" : `${confirmCount} tasks`}, with all files, chat and history, will be removed permanently. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {confirm?.kind === "empty" && (
            <label className="block text-xs text-muted-foreground">
              Type <span className="font-semibold text-foreground">DELETE</span> to confirm
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 h-9" autoFocus disabled={busy} />
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setConfirm(null); setTyped(""); }}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={busy || (confirm?.kind === "empty" && typed.trim().toUpperCase() !== "DELETE")}
              onClick={() => confirm && (confirm.kind === "empty" ? act("empty") : act("delete", confirm.ids))}>
              {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Delete for good
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
