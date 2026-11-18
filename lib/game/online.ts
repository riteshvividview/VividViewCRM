"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * The live side of the game outside the game page, through Supabase Realtime (memory only, no database):
 * - presence: who has the game on and the app open, who is in the game, who is "up for a game";
 * - broadcast pings: someone got interested, someone joined the game, someone waved at someone.
 * Only people the game is switched on for ever connect here, so excluded people see none of it.
 */
export interface OnlinePerson { id: string; name: string; pic: string | null; inGame: boolean; interested: boolean }
export type Ping = { type: "interested" | "joined"; from: string; name: string } | { type: "wave"; from: string; name: string; to: string };

const INTEREST_MS = 2 * 60 * 60 * 1000; // "up for a game" switches itself off after 2 hours
const KEY_INTEREST = "dg-interested-until";

let channel: RealtimeChannel | null = null;
let me: { id: string; name: string; pic: string | null } | null = null;
let inGame = false;
let interestedUntil = 0;
let offTimer: ReturnType<typeof setTimeout> | null = null;
const NONE: OnlinePerson[] = []; // one shared empty list (React needs a stable value)
let people: OnlinePerson[] = NONE;
const listeners = new Set<() => void>();
const pingListeners = new Set<(p: Ping) => void>();
const emit = () => listeners.forEach((l) => l());

function read() {
  if (!channel) return;
  const state = channel.presenceState<{ name: string; pic: string | null; inGame: boolean; interestedUntil: number }>();
  const now = Date.now();
  people = Object.entries(state).map(([id, metas]) => ({
    id,
    name: metas[metas.length - 1]?.name ?? "Someone",
    pic: metas[metas.length - 1]?.pic ?? null,
    // One person with several tabs counts once: in the game / interested if any tab says so.
    inGame: metas.some((m) => m.inGame),
    interested: metas.some((m) => (m.interestedUntil ?? 0) > now),
  })).sort((a, b) => Number(b.inGame) - Number(a.inGame) || Number(b.interested) - Number(a.interested) || a.name.localeCompare(b.name));
  emit();
}

const track = () => channel?.track({ name: me?.name ?? "Someone", pic: me?.pic ?? null, inGame, interestedUntil: interestedUntil > Date.now() ? interestedUntil : 0 });

function scheduleOff() {
  if (offTimer) clearTimeout(offTimer);
  if (interestedUntil > Date.now()) offTimer = setTimeout(() => setInterested(false), interestedUntil - Date.now() + 50);
}

export function joinOnline(workspaceId: string, person: { id: string; name: string; pic: string | null }) {
  if (channel && me?.id === person.id) return;
  leaveOnline();
  me = person;
  // "Up for a game" is remembered in this browser, so it comes back when the app is opened again (until it runs out).
  try { interestedUntil = Number(localStorage.getItem(KEY_INTEREST) ?? 0) || 0; } catch { interestedUntil = 0; }
  if (interestedUntil <= Date.now()) interestedUntil = 0;
  scheduleOff();
  const supabase = createClient();
  channel = supabase.channel(`dg-online:${workspaceId}`, { config: { presence: { key: person.id } } });
  channel
    .on("presence", { event: "sync" }, read)
    .on("broadcast", { event: "ping" }, ({ payload }) => { const p = payload as Ping; if (p.from !== me?.id) pingListeners.forEach((l) => l(p)); })
    .subscribe((status) => { if (status === "SUBSCRIBED") void track(); });
}

export function leaveOnline() {
  if (!channel) return;
  const c = channel;
  channel = null;
  void c.untrack().finally(() => createClient().removeChannel(c));
  people = NONE;
  emit();
}

export function setInGame(v: boolean) {
  if (inGame === v) return;
  inGame = v;
  void track();
  if (v && me) sendPing({ type: "joined", from: me.id, name: me.name });
}

export function setInterested(v: boolean) {
  interestedUntil = v ? Date.now() + INTEREST_MS : 0;
  try { if (v) localStorage.setItem(KEY_INTEREST, String(interestedUntil)); else localStorage.removeItem(KEY_INTEREST); } catch {}
  scheduleOff();
  void track();
  if (v && me) sendPing({ type: "interested", from: me.id, name: me.name });
  emit();
}
export const isInterested = () => interestedUntil > Date.now();
export const interestEndsAt = () => interestedUntil;

/** Wave at someone: they get a popup asking them to come and play. */
export function wave(to: string) {
  if (me) sendPing({ type: "wave", from: me.id, name: me.name, to });
}

function sendPing(p: Ping) {
  void channel?.send({ type: "broadcast", event: "ping", payload: p });
}

export function onPing(l: (p: Ping) => void) { pingListeners.add(l); return () => { pingListeners.delete(l); }; }

export const onlineStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => people,
  server: () => NONE,
};

/** Re-render when "interested" changes for me (the store emits on that too). */
export const interestStore = {
  subscribe: onlineStore.subscribe,
  get: () => interestedUntil > Date.now(),
  server: () => false,
};
