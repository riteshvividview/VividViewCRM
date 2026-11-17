/**
 * The Tasks app loads brands and teams once (start-up request) and shares them here,
 * so the sidebar lists don't fetch their own copies on every page change.
 */
export const LISTS_EVENT = "tasks:lists";
export interface SharedLists { projects?: { id: string; name: string; color?: string | null }[]; teams?: { id: string; name: string; color?: string | null; member_ids?: string[] }[]; can_manage_teams?: boolean }

let latest: SharedLists = {};

export function publishLists(part: SharedLists) {
  latest = { ...latest, ...part };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LISTS_EVENT, { detail: latest }));
}
export const currentLists = () => latest;
