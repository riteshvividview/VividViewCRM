"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bug, X } from "@/components/shared/fa-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeature } from "@/lib/supabase/profile-context";
import { cn } from "@/lib/utils";

/** A readable name for the page someone is on: its main heading, else the last part of the address. */
function pageName(path: string): string {
  const h1 = document.querySelector("main h1")?.textContent?.trim();
  if (h1) return h1.slice(0, 120);
  const last = path.split("/").filter(Boolean).pop() ?? "Home";
  return decodeURIComponent(last).replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const SIZE = 44;
const SIDE = 24;      // gap from the left/right edge
const BOTTOM = 24;    // gap from the bottom edge
const TOP = 72;       // top corners sit below the top bar
const MARGIN = 12;    // the form never comes closer than this to any edge
const GAP = 10;       // between the button and the form
const PANEL_W = 360;
const KEY = "report-problem-corner";

type Corner = "br" | "bl" | "tr" | "tl";
const CORNERS: Corner[] = ["br", "bl", "tr", "tl"];

/** Top-left point of the button for a corner. */
function cornerXY(c: Corner) {
  const x = c.endsWith("r") ? window.innerWidth - SIZE - SIDE : SIDE;
  const y = c.startsWith("b") ? window.innerHeight - SIZE - BOTTOM : TOP;
  return { x, y };
}
const nearest = (x: number, y: number): Corner =>
  `${y + SIZE / 2 > window.innerHeight / 2 ? "b" : "t"}${x + SIZE / 2 > window.innerWidth / 2 ? "r" : "l"}` as Corner;

/**
 * Floating "Report a problem" button. Drag it and it settles in the nearest of the four corners.
 * The form opens next to it, grows away from it, and always stays inside the window.
 */
export function ReportProblem() {
  const on = useFeature("report_problem");
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [page, setPage] = useState({ path: "", title: "" });
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [corner, setCorner] = useState<Corner>("br");
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState<React.CSSProperties | null>(null);
  const [textMax, setTextMax] = useState(240);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  /** Moves the button without a React render (smooth while dragging). */
  const moveTo = useCallback((x: number, y: number, animate: boolean) => {
    const el = btnRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  useEffect(() => {
    let c: Corner = "br";
    try { const saved = localStorage.getItem(KEY) as Corner | null; if (saved && CORNERS.includes(saved)) c = saved; } catch {}
    setCorner(c);
    setReady(true);
  }, []);

  // Keep the button in its corner (also when the window changes size).
  useLayoutEffect(() => {
    if (!ready || !on) return;
    const put = () => { const p = cornerXY(corner); moveTo(p.x, p.y, false); };
    put();
    window.addEventListener("resize", put);
    return () => window.removeEventListener("resize", put);
  }, [corner, ready, on, moveTo]);

  // The form opens toward the middle of the screen from the button's corner and is anchored on the button's side,
  // so making the text box bigger grows it away from the button. Its height is capped by the space available.
  const place = useCallback(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const { x, y } = cornerXY(corner);
    const width = Math.min(PANEL_W, vw - MARGIN * 2);
    const style: React.CSSProperties = { width };
    let avail: number;
    if (corner.startsWith("b")) {
      style.bottom = vh - (y - GAP);
      avail = y - GAP - MARGIN;
    } else {
      style.top = y + SIZE + GAP;
      avail = vh - (y + SIZE + GAP) - MARGIN;
    }
    if (corner.endsWith("r")) style.right = Math.max(MARGIN, vw - (x + SIZE));
    else style.left = Math.max(MARGIN, x);
    style.maxHeight = avail;
    style.transformOrigin = `${corner.endsWith("r") ? "right" : "left"} ${corner.startsWith("b") ? "bottom" : "top"}`;
    setLayout(style);
    // Room left for the text box once the title, page and buttons are counted.
    setTextMax(Math.max(80, avail - 190));
  }, [corner]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => { setShown(true); textRef.current?.focus(); });
    return () => cancelAnimationFrame(r);
  }, [open]);

  const close = useCallback(() => {
    if (sending) return;
    setShown(false);
    setTimeout(() => setOpen(false), 180);
  }, [sending]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", down); };
  }, [open, close]);

  if (!on) return null;

  function toggle() {
    if (open) { close(); return; }
    const qs = search.toString();
    setPage({ path: pathname + (qs ? `?${qs}` : ""), title: pageName(pathname) });
    setShown(false);
    setOpen(true);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = cornerXY(corner);
    drag.current = { px: e.clientX, py: e.clientY, x, y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      if (open) { setShown(false); setOpen(false); }
      btnRef.current?.classList.add("scale-110", "shadow-xl", "cursor-grabbing");
    }
    const x = Math.min(Math.max(MARGIN, d.x + dx), window.innerWidth - SIZE - MARGIN);
    const y = Math.min(Math.max(MARGIN, d.y + dy), window.innerHeight - SIZE - MARGIN);
    moveTo(x, y, false);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { toggle(); return; }
    btnRef.current?.classList.remove("scale-110", "shadow-xl", "cursor-grabbing");
    const x = d.x + (e.clientX - d.px), y = d.y + (e.clientY - d.py);
    const c = nearest(x, y);
    const p = cornerXY(c);
    moveTo(p.x, p.y, true); // glide into the corner
    setCorner(c);
    try { localStorage.setItem(KEY, c); } catch {}
  }
  function onPointerCancel() {
    drag.current = null;
    btnRef.current?.classList.remove("scale-110", "shadow-xl", "cursor-grabbing");
    const p = cornerXY(corner);
    moveTo(p.x, p.y, true);
  }

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/report-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_path: page.path, page_title: page.title, message }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not send");
      toast.success("Thanks! We'll look into it.");
      setMessage("");
      if (textRef.current) textRef.current.style.height = "";
      setSending(false);
      setShown(false);
      setTimeout(() => setOpen(false), 180);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
      setSending(false);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Report a problem"
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ left: 0, top: 0, width: SIZE, height: SIZE, touchAction: "none", visibility: ready ? "visible" : "hidden", willChange: "transform" }}
        className={cn(
          "fixed z-40 flex cursor-pointer select-none items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-500 shadow-md hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
          open && "bg-slate-200 text-slate-700 dark:bg-slate-700",
        )}
      >
        <Bug className="pointer-events-none h-4 w-4" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Report a problem"
          style={layout ?? { visibility: "hidden" }}
          className={cn(
            "fixed z-50 flex flex-col gap-3 overflow-y-auto rounded-xl border bg-background p-4 shadow-2xl transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            shown && layout ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Report a problem</p>
              <p className="text-xs text-muted-foreground">The page you're on is added for you.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">{page.title}</p>
            <p className="truncate text-muted-foreground">{page.path}</p>
          </div>
          <Textarea
            ref={textRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            rows={4}
            style={{ maxHeight: textMax, minHeight: 80 }}
            className="resize-y"
            placeholder="What happened, and what did you expect?"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          />
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close} disabled={sending}>Cancel</Button>
            <Button size="sm" onClick={send} disabled={sending || !message.trim()}>{sending ? "Sending..." : "Send"}</Button>
          </div>
        </div>
      )}
    </>
  );
}
