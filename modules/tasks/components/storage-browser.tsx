"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFolder, faFile, faFileImage, faFileVideo, faFileAudio, faFilePdf, faFileLines, faFileZipper, faPenRuler,
  faMagnifyingGlass, faArrowsRotate, faEllipsisVertical, faDownload, faPen, faFolderTree, faTrashCan, faEye,
  faXmark, faChevronRight, faHardDrive, faSpinner, faTriangleExclamation, faLink, faLinkSlash, faArrowUpRightFromSquare,
  faFilter, faCloud, faMessage, faStar, faImages,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatFileSize } from "../lib/upload";
import { cn } from "@/lib/utils";

// ── Types from /api/tasks/storage ─────────────────────────────────────────
type FileType = "image" | "video" | "audio" | "pdf" | "document" | "design" | "archive" | "other";
type Section = "brief" | "reference" | "main" | "chat";
interface FolderRow { name: string; path: string; files: number; bytes: number; modified: string }
interface FileRow {
  path: string; name: string; size: number; modified: string; type: FileType; folder: string; section: Section | null;
  linked: null | {
    attachment_id: string; kind: string; mime_type: string | null; uploaded_by: string | null;
    task: { id: string; title: string; status: string; code: string | null } | null;
  };
}
interface Listing {
  prefix: string; searching: boolean;
  folder: { files: number; bytes: number; truncated: boolean };
  matched: { files: number; bytes: number }; shown: number;
  folders: FolderRow[]; files: FileRow[]; brands: string[]; months: string[];
}
interface Filters { q: string; type: string; section: string; linked: string; modified: string; size: string; month: string; sort: string }
const NO_FILTERS: Filters = { q: "", type: "", section: "", linked: "", modified: "", size: "", month: "", sort: "name" };

