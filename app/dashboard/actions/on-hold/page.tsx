"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePause, faCirclePlay, faLock, faMagnifyingGlass, faPaperclip, faSpinner, faXmark, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShellProfile } from "@/lib/supabase/profile-context";

interface Person { id: string; full_name: string; avatar_url: string | null }
interface Item {
  id: string; title: string; code: string | null; status: string; priority: string; due_date: string | null;
  brand: { name: string; color: string | null } | null; team: { name: string; color: string | null } | null;
  hold_at: string; hold_reason: string | null; held_by: Person | null; assignees: Person[]; files: number;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

/** Tasks on hold (CEO only): who held each one, when and why; resume any of them. */
export default function OnHoldPage() {
  const isCeo = useShellProfile()?.role === "super_admin";
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [brand, setBrand] = useState("all");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/tasks/hold", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not load tasks on hold"); setItems([]); return; }
    setItems(json.items ?? []);
  }, []);
  useEffect(() => { if (isCeo) void load(); }, [isCeo, load]);
  // Someone puts a task on hold while this page is open: the list follows.
  useEffect(() => {
    const f = () => { if (isCeo) void load(); };
    window.addEventListener("tasks:sync", f);
    return () => window.removeEventListener("tasks:sync", f);
  }, [isCeo, load]);

  // Brands that have tasks on hold, for the filter.
  const brands = useMemo(() => [...new Map((items ?? []).filter((t) => t.brand).map((t) => [t.brand!.name, t.brand!])).values()].sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const shown = useMemo(() => (items ?? []).filter((t) => brand === "all" || (brand === "none" ? !t.brand : t.brand?.name === brand)).filter((t) => !q.trim() || `${t.title} ${t.code ?? ""} ${t.brand?.name ?? ""} ${t.held_by?.full_name ?? ""} ${t.hold_reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [items, q, brand]);

  async function resume(t: Item) {
    setBusy(t.id);
    try {
      const res = await fetch(`/api/tasks/${t.id}/hold`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Could not resume"); return; }
      toast.success(`"${t.title}" resumed`);
      setItems((list) => (list ?? []).filter((x) => x.id !== t.id));
    } finally { setBusy(null); }
  }

  if (!isCeo) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <FontAwesomeIcon icon={faLock} className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-medium">You don't have access to this page</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><FontAwesomeIcon icon={faCirclePause} className="h-4 w-4 text-amber-500" />Tasks on hold</h1>
        <p className="text-sm text-muted-foreground">Who put each task on hold and why. Summary every Monday at 10:00.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, people or reasons" className="h-9 pl-9 pr-8" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>}
      </div>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => <SelectItem key={b.name} value={b.name}><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: b.color ?? "#94a3b8" }} />{b.name}</SelectItem>)}
            <SelectItem value="none">No brand</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {items === null ? (
        <div className="py-20 text-center text-muted-foreground"><FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <FontAwesomeIcon icon={faCirclePlay} className="h-7 w-7 text-emerald-500" />
          <p className="mt-2 font-medium">{q ? "Nothing matches your search" : "No tasks are on hold"}</p>
          {!q && <p className="text-sm text-muted-foreground">Everything is moving.</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(200px,2fr)_minmax(110px,1fr)_minmax(220px,3fr)_minmax(150px,1.2fr)_minmax(130px,1fr)_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
            <span>Task</span><span>Brand</span><span>Reason</span><span>Put on hold by</span><span>Assigned to</span><span className="w-[92px]" />
          </div>
          {shown.map((t) => (
            <div key={t.id} className="grid items-center gap-x-4 gap-y-1 border-b px-4 py-2.5 text-sm last:border-0 hover:bg-muted/30 lg:grid-cols-[minmax(200px,2fr)_minmax(110px,1fr)_minmax(220px,3fr)_minmax(150px,1.2fr)_minmax(130px,1fr)_auto]">
              <div className="min-w-0">
                <a href={`/dashboard/actions/tasks?task=${t.id}`} className="flex min-w-0 items-center gap-1.5 font-medium hover:underline" title={t.title}>
                  {t.code && <span className="shrink-0 text-xs text-muted-foreground">{t.code}</span>}
                  <span className="truncate">{t.title}</span>
                  {t.files > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-normal text-muted-foreground" title={`${t.files} file${t.files === 1 ? "" : "s"} kept`}><FontAwesomeIcon icon={faPaperclip} className="h-2.5 w-2.5" />{t.files}</span>}
                </a>
              </div>
              <p className="flex min-w-0 items-center gap-1.5 text-xs">{t.brand ? <><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.brand.color ?? "#94a3b8" }} /><span className="truncate">{t.brand.name}</span></> : <span className="text-muted-foreground">-</span>}</p>
              <p className="truncate text-amber-900 dark:text-amber-200" title={t.hold_reason ?? ""}>{t.hold_reason}</p>
              <p className="truncate text-xs text-muted-foreground" title={when(t.hold_at)}>
                <span className="font-medium text-foreground">{t.held_by?.full_name ?? "Someone"}</span> · {ago(t.hold_at)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{t.assignees.map((x) => x.full_name).join(", ") || "-"}</p>
              <Button size="sm" className="h-8 w-[92px] gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy === t.id} onClick={() => resume(t)}>
                <FontAwesomeIcon icon={busy === t.id ? faSpinner : faCirclePlay} spin={busy === t.id} className="h-3 w-3" />Resume
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
