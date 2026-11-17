import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { broadcast } from "./notify";
import { getTaskSettings } from "./settings";

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
  /** HR with view-only access to Tasks: may read, never change anything. */
  readOnly: boolean;
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
  // A password alone is not enough for an account that has two-factor sign-in turned on.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, workspace_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.workspace_id) return null;

  const role = profile.role ?? "employee";
  // HR access to the Tasks app is decided by the CEO in Task settings.
  let readOnly = false;
  if (role === "hr") {
    const { hr_access } = await getTaskSettings(admin, profile.workspace_id);
    if (hr_access === "hidden") return null;
    readOnly = hr_access === "view";
  }

  return { userId: user.id, workspaceId: profile.workspace_id, role, readOnly };
}

export function isHR(role: string): boolean {
  return role === "super_admin" || role === "hr";
}

/** Channel every open Tasks app of a workspace listens on for "something changed". */
export const syncChannel = (workspaceId: string) => `tasks-sync:${workspaceId}`;

/**
 * Called by every handler that changes task data. Once the response has been sent,
 * everyone in the workspace gets a ping and re-reads their tasks, so boards,
 * planners and open tasks stay in step without a page refresh.
 */
export function syncWorkspace(workspaceId: string) {
  after(() => broadcast([{ topic: syncChannel(workspaceId), event: "changed" }]));
}

export function readOnlyResponse() {
  return NextResponse.json({ error: "You have view-only access to Tasks" }, { status: 403 });
}

/** CEO (super_admin) and team leads create and manage brands, and can manage any task. */
export function isLead(role: string): boolean {
  return role === "super_admin" || role === "team_lead";
}
