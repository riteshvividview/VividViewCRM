/**
 * "Remember me". The choice lives in a small cookie of its own. When it is off,
 * sign-in cookies get no expiry date, so the browser drops them when it closes;
 * when it is on, they last the usual 400 days.
 */
export const REMEMBER_COOKIE = "vv-remember";

type Options = { maxAge?: number; expires?: Date; [k: string]: unknown };

/** Removes the lifetime from cookies that are being set (not from ones being deleted). */
export function forSession<T extends Options>(options: T, remember: boolean): T {
  if (remember || !options || options.maxAge === 0) return options;
  const o = { ...options };
  delete o.maxAge;
  delete o.expires;
  return o;
}
