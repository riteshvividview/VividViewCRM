"use client";

/** My game notification setting (kept on the server so the developer can turn it back on). */
export interface NotifyPrefs { off: boolean; locked: boolean; loaded: boolean }

let prefs: NotifyPrefs = { off: false, locked: false, loaded: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const INITIAL = prefs;

export async function loadNotifyPrefs() {
  try {
    const r = await fetch("/api/game/prefs", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    prefs = { off: !!j.off, locked: !!j.locked, loaded: true };
    emit();
  } catch {}
}

/** Turn my game popups off or on. Returns an error message when it isn't allowed. */
export async function setNotifyOff(off: boolean): Promise<string | null> {
  const before = prefs;
  prefs = { ...prefs, off };
  emit();
  try {
    const r = await fetch("/api/game/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ off }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { prefs = before; emit(); return j.error ?? "Could not change it"; }
    prefs = { off: !!j.off, locked: !!j.locked, loaded: true };
    emit();
    return null;
  } catch { prefs = before; emit(); return "Could not change it"; }
}

export const notifyPrefsStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => prefs,
  server: () => INITIAL,
};