const TYPE_META: Record<FileType, { label: string; icon: IconDefinition; color: string }> = {
  image:    { label: "Images",     icon: faFileImage,  color: "text-pink-500" },
  video:    { label: "Videos",     icon: faFileVideo,  color: "text-violet-500" },
  audio:    { label: "Audio",      icon: faFileAudio,  color: "text-amber-500" },
  pdf:      { label: "PDFs",       icon: faFilePdf,    color: "text-red-500" },
  document: { label: "Documents",  icon: faFileLines,  color: "text-sky-500" },
  design:   { label: "Design files", icon: faPenRuler, color: "text-emerald-500" },
  archive:  { label: "Archives",   icon: faFileZipper, color: "text-orange-500" },
  other:    { label: "Other",      icon: faFile,       color: "text-muted-foreground" },
};
const SECTION_META: Record<Section, { label: string; icon: IconDefinition; className: string }> = {
  brief:     { label: "Brief",      icon: faFileLines, className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  reference: { label: "Reference",  icon: faImages,    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  main:      { label: "Main file",  icon: faStar,      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  chat:      { label: "Chat",       icon: faMessage,   className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
};
const MODIFIED: Record<string, string> = { "": "Any time", "1": "Today", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "older90": "Older than 90 days", "older365": "Older than a year" };
const SIZES: Record<string, string> = { "": "Any size", "1048576": "Over 1 MB", "10485760": "Over 10 MB", "104857600": "Over 100 MB", "1073741824": "Over 1 GB" };
const SORTS: Record<string, string> = { name: "Name", newest: "Newest first", oldest: "Oldest first", largest: "Largest first", smallest: "Smallest first" };

const size = (n: number) => formatFileSize(n) || "0 B";
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const folderName = (path: string) => path.split("/").filter(Boolean).pop() ?? "";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

async function api<T = Record<string, unknown>>(init?: RequestInit & { query?: string }): Promise<T> {
  const res = await fetch(`/api/tasks/storage${init?.query ? `?${init.query}` : ""}`, {
    ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Folder in the address bar (?path=), so back / forward and links work. */
function readPath() {
  if (typeof window === "undefined") return "";
  const p = new URLSearchParams(window.location.search).get("path") ?? "";
  return p && !p.endsWith("/") ? `${p}/` : p;
}

type Item = { kind: "file"; file: FileRow } | { kind: "folder"; folder: FolderRow };
type Confirm =
  | { type: "rename"; item: Item }
  | { type: "move"; files: FileRow[]; folders: FolderRow[] }
  | { type: "delete"; files: FileRow[]; folders: FolderRow[] }
  | { type: "preview"; file: FileRow };

/** The CEO's view of everything stored in Cloudflare R2 for this workspace. */
export function StorageBrowser() {
  const [prefix, setPrefix] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Confirm | null>(null);
  const request = useRef(0);

  // Start at the folder in the address bar and follow back / forward.
  useEffect(() => {
    setPrefix(readPath());
    const onPop = () => { setPrefix(readPath()); setSelected(new Set()); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Search waits until typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (prefix) p.set("prefix", prefix);
    if (filters.q) p.set("q", filters.q);
    if (filters.type) p.set("type", filters.type);
    if (filters.section) p.set("section", filters.section);
    if (filters.linked) p.set("linked", filters.linked);
    if (filters.size) p.set("min_size", filters.size);
    if (filters.month) p.set("month", filters.month);
    if (filters.modified.startsWith("older")) p.set("to", daysAgo(filters.modified === "older365" ? 365 : 90).slice(0, 10));
    else if (filters.modified) p.set("from", filters.modified === "1" ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString() : daysAgo(Number(filters.modified)));
    if (filters.sort !== "name") p.set("sort", filters.sort);
    return p.toString();
  }, [prefix, filters]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const json = await api<Listing>({ query });
      if (id !== request.current) return; // a newer request is on its way
      setData(json);
      setSelected((s) => {
        const visible = new Set([...json.files.map((f) => `f:${f.path}`), ...json.folders.map((f) => `d:${f.path}`)]);
        return new Set([...s].filter((k) => visible.has(k)));
      });
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : "Could not load storage");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  function open(path: string) {
    setPrefix(path);
    setSelected(new Set());
    setSearch("");
    setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }));
    const url = new URL(window.location.href);
    if (path) url.searchParams.set("path", path.replace(/\/$/, "")); else url.searchParams.delete("path");
    window.history.pushState(null, "", url);
  }

  const filtered = !!(filters.q || filters.type || filters.section || filters.linked || filters.modified || filters.size || filters.month);
  const files = data?.files ?? [];
  const folders = data?.folders ?? [];
  const selFiles = files.filter((f) => selected.has(`f:${f.path}`));
  const selFolders = folders.filter((f) => selected.has(`d:${f.path}`));
  const allKeys = [...folders.map((f) => `d:${f.path}`), ...files.map((f) => `f:${f.path}`)];
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  async function download(f: FileRow) {
    try {
      const { url } = await api<{ url: string }>({ method: "POST", body: JSON.stringify({ action: "url", path: f.path, download: true, name: f.name }) });
      window.location.assign(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); }
  }

  const crumbs = prefix.split("/").filter(Boolean);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-10">
      {/* Title and totals */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FontAwesomeIcon icon={faHardDrive} className="h-4 w-4 text-primary" />Storage
          </h1>
          <p className="text-sm text-muted-foreground">Every file in Cloudflare R2 for this workspace. Only you (the CEO) can see this page.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {prefix ? "This folder" : "Total"}: <span className="font-semibold text-foreground">{size(data.folder.bytes)}</span> in {plural(data.folder.files, "file")}
            </span>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={load} disabled={loading} aria-label="Refresh">
            <FontAwesomeIcon icon={faArrowsRotate} spin={loading} className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Where you are */}
      <nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        <button type="button" onClick={() => open("")} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted", !crumbs.length && "font-semibold")}>
          <FontAwesomeIcon icon={faCloud} className="h-3.5 w-3.5 text-muted-foreground" />All files
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1">
            <FontAwesomeIcon icon={faChevronRight} className="h-2.5 w-2.5 text-muted-foreground/60" />
            <button type="button" onClick={() => open(`${crumbs.slice(0, i + 1).join("/")}/`)}
              className={cn("max-w-[220px] truncate rounded-md px-2 py-1 hover:bg-muted", i === crumbs.length - 1 && "font-semibold")} title={c}>
              {c}
            </button>
          </span>
        ))}
      </nav>

      {/* Search and filters */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={prefix ? `Search in ${folderName(prefix)} and its folders` : "Search all files and folders"} className="h-9 pl-9 pr-8" />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
              </button>
            )}
          </div>
          <FilterSelect label="Sort" value={filters.sort} options={SORTS} onChange={(v) => setFilters((f) => ({ ...f, sort: v || "name" }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FontAwesomeIcon icon={faFilter} className="h-3 w-3 text-muted-foreground" />
          <FilterSelect label="Type" value={filters.type} options={{ "": "All types", ...Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, v.label])) }} onChange={(v) => setFilters((f) => ({ ...f, type: v }))} />
          <FilterSelect label="Section" value={filters.section} options={{ "": "All sections", brief: "Brief", reference: "References", main: "Main files", chat: "Chat media" }} onChange={(v) => setFilters((f) => ({ ...f, section: v }))} />
          <FilterSelect label="Task" value={filters.linked} options={{ "": "Linked or not", yes: "Attached to a task", no: "Not attached to a task" }} onChange={(v) => setFilters((f) => ({ ...f, linked: v }))} />
          <FilterSelect label="Modified" value={filters.modified} options={MODIFIED} onChange={(v) => setFilters((f) => ({ ...f, modified: v }))} />
          <FilterSelect label="Size" value={filters.size} options={SIZES} onChange={(v) => setFilters((f) => ({ ...f, size: v }))} />
          {!!data?.months.length && (
            <FilterSelect label="Month" value={filters.month} options={{ "": "All months", ...Object.fromEntries(data.months.map((m) => [m, new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })])) }} onChange={(v) => setFilters((f) => ({ ...f, month: v }))} />
          )}
          {!prefix && !!data?.brands.length && (
            <FilterSelect label="Brand" value="" options={{ "": "Go to brand", ...Object.fromEntries(data.brands.map((b) => [`${b}/`, b])) }} onChange={(v) => v && open(v)} />
          )}
          {(filtered || search) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setFilters((f) => ({ ...NO_FILTERS, sort: f.sort })); }}>
              <FontAwesomeIcon icon={faXmark} className="mr-1.5 h-3 w-3" />Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Selection actions */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <span className="text-xs text-muted-foreground">
            {size(selFiles.reduce((s, f) => s + f.size, 0) + selFolders.reduce((s, f) => s + f.bytes, 0))}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {selFiles.length === 1 && selFolders.length === 0 && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => download(selFiles[0])}><FontAwesomeIcon icon={faDownload} className="mr-1.5 h-3 w-3" />Download</Button>
            )}
            <Button size="sm" variant="outline" className="h-8" onClick={() => setDialog({ type: "move", files: selFiles, folders: selFolders })}><FontAwesomeIcon icon={faFolderTree} className="mr-1.5 h-3 w-3" />Move</Button>
            <Button size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-600" onClick={() => setDialog({ type: "delete", files: selFiles, folders: selFolders })}><FontAwesomeIcon icon={faTrashCan} className="mr-1.5 h-3 w-3" />Delete</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Listing */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {data?.searching && (
          <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            {plural(data.matched.files, "file")} ({size(data.matched.bytes)}) match in {prefix ? <span className="font-medium text-foreground">{folderName(prefix)}</span> : "all files"} and its folders
            {data.shown < data.matched.files && ` · showing the first ${data.shown}, narrow the search to see the rest`}
          </div>
        )}
        {data?.folder.truncated && (
          <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
            <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" />This folder holds more files than can be read at once. Open a subfolder to see everything.
          </div>
        )}

        <div className="hidden grid-cols-[32px_minmax(0,1fr)_110px_minmax(0,200px)_90px_150px_40px] items-center gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <Checkbox checked={allChecked} onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(allKeys))} aria-label="Select all" disabled={!allKeys.length} />
          <span>Name</span><span>Section</span><span>Task</span><span className="text-right">Size</span><span>Modified</span><span />
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <FontAwesomeIcon icon={faTriangleExclamation} className="h-6 w-6 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Try again</Button>
          </div>
        ) : !data ? (
          <div className="divide-y">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex items-center gap-3 px-4 py-3"><div className="h-8 w-8 animate-pulse rounded-lg bg-muted" /><div className="h-3 flex-1 animate-pulse rounded bg-muted" /></div>)}</div>
        ) : !folders.length && !files.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <FontAwesomeIcon icon={filtered || search ? faMagnifyingGlass : faFolder} className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">{filtered || search ? "No files match these filters" : prefix ? "This folder is empty" : "Nothing stored yet"}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{filtered || search ? "Try fewer filters or search a different folder." : "Files uploaded to tasks appear here, sorted by brand, team, month and task."}</p>
          </div>
        ) : (
          <ul className={cn("divide-y transition-opacity", loading && "opacity-60")}>
            {folders.map((f) => (
              <Row key={f.path} checked={selected.has(`d:${f.path}`)} onCheck={() => toggle(`d:${f.path}`)} onOpen={() => open(f.path)}
                icon={<FontAwesomeIcon icon={faFolder} className="h-4 w-4 text-amber-500" />}
                name={f.name} sub={data.searching ? f.path.split("/").slice(0, -2).join(" / ") || "All files" : `${plural(f.files, "file")}`}
                section={null} task={null} bytes={f.bytes} modified={f.modified}
                menu={<>
                  <DropdownMenuItem onClick={() => open(f.path)}><FontAwesomeIcon icon={faFolder} className="mr-2 h-3.5 w-3.5" />Open</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog({ type: "rename", item: { kind: "folder", folder: f } })}><FontAwesomeIcon icon={faPen} className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog({ type: "move", files: [], folders: [f] })}><FontAwesomeIcon icon={faFolderTree} className="mr-2 h-3.5 w-3.5" />Move to…</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDialog({ type: "delete", files: [], folders: [f] })}><FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Delete folder</DropdownMenuItem>
                </>}
              />
            ))}
            {files.map((f) => {
              const meta = TYPE_META[f.type];
              return (
                <Row key={f.path} checked={selected.has(`f:${f.path}`)} onCheck={() => toggle(`f:${f.path}`)} onOpen={() => setDialog({ type: "preview", file: f })}
                  icon={<FontAwesomeIcon icon={meta.icon} className={cn("h-4 w-4", meta.color)} />}
                  name={f.name} sub={data.searching ? f.folder.split("/").join(" / ") : undefined}
                  section={f.section} task={f.linked?.task ?? null} unlinked={!f.linked} bytes={f.size} modified={f.modified}
                  menu={<>
                    <DropdownMenuItem onClick={() => setDialog({ type: "preview", file: f })}><FontAwesomeIcon icon={faEye} className="mr-2 h-3.5 w-3.5" />Preview</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => download(f)}><FontAwesomeIcon icon={faDownload} className="mr-2 h-3.5 w-3.5" />Download</DropdownMenuItem>
                    {f.linked?.task && (
                      <DropdownMenuItem asChild><Link href={`/dashboard/actions/tasks?task=${f.linked.task.id}`}><FontAwesomeIcon icon={faArrowUpRightFromSquare} className="mr-2 h-3.5 w-3.5" />Open task</Link></DropdownMenuItem>
                    )}
                    {data.searching && <DropdownMenuItem onClick={() => open(f.folder ? `${f.folder}/` : "")}><FontAwesomeIcon icon={faFolder} className="mr-2 h-3.5 w-3.5" />Show in folder</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDialog({ type: "rename", item: { kind: "file", file: f } })}><FontAwesomeIcon icon={faPen} className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDialog({ type: "move", files: [f], folders: [] })}><FontAwesomeIcon icon={faFolderTree} className="mr-2 h-3.5 w-3.5" />Move to…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDialog({ type: "delete", files: [f], folders: [] })}><FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
                  </>}
                />
              );
            })}
          </ul>
        )}
      </div>

      {dialog?.type === "preview" && <PreviewDialog file={dialog.file} onClose={() => setDialog(null)} onDownload={() => download(dialog.file)} />}
      {dialog?.type === "rename" && <RenameDialog item={dialog.item} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.type === "move" && <MoveDialog files={dialog.files} folders={dialog.folders} current={prefix} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setSelected(new Set()); load(); }} />}
      {dialog?.type === "delete" && <DeleteDialog files={dialog.files} folders={dialog.folders} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setSelected(new Set()); load(); }} />}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  // Radix Select cannot hold "", so the empty choice travels as "all".
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger aria-label={label} className={cn("h-8 w-auto min-w-[120px] gap-2 text-xs", value && "border-primary/50 bg-primary/5 text-primary")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([k, v]) => <SelectItem key={k || "all"} value={k || "all"} className="text-xs">{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Row({ checked, onCheck, onOpen, icon, name, sub, section, task, unlinked, bytes, modified, menu }: {
  checked: boolean; onCheck: () => void; onOpen: () => void; icon: React.ReactNode; name: string; sub?: string;
  section: Section | null; task: { id: string; title: string; code: string | null } | null; unlinked?: boolean;
  bytes: number; modified: string; menu: React.ReactNode;
}) {
  return (
    <li className={cn("group grid grid-cols-[32px_minmax(0,1fr)_40px] items-center gap-3 px-4 py-2.5 hover:bg-muted/40 md:grid-cols-[32px_minmax(0,1fr)_110px_minmax(0,200px)_90px_150px_40px]", checked && "bg-primary/5")}>
      <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`Select ${name}`} />
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium group-hover:underline" title={name}>{name}</span>
          <span className="block truncate text-[11px] text-muted-foreground" title={sub}>
            {sub}
            {/* Phones: size and date under the name */}
            <span className="md:hidden">{sub ? " · " : ""}{size(bytes)} · {new Date(modified).toLocaleDateString()}</span>
          </span>
        </span>
      </button>
      <span className="hidden md:block">
        {section && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", SECTION_META[section].className)}>
            <FontAwesomeIcon icon={SECTION_META[section].icon} className="h-2.5 w-2.5" />{SECTION_META[section].label}
          </span>
        )}
      </span>
      <span className="hidden min-w-0 md:block">
        {task ? (
          <Link href={`/dashboard/actions/tasks?task=${task.id}`} className="flex min-w-0 items-center gap-1.5 text-xs hover:underline" title={task.title}>
            <FontAwesomeIcon icon={faLink} className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{task.code ? <span className="font-medium">{task.code} </span> : null}{task.title}</span>
          </Link>
        ) : unlinked ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="No task points to this file any more">
            <FontAwesomeIcon icon={faLinkSlash} className="h-2.5 w-2.5" />Not attached
          </span>
        ) : null}
      </span>
      <span className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">{size(bytes)}</span>
      <span className="hidden text-xs text-muted-foreground md:block">{when(modified)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}><FontAwesomeIcon icon={faEllipsisVertical} className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">{menu}</DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────────

function PreviewDialog({ file, onClose, onDownload }: { file: FileRow; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const viewable = ["image", "video", "audio", "pdf"].includes(file.type);
  useEffect(() => {
    if (!viewable) return;
    api<{ url: string }>({ method: "POST", body: JSON.stringify({ action: "url", path: file.path }) })
      .then((r) => setUrl(r.url)).catch((e) => setFailed(e instanceof Error ? e.message : "Could not open the file"));
  }, [file.path, viewable]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
          <DialogDescription className="truncate">{file.folder.split("/").join(" / ")} · {size(file.size)} · {when(file.modified)}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-muted/50">
          {failed ? <p className="text-sm text-red-600">{failed}</p>
            : !viewable ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <FontAwesomeIcon icon={TYPE_META[file.type].icon} className={cn("h-10 w-10", TYPE_META[file.type].color)} />
                <p className="text-sm text-muted-foreground">No preview for this kind of file. Download it to open it.</p>
              </div>
            ) : !url ? <FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" />
            // eslint-disable-next-line @next/next/no-img-element
            : file.type === "image" ? <img src={url} alt={file.name} className="max-h-[65vh] max-w-full object-contain" />
            : file.type === "video" ? <video src={url} controls className="max-h-[65vh] w-full" />
            : file.type === "audio" ? <audio src={url} controls className="w-full max-w-md" />
            : <iframe src={url} title={file.name} className="h-[65vh] w-full bg-white" />}
        </div>
        {file.linked?.task && (
          <p className="text-xs text-muted-foreground">
            Attached to <Link href={`/dashboard/actions/tasks?task=${file.linked.task.id}`} className="font-medium text-foreground hover:underline">{file.linked.task.code ? `${file.linked.task.code} ` : ""}{file.linked.task.title}</Link>
            {file.linked.uploaded_by && <> · uploaded by {file.linked.uploaded_by}</>}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onDownload}><FontAwesomeIcon icon={faDownload} className="mr-2 h-3.5 w-3.5" />Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const original = item.kind === "file" ? item.file.name : item.folder.name;
  const [name, setName] = useState(original);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Select the name without its extension, like a desktop file manager.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    const dot = item.kind === "file" ? original.lastIndexOf(".") : -1;
    el.setSelectionRange(0, dot > 0 ? dot : original.length);
  }, [item.kind, original]);

  const trimmed = name.trim();
  const invalid = !trimmed ? "Enter a name" : /[/\\]/.test(trimmed) ? "Names cannot contain / or \\" : null;

  async function save() {
    if (invalid || trimmed === original) { if (trimmed === original) onClose(); return; }
    setBusy(true);
    try {
      const res = await api<{ moved?: number; failed?: number }>({ method: "POST", body: JSON.stringify(item.kind === "file"
        ? { action: "rename", path: item.file.path, name: trimmed }
        : { action: "rename_folder", path: item.folder.path, name: trimmed }) });
      if (res.failed) toast.warning(`Renamed, but ${plural(res.failed, "file")} could not be moved. Try again.`);
      else toast.success("Renamed");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename {item.kind === "file" ? "file" : "folder"}</DialogTitle>
          <DialogDescription>
            {item.kind === "file"
              ? "If the file is attached to a task, the task shows the new name."
              : `All ${plural(item.folder.files, "file")} inside move with it and keep opening from their tasks.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-2">
          <Input ref={input} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} aria-invalid={!!invalid} maxLength={item.kind === "file" ? 120 : 80} />
          {invalid && name !== original && <p className="text-xs text-red-600">{invalid}</p>}
          {item.kind === "folder" && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-3 w-3" />
              New uploads still go to a folder named after the brand, team or task in the app, so a renamed folder can appear again under its old name.
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !!invalid || trimmed === original}>
              {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ files, folders, current, onClose, onDone }: { files: FileRow[]; folders: FolderRow[]; current: string; onClose: () => void; onDone: () => void }) {
  const [all, setAll] = useState<string[] | null>(null);
  const [find, setFind] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    api<{ folders: string[] }>({ query: "folders=1" }).then((r) => setAll(r.folders)).catch(() => setAll([]));
  }, []);

  // Not into a selected folder (or below it), and not where the items already are.
  const blocked = (path: string) => folders.some((f) => path.startsWith(f.path));
  const here = new Set([...files.map((f) => (f.folder ? `${f.folder}/` : "")), ...folders.map((f) => f.path.split("/").filter(Boolean).slice(0, -1).join("/")).map((p) => (p ? `${p}/` : ""))]);
  const options = ["", ...(all ?? [])].filter((p) => !blocked(p) && (!find || p.toLowerCase().includes(find.toLowerCase())));
  const count = files.length + folders.reduce((s, f) => s + f.files, 0);
  const label = (p: string) => (p ? p.replace(/\/$/, "").split("/").join(" / ") : "All files (top)");

  async function move() {
    if (target === null) return;
    setBusy(true);
    try {
      const res = await api<{ moved: number; failed: number }>({ method: "POST", body: JSON.stringify({ action: "move", to: target, files: files.map((f) => f.path), folders: folders.map((f) => f.path) }) });
      if (res.failed) toast.warning(`Moved ${plural(res.moved, "file")}; ${plural(res.failed, "file")} could not be moved. Try again.`);
      else toast.success(`Moved ${plural(res.moved, "file")} to ${label(target)}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move {folders.length + files.length === 1 ? `"${folders[0]?.name ?? files[0]?.name}"` : `${folders.length + files.length} items`}</DialogTitle>
          <DialogDescription>{plural(count, "file")} will move. Files attached to tasks keep opening from their tasks.</DialogDescription>
        </DialogHeader>
        {!confirming ? (
          <>
            <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a folder" className="h-9" autoFocus />
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {all === null ? (
                <div className="flex justify-center py-8"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>
              ) : options.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No folder matches</p>
              ) : options.map((p) => (
                <button key={p || "root"} type="button" disabled={here.has(p) && here.size === 1} onClick={() => setTarget(p)}
                  className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40", target === p && "bg-primary/10 font-medium text-primary")}
                  style={{ paddingLeft: `${12 + Math.max(0, p.split("/").filter(Boolean).length - 1) * 14}px` }}>
                  <FontAwesomeIcon icon={p ? faFolder : faCloud} className={cn("h-3.5 w-3.5 shrink-0", p ? "text-amber-500" : "text-muted-foreground")} />
                  <span className="truncate">{p ? folderName(p) : "All files (top)"}</span>
                  {here.has(p) && here.size === 1 && <span className="ml-auto text-[11px] text-muted-foreground">current</span>}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={target === null} onClick={() => setConfirming(true)}>Continue</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <p>Move to <span className="font-semibold">{label(target ?? "")}</span>?</p>
              {current && target !== null && !target.startsWith(current) && <p className="text-xs text-muted-foreground">The items will leave the folder you are in.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
              <Button disabled={busy} onClick={move}>{busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Move</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ files, folders, onClose, onDone }: { files: FileRow[]; folders: FolderRow[]; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const count = files.length + folders.reduce((s, f) => s + f.files, 0);
  const bytes = files.reduce((s, f) => s + f.size, 0) + folders.reduce((s, f) => s + f.bytes, 0);
  const attached = files.filter((f) => f.linked);
  const keepers = attached.filter((f) => f.section === "brief" || f.section === "main");
  // Big or folder deletions ask for the word DELETE, a single file just a click.
  const strict = folders.length > 0 || count > 5;
  const ready = !strict || typed.trim().toUpperCase() === "DELETE";

  async function remove() {
    setBusy(true);
    try {
      const res = await api<{ deleted: number; failed: number; task_files: number }>({ method: "POST", body: JSON.stringify({ action: "delete", files: files.map((f) => f.path), folders: folders.map((f) => f.path) }) });
      if (res.failed) toast.warning(`Deleted ${plural(res.deleted, "file")}; ${plural(res.failed, "file")} could not be deleted. Try again.`);
      else toast.success(`Deleted ${plural(res.deleted, "file")}${res.task_files ? `, ${res.task_files} of them from tasks` : ""}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  const title = folders.length + files.length === 1 ? `"${folders[0]?.name ?? files[0]?.name}"` : `${folders.length + files.length} items`;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FontAwesomeIcon icon={faTrashCan} className="h-4 w-4 text-red-500" />Delete {title}?</DialogTitle>
          <DialogDescription>This permanently deletes {plural(count, "file")} ({size(bytes)}) from Cloudflare. It cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {(attached.length > 0 || folders.length > 0) && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs">
              {folders.length > 0
                ? "Files in these folders that are attached to tasks stay listed on their task, marked as deleted."
                : `${plural(attached.length, "file")} ${attached.length === 1 ? "is" : "are"} attached to a task. The task keeps the name, marked as deleted.`}
            </p>
          )}
          {(keepers.length > 0 || folders.length > 0) && (
            <p className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-3 w-3 shrink-0" />
              {keepers.length > 0
                ? `This includes ${plural(keepers.length, "brief or main file")}, which are normally kept forever.`
                : "Folders can include briefs and main files, which are normally kept forever."}
            </p>
          )}
          {strict && (
            <label className="block pt-1 text-xs text-muted-foreground">
              Type <span className="font-semibold text-foreground">DELETE</span> to confirm
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 h-9" autoFocus disabled={busy} onKeyDown={(e) => { if (e.key === "Enter" && ready) remove(); }} />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={!ready || busy} onClick={remove} className="bg-red-600 text-white hover:bg-red-700">
            {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
