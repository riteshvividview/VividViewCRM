import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import { REMEMBER_COOKIE, forSession } from "./remember";

const remembered = () => typeof document === "undefined" || parse(document.cookie)[REMEMBER_COOKIE] !== "0";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = parse(document.cookie);
          return Object.keys(all).map((name) => ({ name, value: all[name] ?? "" }));
        },
        setAll(cookies) {
          const keep = remembered();
          for (const { name, value, options } of cookies) document.cookie = serialize(name, value, forSession(options ?? {}, keep));
        },
      },
    }
  );
}

/** Saves the "Remember me" choice before signing in (kept for a year). */
export function setRemember(on: boolean) {
  document.cookie = serialize(REMEMBER_COOKIE, on ? "1" : "0", { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
}
