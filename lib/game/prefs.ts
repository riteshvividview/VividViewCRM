import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Game notification settings per person, kept in their login's server-only settings
 * (Supabase app_metadata): no table, nothing in the app's data. Only the server can change it.
 * - off: the person turned game popups off
 * - locked: the developer turned them back on and locked them, so they can't turn them off
 */
export interface GameNotify { off: boolean; locked: boolean }

export async function readGameNotify(admin: SupabaseClient, userId: string): Promise<GameNotify> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const g = (data.user?.app_metadata?.game_notify ?? {}) as Partial<GameNotify>;
  return { off: !!g.off && !g.locked, locked: !!g.locked };
}

export async function writeGameNotify(admin: SupabaseClient, userId: string, next: GameNotify): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = { ...(data.user?.app_metadata ?? {}), game_notify: { off: next.locked ? false : next.off, locked: next.locked } };
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
  return error?.message ?? null;
}

/** Everyone in a list who has game popups turned off. */
export async function mutedAmong(admin: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const want = new Set(ids);
  const muted = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) {
      const g = (u.app_metadata?.game_notify ?? {}) as Partial<GameNotify>;
      if (want.has(u.id) && g.off && !g.locked) muted.add(u.id);
    }
    if ((data?.users?.length ?? 0) < 1000) break;
  }
  return muted;
}
