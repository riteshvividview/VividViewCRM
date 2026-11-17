import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, forSession } from "./remember";

export async function createClient() {
  const cookieStore = await cookies();
  const keep = cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, forSession(options, keep))
            );
          } catch {
            // Called from a Server Component — cookies are read-only; ignore
          }
        },
      },
    }
  );
}
