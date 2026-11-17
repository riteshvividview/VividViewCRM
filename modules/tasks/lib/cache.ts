/**
 * A small browser cache for the Tasks app, kept per person.
 * Screens show the cached copy instantly and then refresh it quietly, so opening
 * the app or reloading never starts from a blank page. Everything is cleared when
 * someone signs out or reaches the sign-in page, and each person only ever reads
 * their own entries.
 */
const PREFIX = "vv-cache:v1:";

export function readCache<T>(userId: string | null | undefined, key: string): T | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(userId: string | null | undefined, key: string, value: unknown) {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${userId}:${key}`, JSON.stringify(value));
  } catch {
    // Full or blocked storage: the app simply loads from the server as before.
  }
}

/** Removes every cached entry on this device (sign-out, sign-in page). */
export function clearAllCaches() {
  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
    sessionStorage.removeItem("vv-badge");
  } catch {}
}
