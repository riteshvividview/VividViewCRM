/** Copies only whitelisted keys; empty strings become null so optional columns clear cleanly. */
export function pickFields(body: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    const v = body[key];
    out[key] = v === "" ? null : v;
  }
  return out;
}
