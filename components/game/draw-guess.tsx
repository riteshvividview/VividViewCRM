"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { onlineStore, setInGame, wave } from "@/lib/game/online";
import { isClose, maskWord, normalise, pickWords } from "@/lib/game/words";
import { sfx } from "@/lib/game/sound";
import { celebrateAt, loadSakuga } from "@/lib/game/sakuga";
import {
  ArrowLeft, Bell, BellOff, EraserIcon, HandWave, Gamepad2, PaintBrush, PencilIcon, Send, TrashCanIcon, Trophy, UndoIcon, Users,
} from "@/components/shared/fa-icons";
import { cn } from "@/lib/utils";
import Confetti from "react-confetti";
import { toast } from "sonner";

/*
 * Draw and Guess. Nothing is stored on a server:
 * - Supabase Realtime presence says who is in the room; broadcast carries strokes, guesses and the game state.
 * - The first person who joined the room is the host: their browser runs the clock, the turns and the scores.
 *   If they leave, the next person takes over from the last state everyone already has.
 * - Only the drawer's browser knows the word. Guesses are sent to the drawer, who checks them, so the word
 *   is never broadcast until the reveal.
 * - A copy of the state sits in this tab's sessionStorage (so a refresh doesn't lose your place) and is
 *   removed when the game ends or you leave.
 */

const CHOOSE_MS = 12_000;
const DRAW_MS = 60_000;
const REVEAL_MS = 5_000;
const PODIUM_MS = 15_000;
const STORE_KEY = "dg-session";
const ART = "/games/draw-guess";

type Phase = "lobby" | "choosing" | "drawing" | "reveal" | "podium";
interface GameState {
  id: string;
  phase: Phase;
  round: number;
  rounds: number;
  order: string[];
  turn: number;
  drawerId: string | null;
  endsAt: number;
  total: number;
  scores: Record<string, number>;
  names: Record<string, string>;
  guessed: string[];
  len: number;
  word: string | null; // only set in the reveal
  rev: number;
}
const EMPTY: GameState = { id: "", phase: "lobby", round: 0, rounds: 0, order: [], turn: 0, drawerId: null, endsAt: 0, total: 0, scores: {}, names: {}, guessed: [], len: 0, word: null, rev: 0 };

interface Player { id: string; name: string; joinedAt: number; pic: string | null }
interface Stroke { id: string; color: string; size: number; pts: number[] }
interface ChatLine { id: string; kind: "chat" | "correct" | "close" | "system" | "join" | "leave"; name?: string; text: string }

const COLORS = ["#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#14b8a6", "#3b82f6", "#6d28d9", "#ec4899", "#92400e", "#9ca3af"];
const SIZES = [4, 10, 22];
const uid = () => Math.random().toString(36).slice(2, 10);
const roundsFor = (n: number) => (n <= 4 ? 3 : n <= 8 ? 2 : 1);

/** Their own profile photo; the first letter on a colour of their own when they haven't added one. */
function Avatar({ p, size = 36 }: { p: { id: string; name: string; pic: string | null }; size?: number }) {
  const [broken, setBroken] = useState(false);
  const hue = [...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ring-2 ring-background" style={{ width: size, height: size, background: `hsl(${hue} 65% 52%)`, fontSize: size * 0.42 }}>
      {p.name.slice(0, 1).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.pic && !broken && <img src={p.pic} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setBroken(true)} />}
    </span>
  );
}

/** A full-screen flash of one of the game's images (round start, your turn). Hidden if the image isn't there yet. */
function Flash({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
      className="dg-flash pointer-events-none fixed left-1/2 top-1/2 z-[70] w-[min(560px,80vw)]" />
  );
}

