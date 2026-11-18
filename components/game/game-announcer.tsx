"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFeature, useShellProfile } from "@/lib/supabase/profile-context";
import { isInterested, joinOnline, leaveOnline, onlineStore, onPing, type Ping } from "@/lib/game/online";
import { loadNotifyPrefs, notifyPrefsStore } from "@/lib/game/notify-prefs";
import { chimeThrice, launchFanfare, setMuted, sfx } from "@/lib/game/sound";
import { celebrateAt } from "@/lib/game/sakuga";
import { Gamepad2, Users, X } from "@/components/shared/fa-icons";
import { cn } from "@/lib/utils";

export const GAME_PATH = "/dashboard/games/draw-guess";
type Msg =
  | { kind: "launch" }
  | { kind: "starting"; by: string; players: string[] }
  | { kind: "interested"; name: string }
  | { kind: "joined"; name: string }
  | { kind: "wave"; name: string };

const SAME_PERSON_GAP = 2 * 60 * 1000; // at most one "interested"/"joined" popup per person every 2 minutes

/**
 * Runs only for people the game is switched on for (excluded people never connect, so they see nothing).
 * Shows the big top popup with the chimes, unless the person turned game notifications off.
 */
export function GameAnnouncer() {
  const on = useFeature("draw_guess");
  const soundsOff = useFeature("game_sounds_off");
  useEffect(() => { setMuted(soundsOff); }, [soundsOff]);
  const profile = useShellProfile();
  const router = useRouter();
  const pathname = usePathname();
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, onlineStore.server);
  const prefs = useSyncExternalStore(notifyPrefsStore.subscribe, notifyPrefsStore.get, notifyPrefsStore.server);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [shown, setShown] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrom = useRef(new Map<string, number>());
  const mutedRef = useRef(prefs.off); mutedRef.current = prefs.off;
  const pathRef = useRef(pathname); pathRef.current = pathname;

  useEffect(() => {
    if (!on || !profile?.workspace_id) { leaveOnline(); return; }
    joinOnline(profile.workspace_id, { id: profile.user_id, name: profile.full_name || "Someone", pic: profile.avatar_url ?? null });
    void loadNotifyPrefs();
  }, [on, profile?.workspace_id, profile?.user_id, profile?.full_name, profile?.avatar_url]);
  useEffect(() => () => leaveOnline(), []);

  // A switch changed in the developer console: show or hide things straight away. If the game was
  // switched off for me while I'm on it, go back to the apps instead of showing a "not found" page.
  useEffect(() => {
    const onRefresh = async () => {
      if (pathRef.current.startsWith(GAME_PATH)) {
        const r = await fetch("/api/game/prefs", { cache: "no-store" }).catch(() => null);
        if (r && r.status === 404) { router.replace("/dashboard"); return; }
      }
      router.refresh();
    };
    window.addEventListener("vv:refresh", onRefresh);
    return () => window.removeEventListener("vv:refresh", onRefresh);
  }, [router]);

  // Server pings (launch, a game starting, the developer changing my settings).
  useEffect(() => {
    const onGame = (e: Event) => {
      const m = (e as CustomEvent<Msg | { kind: "prefs" } | { kind: "sound"; on: boolean }>).detail;
      if (!m?.kind) return;
      if (m.kind === "prefs") { void loadNotifyPrefs(); return; }
      if (m.kind === "sound") { setMuted(!(m as unknown as { on: boolean }).on); return; }
      if (m.kind === "launch") router.refresh(); // picks up the switch so the app tile appears
      if (mutedRef.current) return;
      if (m.kind === "starting" && pathRef.current.startsWith(GAME_PATH)) return; // already there
      setMsg(m as Msg);
    };
    window.addEventListener("vv:game", onGame);
    return () => window.removeEventListener("vv:game", onGame);
  }, [router]);

  // Pings from other players: someone is interested, someone joined, someone waved at me.
  useEffect(() => {
    if (!on) return;
    return onPing((p: Ping) => {
      if (mutedRef.current) return;
      const here = pathRef.current.startsWith(GAME_PATH);
      if (p.type === "wave") {
        if (p.to !== profile?.user_id || here) return;
        setMsg({ kind: "wave", name: p.name });
        return;
      }
      // Only people who are up for a game (or already in it) hear about interest and joins.
      const last = lastFrom.current.get(`${p.type}:${p.from}`) ?? 0;
      if (Date.now() - last < SAME_PERSON_GAP) return;
      if (p.type === "interested" && (here || isInterested())) { lastFrom.current.set(`${p.type}:${p.from}`, Date.now()); setMsg({ kind: "interested", name: p.name }); }
      if (p.type === "joined" && !here && isInterested()) { lastFrom.current.set(`${p.type}:${p.from}`, Date.now()); setMsg({ kind: "joined", name: p.name }); }
    });
  }, [on, profile?.user_id]);

  useEffect(() => {
    if (!msg) return;
    const r = requestAnimationFrame(() => {
      setShown(true);
      if (msg.kind === "launch") launchFanfare();
      else if (msg.kind === "starting" || msg.kind === "wave") chimeThrice();
      else sfx.turn();
      setTimeout(() => celebrateAt(cardRef.current, msg.kind === "launch" ? "don" : msg.kind === "wave" ? "pon" : "gogo"), 350);
    });
    timer.current = setTimeout(close, msg.kind === "launch" ? 25000 : 15000);
    return () => { cancelAnimationFrame(r); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg]);

  // Opening the game closes it, unless it's news for someone already playing.
  useEffect(() => { if (pathname.startsWith(GAME_PATH) && msg?.kind !== "interested") close(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  function close() {
    setShown(false);
    setTimeout(() => setMsg(null), 300);
  }

  if (!msg || !on) return null;
  const others = online.filter((p) => p.id !== profile?.user_id);
  const playing = online.filter((p) => p.inGame);
  const keen = online.filter((p) => p.interested);
  const names = msg.kind === "starting" ? msg.players : others.map((p) => p.name);
  const inGameNow = pathname.startsWith(GAME_PATH);

  const copy = {
    launch: { title: "Draw and Guess is on!", body: "A quick game to refresh your mind. Join in if you're interested." },
    starting: { title: msg.kind === "starting" ? `${msg.by} is starting a game!` : "", body: "Grab a pencil and jump in before the first round starts." },
    interested: { title: msg.kind === "interested" ? `${msg.name} is up for a game!` : "", body: inGameNow ? "Wave at them from the players list, or start a round." : "Join the game and play together." },
    joined: { title: msg.kind === "joined" ? `${msg.name} joined the game` : "", body: "They're in the room now. Come and play!" },
    wave: { title: msg.kind === "wave" ? `${msg.name} waved at you!` : "", body: "They're in the game and waiting for you. Come and play!" },
  }[msg.kind];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-4">
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Draw and Guess"
        className={cn(
          "pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-300/50 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 text-white shadow-2xl transition-all duration-300 ease-out",
          shown ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/games/draw-guess/launch-hero.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="relative px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Keep it secret</p>
          <h2 className="text-xl font-bold">{copy.title}</h2>
          <p className="text-sm text-white/85">{copy.body}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              {online.length} online{playing.length ? ` · ${playing.length} playing` : ""}{keen.length ? ` · ${keen.length} interested` : ""}
            </span>
            {names.slice(0, 6).map((n) => (
              <span key={n} className="rounded-full bg-white/10 px-2 py-0.5">{n}</span>
            ))}
            {names.length > 6 && <span className="text-xs text-white/75">+{names.length - 6} more</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!inGameNow && (
              <button
                type="button"
                onClick={() => { close(); router.push(GAME_PATH); }}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-violet-700 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Gamepad2 className="h-4 w-4" />Join the game
              </button>
            )}
            <button type="button" onClick={close} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
              <Users className="h-4 w-4" />{inGameNow ? "OK" : "Maybe later"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
