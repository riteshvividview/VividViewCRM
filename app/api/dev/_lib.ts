import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminClient } from "@/app/api/tasks/_lib/helpers";
import { profileOf, signedIn } from "@/lib/auth/fast";
import { isDeveloper } from "@/lib/dev/server";

export interface Caller { userId: string; workspaceId: string; name: string | null }

/** The signed-in, active person, or null. */
export async function caller(): Promise<Caller | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
    },
  });
  const claims = await signedIn(supabase);
  if (!claims) return null;
  const p = await profileOf(adminClient(), claims.sub);
  if (!p?.workspace_id || p.disabled) return null;
  return { userId: claims.sub, workspaceId: p.workspace_id, name: p.full_name };
}

/** The console owner, or null. Anyone else gets a plain 404 so the console stays unknown. */
export async function developer(): Promise<Caller | null> {
  const c = await caller();
  if (!c) return null;
  return (await isDeveloper(adminClient(), c.userId)) ? c : null;
}

export const hidden = () => NextResponse.json({ error: "Not found" }, { status: 404 });