/** A one-off confetti burst over the whole window for the winners (react-confetti, not looping). */
function WinnerConfetti({ onDone }: { onDone: () => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  if (!size.w || (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return null;
  return (
    <Confetti
      width={size.w} height={size.h}
      recycle={false} numberOfPieces={450} gravity={0.25} initialVelocityY={18} initialVelocityX={10}
      confettiSource={{ x: size.w / 2 - 60, y: size.h * 0.45, w: 120, h: 10 }}
      colors={["#6d28d9", "#8b5cf6", "#ec4899", "#facc15", "#f97316", "#22c55e", "#ffffff"]}
      onConfettiComplete={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 75, pointerEvents: "none" }}
    />
  );
}

export function DrawGuess() {
  const profile = useShellProfile();
  const me = profile?.user_id ?? "";
  const myName = profile?.full_name || "Someone";
  const ws = profile?.workspace_id ?? "";
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, onlineStore.server);

  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<GameState>(EMPTY);
  const [mask, setMask] = useState<string[]>([]);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [waved, setWaved] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [confetti, setConfetti] = useState(0);
  // Task notifications during the game: shown by default; each person can turn them off (remembered in this browser).
  const [quiet, setQuiet] = useState(false);
  useEffect(() => { try { setQuiet(localStorage.getItem("dg-quiet") === "1"); } catch {} }, []);
  useEffect(() => {
    if (quiet) document.body.dataset.gameQuiet = "1"; else delete document.body.dataset.gameQuiet;
    return () => { delete document.body.dataset.gameQuiet; };
  }, [quiet]);

  const chan = useRef<RealtimeChannel | null>(null);
  const gameRef = useRef(game); gameRef.current = game;
  const playersRef = useRef(players); playersRef.current = players;
  const myWordRef = useRef(myWord); myWordRef.current = myWord;
  const maskRef = useRef(mask); maskRef.current = mask;
  const strokes = useRef<Stroke[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const joinedAt = useRef(Date.now());
  const readyAt = useRef(Number.MAX_SAFE_INTEGER);
  const usedWords = useRef(new Set<string>());

  const host = useMemo(() => [...players].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0]?.id ?? null, [players]);
  const isHost = host === me;
  const isDrawer = game.drawerId === me && (game.phase === "choosing" || game.phase === "drawing");
  const canDraw = game.phase === "drawing" && game.drawerId === me;
  const iGuessed = game.guessed.includes(me);
  const left = Math.max(0, Math.ceil((game.endsAt - now) / 1000));

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void chan.current?.send({ type: "broadcast", event, payload });
  }, []);
  const addLine = useCallback((l: Omit<ChatLine, "id">) => setChat((c) => [...c.slice(-80), { ...l, id: uid() }]), []);

  /* ---------------- host: publish state ---------------- */
  const publish = useCallback((next: GameState) => {
    const s = { ...next, rev: gameRef.current.rev + 1 };
    send("state", { state: s });
    onStateRef.current(s); // the host reacts to its own changes like everyone else
  }, [send]);
  const onStateRef = useRef<(s: GameState) => void>(() => {});

  /* ---------------- canvas ---------------- */
  const paint = useCallback((s: Stroke, from = 0) => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (!c || !ctx || s.pts.length < 2) return;
    const w = c.width, h = c.height;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = (s.size / 1000) * w;
    const start = Math.max(0, from - 2);
    if (s.pts.length === 2) { ctx.beginPath(); ctx.arc(s.pts[0] * w, s.pts[1] * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(s.pts[start] * w, s.pts[start + 1] * h);
    for (let i = start + 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i] * w, s.pts[i + 1] * h);
    ctx.stroke();
  }, []);
  const redraw = useCallback(() => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    for (const s of strokes.current) paint(s);
  }, [paint]);
  const clearBoard = useCallback(() => { strokes.current = []; redraw(); }, [redraw]);

  useEffect(() => {
    const box = boxRef.current, c = canvasRef.current;
    if (!box || !c) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(box.clientWidth * dpr);
      c.height = Math.round(box.clientWidth * (9 / 16) * dpr);
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  /* ---------------- connect ---------------- */
  useEffect(() => {
    if (!ws || !me) return;
    setInGame(true);
    void loadSakuga();
    // A refresh mid-game keeps your place; anything older than an hour is thrown away.
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null");
      if (saved?.state && Date.now() - saved.at < 3_600_000) { setGame(saved.state); joinedAt.current = saved.joinedAt ?? joinedAt.current; }
    } catch {}

    const supabase = createClient();
    const ch = supabase.channel(`dg-room:${ws}`, { config: { presence: { key: me }, broadcast: { self: false } } });
    chan.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ name: string; joinedAt: number; pic: string | null }>();
      setPlayers(Object.entries(st).map(([id, metas]) => {
        const m = metas[0];
        return { id, name: m?.name ?? "Someone", joinedAt: m?.joinedAt ?? Date.now(), pic: m?.pic ?? null };
      }));
    });
    ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
      if (key === me) return;
      // People already in the room are "joins" too when I arrive; only announce real arrivals after that.
      if (Date.now() - readyAt.current > 2500) {
        const who = (newPresences?.[0] as { name?: string } | undefined)?.name ?? "Someone";
        addLine({ kind: "join", text: `${who} joined the game` });
        toast(`${who} joined the game`, { duration: 2500, position: "bottom-left" });
        sfx.pop();
      }
      // Bring the newcomer up to date: the host sends the state, the drawer sends the drawing so far.
      setTimeout(() => {
        const g = gameRef.current;
        if (hostRef.current === me && g.id) send("state", { state: g });
        if (g.drawerId === me && g.phase === "drawing") send("strokes", { to: key, strokes: strokes.current.slice(-400), mask: maskRef.current });
      }, 400);
    });

    ch.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      if (key === me) return;
      const who = (leftPresences?.[0] as { name?: string } | undefined)?.name ?? "Someone";
      addLine({ kind: "leave", text: `${who} left the game` });
      toast(`${who} left the game`, { duration: 2500, position: "bottom-left" });
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      const s = payload.state as GameState;
      if (!s || s.rev < gameRef.current.rev && s.id === gameRef.current.id) return;
      onState(s);
    });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      const p = payload as { id: string; color: string; size: number; pts: number[] };
      let s = strokes.current.find((x) => x.id === p.id);
      if (!s) { s = { id: p.id, color: p.color, size: p.size, pts: [] }; strokes.current.push(s); }
      const from = s.pts.length;
      s.pts.push(...p.pts);
      paint(s, from);
    });
    ch.on("broadcast", { event: "undo" }, ({ payload }) => { strokes.current = strokes.current.filter((s) => s.id !== payload.id); redraw(); });
    ch.on("broadcast", { event: "clear" }, () => clearBoard());
    ch.on("broadcast", { event: "strokes" }, ({ payload }) => {
      if (payload.to !== me) return;
      strokes.current = payload.strokes as Stroke[]; redraw();
      if (Array.isArray(payload.mask)) setMask(payload.mask as string[]);
    });
    ch.on("broadcast", { event: "mask" }, ({ payload }) => setMask(payload.mask as string[]));
    ch.on("broadcast", { event: "chat" }, ({ payload }) => addLine({ kind: "chat", name: payload.name as string, text: payload.text as string }));
    ch.on("broadcast", { event: "close" }, ({ payload }) => { if (payload.to === me) { addLine({ kind: "close", text: `"${payload.text}": you're very close! Keep going` }); sfx.close(); toast("You're very close!", { duration: 1800, position: "top-center" }); } });
    ch.on("broadcast", { event: "reveal" }, ({ payload }) => setGame((g) => ({ ...g, word: payload.word as string })));
    // Only the drawer reads guesses (only they know the word).
    ch.on("broadcast", { event: "guess" }, ({ payload }) => onGuess(payload as { from: string; name: string; text: string }));
    // The host scores correct guesses reported by the drawer, and starts games on request.
    ch.on("broadcast", { event: "correct" }, ({ payload }) => onCorrect(payload as { userId: string; name: string }));
    ch.on("broadcast", { event: "pick" }, ({ payload }) => onPick(payload as { by: string; len: number; mask: string[] }));
    ch.on("broadcast", { event: "start" }, () => { if (hostRef.current === me) startGame(); });

    ch.subscribe((status) => {
      setConnected(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") readyAt.current = Date.now();
      if (status === "SUBSCRIBED") void ch.track({ name: myName, joinedAt: joinedAt.current, pic: profile?.avatar_url ?? null });
    });

    return () => {
      setInGame(false);
      void ch.untrack();
      supabase.removeChannel(ch);
      chan.current = null;
      // Leaving the game page clears this tab's copy, unless a game is still running (you can come back).
      if (!gameRef.current.id || gameRef.current.phase === "lobby") { try { sessionStorage.removeItem(STORE_KEY); } catch {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, me]);

  const hostRef = useRef(host); hostRef.current = host;

  // Keep this tab's copy in step; drop it when the game ends.
  useEffect(() => {
    try {
      if (game.id && game.phase !== "lobby") sessionStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), state: game, joinedAt: joinedAt.current }));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {}
  }, [game]);

  /* ---------------- everyone: new state ---------------- */
  function onState(s: GameState) {
    const prev = gameRef.current;
    gameRef.current = s;
    setGame(s);
    const newTurn = s.id !== prev.id || s.turn !== prev.turn || (s.phase === "choosing" && prev.phase !== "choosing");
    if (newTurn && (s.phase === "choosing")) {
      clearBoard(); setMask([]); setMyWord(null); setChoices([]);
      if (s.drawerId === me) { setChoices(pickWords(3, usedWords.current)); showFlash(`${ART}/your-turn.webp`); sfx.turn(); }
      else if (s.turn % Math.max(1, s.order.length) === 0) { showFlash(`${ART}/round-start.webp`); sfx.turn(); }
      addLine({ kind: "system", text: `${s.names[s.drawerId ?? ""] ?? "Someone"} is choosing a word` });
    }
    if (s.phase === "drawing" && prev.phase !== "drawing") setMask(Array(s.len).fill("_"));
    if (s.phase === "reveal" && prev.phase !== "reveal") {
      sfx.timeUp();
      if (s.drawerId === me && myWordRef.current) send("reveal", { word: myWordRef.current }), setGame((g) => ({ ...g, word: myWordRef.current }));
    }
    if (s.phase === "podium" && prev.phase !== "podium") { sfx.win(); setConfetti(Date.now()); setTimeout(() => celebrateAt(document.getElementById("dg-podium"), "gogo"), 300); }
    if (s.phase === "lobby" && prev.phase === "podium") { clearBoard(); setMask([]); setChat([]); }
  }

  onStateRef.current = onState;

  function showFlash(src: string) { setFlash(`${src}#${Date.now()}`); setTimeout(() => setFlash(null), 1400); }

  /* ---------------- drawer ---------------- */
  function choose(word: string) {
    const g = gameRef.current;
    if (g.phase !== "choosing" || g.drawerId !== me || myWordRef.current) return;
    usedWords.current.add(word);
    setMyWord(word); myWordRef.current = word; setChoices([]);
    const m = maskWord(word); setMask(m);
    const msg = { by: me, len: word.length, mask: m };
    send("pick", msg);
    onPick(msg); // the host may be me
  }

  function onGuess(p: { from: string; name: string; text: string }) {
    const g = gameRef.current, word = myWordRef.current;
    if (g.drawerId !== me || !word) return;
    if (g.phase === "drawing" && !g.guessed.includes(p.from) && normalise(p.text) === normalise(word)) {
      const msg = { userId: p.from, name: p.name };
      send("correct", msg); onCorrect(msg);
      return;
    }
    // Nearly right: only the guesser hears it, and the guess isn't shown to others (it would give the word away).
    if (g.phase === "drawing" && isClose(p.text, word)) {
      if (p.from === me) addLine({ kind: "close", text: `"${p.text}": you're very close!` });
      else send("close", { to: p.from, text: p.text });
      return;
    }
    // Wrong guesses are shown to everyone (sent on by the drawer so the word never travels).
    send("chat", { name: p.name, text: p.text });
    addLine({ kind: "chat", name: p.name, text: p.text });
  }

  // Letters reveal one by one as the clock runs down: nothing for the first 25 seconds, then evenly
  // until 6 seconds before the end, always leaving at least one letter (and about 40% of a long word) hidden.
  useEffect(() => {
    if (!canDraw || !myWord) return;
    const g = game;
    const letters = myWord.replace(/ /g, "").length;
    const maxReveal = Math.max(1, Math.min(letters - 1, Math.floor(letters * 0.6)));
    if (letters < 2) return;
    const elapsed = 1 - Math.max(0, g.endsAt - now) / g.total;
    const from = 25 / 60, to = 1 - 6 / 60;
    const want = elapsed < from ? 0 : Math.min(maxReveal, Math.floor(((elapsed - from) / (to - from)) * maxReveal) + 1);
    const shown = maskRef.current.filter((c) => c !== "_" && c !== " ").length;
    if (shown >= want) return;
    const hidden = [...myWord].map((c, i) => (maskRef.current[i] === "_" ? i : -1)).filter((i) => i >= 0);
    if (hidden.length <= 1) return;
    const i = hidden[Math.floor(Math.random() * hidden.length)];
    const next = maskRef.current.map((c, j) => (j === i ? myWord[i] : c));
    setMask(next); send("mask", { mask: next });
  }, [now, canDraw, myWord, game, send]);

  // The drawer picks for you when time runs out.
  useEffect(() => {
    if (game.phase === "choosing" && game.drawerId === me && !myWord && choices.length && game.endsAt - now < 600) choose(choices[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  /* ---------------- host ---------------- */
  function onPick(p: { by: string; len: number; mask: string[] }) {
    if (hostRef.current !== me) return;
    const g = gameRef.current;
    if (g.phase !== "choosing" || g.drawerId !== p.by) return;
    publish({ ...g, phase: "drawing", len: p.len, endsAt: Date.now() + DRAW_MS, total: DRAW_MS, guessed: [], word: null });
  }

  function onCorrect(p: { userId: string; name: string }) {
    addLine({ kind: "correct", name: p.name, text: "guessed the word!" });
    if (p.userId === me) { sfx.correct(); celebrateAt(feedRef.current, "don"); } else sfx.pop();
    if (hostRef.current !== me) return;
    const g = gameRef.current;
    if (g.phase !== "drawing" || g.guessed.includes(p.userId) || p.userId === g.drawerId) return;
    const leftMs = Math.max(0, g.endsAt - Date.now());
    const pts = 50 + Math.round(150 * (leftMs / g.total)); // faster = more
    const scores = { ...g.scores, [p.userId]: (g.scores[p.userId] ?? 0) + pts, [g.drawerId!]: (g.scores[g.drawerId!] ?? 0) + 40 };
    const names = { ...g.names, [p.userId]: p.name };
    const guessed = [...g.guessed, p.userId];
    const guessers = playersRef.current.filter((x) => x.id !== g.drawerId).length;
    const done = guessed.length >= guessers;
    publish({ ...g, scores, names, guessed, ...(done ? { phase: "reveal" as const, endsAt: Date.now() + REVEAL_MS, total: REVEAL_MS } : {}) });
  }

  function startGame() {
    const ps = [...playersRef.current].sort((a, b) => a.joinedAt - b.joinedAt);
    if (ps.length < 2) return;
    const order = ps.map((p) => p.id);
    const names = Object.fromEntries(ps.map((p) => [p.id, p.name]));
    const g: GameState = { ...EMPTY, id: uid(), rounds: roundsFor(order.length), order, names, scores: Object.fromEntries(order.map((id) => [id, 0])), rev: gameRef.current.rev };
    nextTurn(g, -1);
    void fetch("/api/game/announce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players: ps.map((p) => p.name) }) }).catch(() => {});
  }

  function nextTurn(g: GameState, from: number) {
    const present = new Set(playersRef.current.map((p) => p.id));
    const total = g.order.length * g.rounds;
    let t = from + 1;
    while (t < total && !present.has(g.order[t % g.order.length])) t++;
    if (t >= total || present.size < 2) {
      publish({ ...g, phase: "podium", drawerId: null, endsAt: Date.now() + PODIUM_MS, total: PODIUM_MS });
      return;
    }
    publish({
      ...g, phase: "choosing", turn: t, round: Math.floor(t / g.order.length) + 1, drawerId: g.order[t % g.order.length],
      endsAt: Date.now() + CHOOSE_MS, total: CHOOSE_MS, guessed: [], len: 0, word: null,
    });
  }

  // The host's clock: moves the game on when time is up or the drawer has left.
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (hostRef.current !== me) return;
      const g = gameRef.current;
      if (!g.id || g.phase === "lobby") return;
      const drawerHere = playersRef.current.some((p) => p.id === g.drawerId);
      if (g.phase === "choosing" && (n > g.endsAt + 3000 || !drawerHere)) nextTurn(g, g.turn);
      else if (g.phase === "drawing" && (n >= g.endsAt || !drawerHere)) publish({ ...g, phase: "reveal", endsAt: n + REVEAL_MS, total: REVEAL_MS });
      else if (g.phase === "reveal" && n >= g.endsAt) nextTurn(g, g.turn);
      else if (g.phase === "podium" && n >= g.endsAt) publish({ ...EMPTY, rev: g.rev });
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Heartbeat so a newcomer or a new host always has the latest state.
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => { const g = gameRef.current; if (g.id) send("state", { state: g }); }, 4000);
    return () => clearInterval(t);
  }, [isHost, send]);

  // Last ten seconds tick.
  useEffect(() => { if (game.phase === "drawing" && left > 0 && left <= 10) sfx.tick(); }, [left, game.phase]);

  /* ---------------- drawing input ---------------- */
  const live = useRef<{ s: Stroke; sent: number } | null>(null);
  const flushT = useRef<ReturnType<typeof setInterval> | null>(null);
  function flush() {
    const l = live.current;
    if (!l || l.sent >= l.s.pts.length) return;
    const pts = l.s.pts.slice(l.sent).map((v) => Math.round(v * 1000) / 1000);
    send("stroke", { id: l.s.id, color: l.s.color, size: l.s.size, pts });
    l.sent = l.s.pts.length;
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { id: uid(), color: eraser ? "#ffffff" : color, size: eraser ? Math.max(size, 22) : size, pts: point(e) };
    strokes.current.push(s);
    live.current = { s, sent: 0 };
    paint(s);
    flushT.current = setInterval(flush, 45);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (!l) return;
    const from = l.s.pts.length;
    l.s.pts.push(...point(e));
    paint(l.s, from);
  }
  function up() {
    if (!live.current) return;
    flush();
    live.current = null;
    if (flushT.current) clearInterval(flushT.current);
  }
  function undo() {
    const s = strokes.current.pop();
    if (!s) return;
    redraw(); send("undo", { id: s.id });
  }

  /* ---------------- guessing ---------------- */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim().slice(0, 80);
    if (!t) return;
    setText("");
    const g = gameRef.current;
    if (g.phase === "drawing" && g.drawerId !== me && !g.guessed.includes(me)) {
      // Only the drawer checks it; they send it on to everyone if it's wrong.
      send("guess", { from: me, name: myName, text: t });
    } else if (g.phase !== "drawing" || g.drawerId !== me) {
      send("chat", { name: myName, text: t });
      addLine({ kind: "chat", name: myName, text: t });
    }
  }

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [chat]);

  /* ---------------- view ---------------- */
  const ranked = useMemo(() => {
    const ids = new Set([...players.map((p) => p.id), ...Object.keys(game.scores)]);
    return [...ids].map((id) => {
      const p = players.find((x) => x.id === id);
      return { id, name: p?.name ?? game.names[id] ?? "Someone", pic: p?.pic ?? null, score: game.scores[id] ?? 0, here: !!p };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [players, game.scores, game.names]);
  const keen = online.filter((p) => p.interested && p.id !== me && !players.some((x) => x.id === p.id));
  const drawerName = game.names[game.drawerId ?? ""] ?? players.find((p) => p.id === game.drawerId)?.name ?? "Someone";
  const inGame = game.id && game.phase !== "lobby";
  const pct = game.total ? Math.max(0, Math.min(1, (game.endsAt - now) / game.total)) : 0;

  return (
    // Full screen over the app (sidebar and top bar), one background behind every block.
    <div className="fixed inset-0 z-[35] overflow-y-auto bg-violet-100 bg-cover bg-center dark:bg-violet-950" style={{ backgroundImage: `url(${ART}/lobby-bg.webp)` }}>
    <div className="pointer-events-none fixed inset-0 bg-white/80 backdrop-blur-sm dark:bg-black/80" />
    <div className="relative mx-auto flex min-h-full max-w-[1800px] flex-col gap-3 p-3 sm:p-4">
      <style>{`@keyframes dgFlash{0%{opacity:0;transform:translate(-50%,-50%) scale(.6) rotate(-6deg)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08) rotate(2deg)}30%{transform:translate(-50%,-50%) scale(1) rotate(0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.05)}}.dg-flash{animation:dgFlash 1.4s ease-out both}@media (prefers-reduced-motion: reduce){.dg-flash{animation:none;transform:translate(-50%,-50%)}}`}</style>
      {flash && <Flash key={flash} src={flash.split("#")[0]} />}
      {confetti > 0 && <WinnerConfetti key={confetti} onDone={() => setConfetti(0)} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" aria-label="Back to apps" className="rounded-lg border p-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><Gamepad2 className="h-5 w-5 text-fuchsia-500" />Draw and Guess</h1>
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {online.length} online · {players.length} in the room{!connected && " · connecting..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inGame && game.phase !== "podium" && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">Round {game.round} of {game.rounds}</span>
          )}
          {inGame && (game.phase === "drawing" || game.phase === "choosing") && (
            <span className={cn("relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold", left <= 10 && game.phase === "drawing" ? "text-red-500" : "")}
              style={{ background: `conic-gradient(${left <= 10 && game.phase === "drawing" ? "#ef4444" : "#8b5cf6"} ${pct * 360}deg, rgba(127,127,127,0.18) 0)` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background">{left}</span>
            </span>
          )}
          <button type="button" onClick={() => setQuiet((v) => { const n = !v; try { localStorage.setItem("dg-quiet", n ? "1" : "0"); } catch {} return n; })}
            aria-label={quiet ? "Show task notifications" : "Hide task notifications"} title={quiet ? "Task notifications are off" : "Task notifications are on"}
            className={cn("rounded-lg border bg-background/80 p-2 backdrop-blur hover:text-foreground", quiet ? "text-muted-foreground" : "text-violet-600")}>
            {quiet ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[280px_1fr_320px]">
        {/* Players */}
        <aside className="order-2 self-start rounded-2xl border border-white/40 bg-background/75 p-3 shadow-lg backdrop-blur-md lg:order-1">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3 w-3" />Players</p>
          <ul className="space-y-1.5">
            {ranked.map((p, i) => (
              <li key={p.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", game.guessed.includes(p.id) && "bg-emerald-500/10", !p.here && "opacity-50")}>
                <Avatar p={p} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    {p.name}{p.id === me && <span className="text-xs text-muted-foreground">(you)</span>}
                    {p.id === game.drawerId && inGame && <PencilIcon className="h-3 w-3 text-fuchsia-500" aria-label="Drawing" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.score} pts{inGame && i === 0 && p.score > 0 ? " · leading" : ""}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* People who are up for a game but somewhere else in the app: wave to call them over. */}
          {keen.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Up for a game</p>
              <ul className="space-y-1.5">
                {keen.map((p) => {
                  const cool = (waved[p.id] ?? 0) > now - 60_000;
                  return (
                    <li key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                      <Avatar p={p} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      <button
                        type="button"
                        disabled={cool}
                        onClick={(e) => { wave(p.id); setWaved((w) => ({ ...w, [p.id]: Date.now() })); celebrateAt(e.currentTarget, "pon"); toast(`You waved at ${p.name}`, { duration: 1800, position: "bottom-left" }); }}
                        title={cool ? "You just waved. Try again in a minute." : `Wave at ${p.name} to call them over`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 dark:bg-amber-900/30 dark:text-amber-200"
                      >
                        <HandWave className="h-3 w-3" />{cool ? "Waved" : "Wave"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        {/* Board */}
        <section className="order-1 flex flex-col gap-3 lg:order-2">
          <div className="flex min-h-12 items-center justify-center rounded-2xl border border-white/40 bg-background/75 px-4 py-2 text-center shadow-lg backdrop-blur-md">
            {game.phase === "drawing" && canDraw && <p className="text-lg font-bold tracking-wide">Draw: <span className="text-fuchsia-600">{myWord}</span></p>}
            {game.phase === "drawing" && !canDraw && (
              <p className="font-mono text-2xl font-bold tracking-[0.35em]" aria-label={`${game.len} letters`}>
                {(mask.length ? mask : Array(game.len).fill("_")).map((c, i) => <span key={i}>{c === " " ? "  " : c}</span>)}
                <span className="ml-2 align-middle text-xs font-normal tracking-normal text-muted-foreground">{game.len} letters</span>
              </p>
            )}
            {game.phase === "choosing" && <p className="font-semibold">{isDrawer ? "Pick a word to draw" : `${drawerName} is choosing a word...`}</p>}
            {game.phase === "reveal" && <p className="text-lg font-semibold">The word was <span className="text-fuchsia-600">{game.word ?? "..."}</span></p>}
            {game.phase === "lobby" && <p className="font-semibold">Waiting room</p>}
            {game.phase === "podium" && <p className="text-lg font-bold">Game over!</p>}
          </div>

          <div ref={boxRef} className="relative mx-auto w-full overflow-hidden rounded-2xl border-2 border-white/70 bg-white shadow-2xl dark:border-violet-900" style={{ maxWidth: "calc((100vh - 170px) * 16 / 9)" }}>
            <canvas
              ref={canvasRef}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
              className={cn("block w-full touch-none", canDraw ? "cursor-crosshair" : "cursor-default")}
              style={{ aspectRatio: "16 / 9" }}
            />

            {/* Overlays */}
            {game.phase === "lobby" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 text-center dark:from-violet-950 dark:to-fuchsia-950"
                style={{ backgroundImage: `url(${ART}/lobby-bg.webp)`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
                <div className="rounded-2xl bg-background/90 p-6 shadow-xl backdrop-blur">
                  {players.length < 2 ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${ART}/empty-room.webp`} alt="" className="mx-auto mb-2 h-28" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <p className="text-lg font-bold">Waiting for players</p>
                      <p className="text-sm text-muted-foreground">You need at least 2 people. {online.length > 1 ? `${online.length - 1} other${online.length > 2 ? "s are" : " is"} online.` : ""}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold">{players.length} players ready</p>
                      <p className="text-sm text-muted-foreground">{roundsFor(players.length)} round{roundsFor(players.length) > 1 ? "s" : ""} · {DRAW_MS / 1000} seconds a turn · everyone draws once a round</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">{players.map((p) => <Avatar key={p.id} p={p} size={36} />)}</div>
                      <button
                        type="button"
                        onClick={(e) => { celebrateAt(e.currentTarget, "gogo"); if (isHost) startGame(); else send("start", {}); }}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                      >
                        <PaintBrush className="h-4 w-4" />Start the game
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {game.phase === "choosing" && isDrawer && !myWord && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-violet-950/70 p-6 backdrop-blur-sm">
                <p className="text-lg font-bold text-white">Your turn! Pick a word</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {choices.map((w) => (
                    <button key={w} type="button" onClick={() => choose(w)}
                      className="rounded-xl bg-white px-5 py-3 text-lg font-bold text-violet-700 shadow-lg transition-transform hover:-translate-y-1 hover:scale-105">
                      {w}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/80">We'll pick the first one for you in {left}s</p>
              </div>
            )}

            {game.phase === "choosing" && !isDrawer && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                <p className="rounded-xl bg-background px-5 py-3 font-semibold shadow">{drawerName} is choosing a word...</p>
              </div>
            )}

            {game.phase === "reveal" && (
              <div className="absolute inset-x-0 top-4 flex justify-center">
                <div className="flex items-center gap-3 rounded-2xl bg-background/95 px-5 py-3 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${ART}/time-up.webp`} alt="" className="h-12" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div>
                    <p className="text-sm text-muted-foreground">The word was</p>
                    <p className="text-xl font-bold text-fuchsia-600">{game.word ?? "..."}</p>
                    <p className="text-xs text-muted-foreground">{game.guessed.length} guessed it</p>
                  </div>
                </div>
              </div>
            )}

            {game.phase === "podium" && (
              <div id="dg-podium" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-violet-700 to-fuchsia-700 p-6 text-white"
                style={{ backgroundImage: `url(${ART}/winner-podium.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
                <div className="rounded-2xl bg-black/35 p-5 text-center backdrop-blur">
                  <Trophy className="mx-auto h-8 w-8 text-amber-300" />
                  <p className="mt-1 text-2xl font-extrabold">{ranked[0]?.name ?? "Nobody"} wins!</p>
                  <ol className="mt-3 space-y-1 text-left">
                    {ranked.slice(0, 5).map((p, i) => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 font-bold">{i + 1}.</span><Avatar p={p} size={24} /><span className="flex-1 truncate">{p.name}</span><span className="font-bold">{p.score}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-white/80">Back to the waiting room in {left}s. Scores are cleared.</p>
                </div>
              </div>
            )}
          </div>

          {/* Tools (drawer only) */}
          {canDraw && (
            <div className="mx-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/40 bg-background/80 p-2 shadow-lg backdrop-blur-md">
              <div className="flex flex-wrap gap-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { setColor(c); setEraser(false); }}
                    className={cn("h-7 w-7 rounded-full border-2 transition-transform", color === c && !eraser ? "scale-110 border-violet-600" : "border-black/10")} style={{ background: c }} />
                ))}
              </div>
              <span className="mx-1 h-6 w-px bg-border" />
              {SIZES.map((s) => (
                <button key={s} type="button" aria-label={`Brush size ${s}`} onClick={() => setSize(s)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", size === s ? "border-violet-600 bg-violet-50 dark:bg-violet-950" : "")}>
                  <span className="rounded-full bg-foreground" style={{ width: Math.max(4, s / 1.6), height: Math.max(4, s / 1.6) }} />
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-border" />
              <button type="button" onClick={() => setEraser((v) => !v)} aria-label="Eraser" className={cn("rounded-lg border p-2", eraser && "border-violet-600 bg-violet-50 dark:bg-violet-950")}><EraserIcon className="h-4 w-4" /></button>
              <button type="button" onClick={undo} aria-label="Undo" className="rounded-lg border p-2"><UndoIcon className="h-4 w-4" /></button>
              <button type="button" onClick={() => { clearBoard(); send("clear", {}); }} aria-label="Clear the board" className="rounded-lg border p-2 text-red-600"><TrashCanIcon className="h-4 w-4" /></button>
            </div>
          )}
        </section>

        {/* Guesses */}
        <aside className="order-3 flex h-[420px] min-h-0 flex-col rounded-2xl border border-white/40 bg-background/75 shadow-lg backdrop-blur-md lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
          <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{game.phase === "drawing" ? "Guesses" : "Chat"}</p>
          <div ref={feedRef} className="flex-1 space-y-1 overflow-y-auto p-3 text-sm">
            {chat.length === 0 && <p className="text-center text-xs text-muted-foreground">Guesses and chat show up here.</p>}
            {chat.map((l) => (
              <p key={l.id} className={cn(
                "rounded-lg px-2 py-1",
                l.kind === "correct" && "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300",
                l.kind === "close" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                l.kind === "system" && "text-center text-xs text-muted-foreground",
                l.kind === "join" && "text-center text-xs font-medium text-emerald-600 dark:text-emerald-400",
                l.kind === "leave" && "text-center text-xs font-medium text-rose-500",
              )}>
                {l.name && <b>{l.name} </b>}{l.text}
              </p>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              disabled={canDraw || (game.phase === "drawing" && iGuessed)}
              placeholder={canDraw ? "You're drawing" : game.phase === "drawing" ? (iGuessed ? "You got it! Wait for the others" : "Type your guess") : "Type your guess"}
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            />
            <button type="submit" aria-label="Send" disabled={!text.trim()} className="rounded-lg bg-violet-600 px-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
        </aside>
      </div>
    </div>
    </div>
  );
}
