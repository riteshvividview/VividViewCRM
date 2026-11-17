"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines, faStar, faImages, faMessage, faFile, faLinkSlash, faBroom, faChevronDown, faSpinner, faThumbtack, faCloud, faPen,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFileSize } from "../lib/upload";
import { cn } from "@/lib/utils";

type Amount = { files: number; bytes: number };
export interface StorageSummary {
  total: Amount;
  by: { brief: Amount; reference: Amount; main: Amount; chat: Amount; other: Amount };
  unattached: Amount;
  truncated: boolean;
  limit_bytes: number;
  limit_gb: number;
  cleanup: {
    enabled: boolean; days: number; keep_available: boolean;
    next7: Amount; next30: Amount; waiting: Amount; kept: Amount;
    upcoming: { key: string; name: string; size: number; section: "reference" | "chat"; task: { id: string; title: string } | null; deletes_on: string | null; keep: boolean }[];
  };
}

const size = (n: number) => formatFileSize(n) || "0 B";
const amount = (a: Amount) => `${a.files} file${a.files === 1 ? "" : "s"} · ${size(a.bytes)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

async function post(body: unknown) {
  const res = await fetch("/api/tasks/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

/**
 * The CEO's storage overview (Task settings and the Storage page): space used out of
 * the allowance, what it is made of, files no task points to, and what the automatic
 * clean-up removes when.
 */
export function StorageUsage({ data, onChanged, manage = true, compact = false }: { data: StorageSummary; onChanged: () => void; manage?: boolean; compact?: boolean }) {
  const [showList, setShowList] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limit, setLimit] = useState(String(data.limit_gb));
  const [busy, setBusy] = useState<string | null>(null);

  const pct = data.limit_bytes ? Math.min(100, (data.total.bytes / data.limit_bytes) * 100) : 0;
  const tone = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  const parts: { key: string; label: string; icon: typeof faFile; tint: string; a: Amount; note: string }[] = [
    { key: "brief", label: "Briefs", icon: faFileLines, tint: "text-sky-500", a: data.by.brief, note: "kept forever" },
    { key: "main", label: "Main files", icon: faStar, tint: "text-emerald-500", a: data.by.main, note: "kept forever" },
    { key: "reference", label: "References", icon: faImages, tint: "text-amber-500", a: data.by.reference, note: "cleaned up" },
    { key: "chat", label: "Chat media", icon: faMessage, tint: "text-violet-500", a: data.by.chat, note: "cleaned up" },
  ];
  if (data.by.other.files) parts.push({ key: "other", label: "Other", icon: faFile, tint: "text-muted-foreground", a: data.by.other, note: "in other folders" });

  async function keep(key: string, value: boolean) {
    setBusy(key);
    try {
      await post({ action: "keep", path: key, keep: value });
      toast.success(value ? "This file will be kept" : "This file goes back on the clean-up schedule");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not change it"); }
    finally { setBusy(null); }
  }
  async function cleanUnattached() {
    setBusy("unattached");
    try {
      const r = await post({ action: "clean_unattached" });
      toast.success(r.deleted ? `Deleted ${r.deleted} unattached file${r.deleted === 1 ? "" : "s"} (${size(r.bytes)})` : "Nothing to delete (files uploaded in the last hour are left alone)");
      setCleanOpen(false);
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
    finally { setBusy(null); }
  }
  async function saveLimit() {
    const gb = Number(limit);
    if (!Number.isFinite(gb) || gb <= 0 || gb > 100000) { toast.error("Enter a size in GB, for example 10"); return; }
    setBusy("limit");
    const res = await fetch("/api/tasks/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storage_limit_gb: gb }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { toast.error(json.error ?? "Could not save"); return; }
    toast.success("Saved");
    setLimitOpen(false);
    onChanged();
  }

  const c = data.cleanup;
  return (
    <div className="space-y-4">
      {/* Space used */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm"><span className="text-lg font-semibold">{size(data.total.bytes)}</span> <span className="text-muted-foreground">of {data.limit_gb} GB used · {data.total.files} file{data.total.files === 1 ? "" : "s"}</span></p>
          <button type="button" onClick={() => { setLimit(String(data.limit_gb)); setLimitOpen(true); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <FontAwesomeIcon icon={faPen} className="h-2.5 w-2.5" />Change {data.limit_gb} GB
          </button>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
          <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.max(pct, data.total.bytes ? 0.6 : 0)}%` }} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FontAwesomeIcon icon={faCloud} className="h-2.5 w-2.5" />
          {pct < 0.1 && data.total.bytes ? "Less than 0.1%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`} of the allowance · Cloudflare R2 (free up to 10 GB)
          {data.truncated && " · very large: totals are approximate"}
        </p>
      </div>

      {/* What it is made of */}
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
        {parts.map((p) => (
          <div key={p.key} className="rounded-xl border p-3">
            <p className={cn("flex items-center gap-1.5 text-xs font-medium", p.tint)}><FontAwesomeIcon icon={p.icon} className="h-3 w-3" />{p.label}</p>
            <p className="mt-1 text-base font-semibold">{size(p.a.bytes)}</p>
            <p className="text-[11px] text-muted-foreground">{p.a.files} file{p.a.files === 1 ? "" : "s"} · {p.note}</p>
          </div>
        ))}
      </div>

      {/* Files no task points to */}
      {data.unattached.files > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-700/60 dark:bg-amber-950/30">
          <FontAwesomeIcon icon={faLinkSlash} className="h-3.5 w-3.5 text-amber-600" />
          <span className="min-w-0 flex-1"><span className="font-medium">Not attached to any task:</span> {amount(data.unattached)}. Usually an upload that never finished.</span>
          {manage && <Link href="/dashboard/actions/storage?cleanup=unattached" className="text-xs font-medium text-primary hover:underline">See them</Link>}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCleanOpen(true)}><FontAwesomeIcon icon={faBroom} className="mr-1.5 h-3 w-3" />Delete them</Button>
        </div>
      )}

      {/* Clean-up schedule */}
      <div className="rounded-xl border">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 text-sm">
          <span className="font-medium">Automatic clean-up</span>
          {c.enabled ? (
            <>
              <span><span className="text-muted-foreground">Next 7 days:</span> {amount(c.next7)}</span>
              <span><span className="text-muted-foreground">Next 30 days:</span> {amount(c.next30)}</span>
              <span className="text-muted-foreground">Waiting for their task to finish: {c.waiting.files}</span>
              {c.kept.files > 0 && <span className="text-muted-foreground">Kept: {c.kept.files}</span>}
            </>
          ) : <span className="text-muted-foreground">Off: nothing is removed automatically.</span>}
          {c.enabled && c.upcoming.length > 0 && (
            <button type="button" onClick={() => setShowList((v) => !v)} className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {showList ? "Hide" : "Show"} files <FontAwesomeIcon icon={faChevronDown} className={cn("h-2.5 w-2.5 transition-transform", showList && "rotate-180")} />
            </button>
          )}
        </div>
        {c.enabled && <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">Reference files and chat media are removed {c.days} days after their task is completed with a main file. Briefs and main files are never removed.</p>}
        {showList && (
          <ul className="max-h-72 divide-y overflow-y-auto border-t">
            {c.upcoming.map((f) => (
              <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="w-24 shrink-0 font-medium">{f.deletes_on ? day(f.deletes_on) : "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={f.name}>{f.name}</span>
                  <span className="block truncate text-muted-foreground">{f.section === "chat" ? "Chat media" : "Reference"}{f.task ? ` · ${f.task.title}` : ""}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{size(f.size)}</span>
                {manage && c.keep_available && (
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" disabled={busy === f.key} onClick={() => keep(f.key, true)} title="Never clean up this file">
                    {busy === f.key ? <FontAwesomeIcon icon={faSpinner} spin className="h-3 w-3" /> : <><FontAwesomeIcon icon={faThumbtack} className="mr-1 h-3 w-3" />Keep</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={cleanOpen} onOpenChange={(o) => !busy && setCleanOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete files not attached to any task?</DialogTitle>
            <DialogDescription>{amount(data.unattached)} will be deleted from Cloudflare permanently. Files uploaded in the last hour are left alone, in case an upload is still finishing.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setCleanOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={!!busy} onClick={cleanUnattached}>
              {busy === "unattached" && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitOpen} onOpenChange={(o) => !busy && setLimitOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Storage allowance</DialogTitle>
            <DialogDescription>Used for the bar above. Cloudflare R2 is free up to 10 GB; beyond that it charges per GB.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveLimit(); }} className="flex items-center gap-2">
            <Input type="number" min={1} step="any" value={limit} onChange={(e) => setLimit(e.target.value)} className="h-10" autoFocus />
            <span className="text-sm text-muted-foreground">GB</span>
          </form>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setLimitOpen(false)}>Cancel</Button>
            <Button disabled={!!busy} onClick={saveLimit}>{busy === "limit" && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
