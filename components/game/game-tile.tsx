"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, Bell, BellOff, HandIcon, Users } from "@/components/shared/fa-icons";
import { interestEndsAt, interestStore, onlineStore, setInterested } from "@/lib/game/online";
import { notifyPrefsStore, setNotifyOff } from "@/lib/game/notify-prefs";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { cn } from "@/lib/utils";

const GAME = "/dashboard/games/draw-guess";

/** Stops a control inside the tile from also opening the game. */
const own = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn(); };

/** The Draw and Guess tile on the launcher: online count, "up for a game", game notifications and sound. */
export function GameTile({ delay }: { delay: number }) {
  const me = useShellProfile()?.user_id;
  const online = useSyncExternalStore(onlineStore.subscribe, onlineStore.get, onlineStore.server);
  const interested = useSyncExternalStore(interestStore.subscribe, interestStore.get, interestStore.server);
  const prefs = useSyncExternalStore(notifyPrefsStore.subscribe, notifyPrefsStore.get, notifyPrefsStore.server);

  const playing = online.filter((p) => p.inGame);
  const keen = online.filter((p) => p.interested && !p.inGame);
  const rest = online.filter((p) => !p.inGame && !p.interested);
  const who = [
    playing.length && `In the game: ${playing.map((p) => p.name).join(", ")}`,
    keen.length && `Up for a game: ${keen.map((p) => p.name).join(", ")}`,
    rest.length && `Online: ${rest.map((p) => p.name).join(", ")}`,
  ].filter(Boolean).join("\n") || "Nobody else is online";

  async function toggleNotify() {
    const err = await setNotifyOff(!prefs.off);
    if (err) toast.error(err);
    else toast(prefs.off ? "Game notifications on" : "Game notifications off", { duration: 1800 });
  }

  const btn = "flex h-7 w-7 items-center justify-center rounded-full border transition-colors";
  return (
    <Link
      href={GAME}
      aria-label="Draw and Guess"
      style={{ animationDelay: `${delay}ms` }}
      className="group relative flex h-52 w-52 flex-col justify-end self-start justify-self-start overflow-hidden rounded-2xl border bg-card p-2 ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-fuchsia-500/40 animate-fade-in [animation-fill-mode:both]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/games/draw-guess/round-start.webp" alt="" className="absolute inset-x-0 top-0 h-[calc(100%-86px)] w-full object-contain object-center p-2 transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-card/20 to-transparent" />

      {/* Online now: hover for names */}
      <span title={who} className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-violet-700 shadow backdrop-blur dark:bg-slate-900/80 dark:text-violet-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        <Users className="h-3 w-3" />{online.length}
        {online.some((p) => p.id !== me && p.interested) && <HandIcon className="ml-0.5 h-3 w-3 text-amber-500" aria-label="Someone is up for a game" />}
      </span>
      <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-violet-700 shadow backdrop-blur transition-all duration-300 group-hover:bg-violet-700 group-hover:text-white">
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
      </span>

      <div className="relative rounded-xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md dark:bg-slate-900/85">
        <h3 className="text-sm font-semibold text-foreground">Draw and Guess</h3>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={own(() => { setInterested(!interested); toast(interested ? "You're no longer up for a game" : "Everyone interested can see you're up for a game (for 2 hours)", { duration: 2200 }); })}
            title={interested ? `Up for a game until ${new Date(interestEndsAt()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Click to stop.` : "Show others you're up for a game (for 2 hours)"}
            aria-pressed={interested}
            className={cn("inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-colors",
              interested ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-background/70 text-muted-foreground hover:text-foreground")}
          >
            <HandIcon className="h-3 w-3" />{interested ? "Up for it" : "I'm in"}
          </button>
          <button
            type="button"
            onClick={own(toggleNotify)}
            disabled={prefs.locked}
            title={prefs.locked ? "Game notifications are kept on for you" : prefs.off ? "Game notifications are off. Click to turn on." : "Turn off game notifications"}
            aria-label={prefs.off ? "Turn on game notifications" : "Turn off game notifications"}
            className={cn(btn, prefs.off ? "text-muted-foreground" : "text-violet-600", prefs.locked && "cursor-not-allowed opacity-60")}
          >
            {prefs.off ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </Link>
  );
}
