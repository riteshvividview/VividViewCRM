import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: string;
}

/** Resolves the calling user's workspace and role. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, workspace_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.workspace_id) return null;

  return {
    userId: user.id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? "employee",
  };
}

export function isHR(role: string): boolean {
  return role === "super_admin" || role === "hr";
}
