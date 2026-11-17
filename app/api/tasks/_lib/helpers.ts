import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { broadcast } from "./notify";
import { getTaskSettings } from "./settings";
import { profileOf, signedIn } from "@/lib/auth/fast";

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

  // Checked locally (signed token) and from a short in-memory profile cache: no extra round trips.
  const user = await signedIn(supabase);
  if (!user) return null;

  const admin = adminClient();
  const profile = await profileOf(admin, user.sub);
  if (!profile?.workspace_id || profile.disabled) return null;

  const role = profile.role ?? "employee";
  // HR access to the Tasks app is decided by the CEO in Task settings.
  let readOnly = false;
  if (role === "hr") {
    const { hr_access } = await getTaskSettings(admin, profile.workspace_id);
    if (hr_access === "hidden") return null;
    readOnly = hr_access === "view";
  }

  return { userId: user.sub, workspaceId: profile.workspace_id, role, readOnly };
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
/**
 * What changed, so open screens re-read only that:
 * - { tasks: [ids] }  just these tasks (they are re-fetched by id; gone or hidden ones drop out)
 * - { tasks: [] }     nothing in the task list (e.g. a time block moved)
 * - nothing           anything may have changed: re-read tasks and the reference data
 * A function is read after the response is sent, so it can name a task created during the request.
 */
export type SyncChange = { tasks?: string[] };
export function syncWorkspace(workspaceId: string, change?: SyncChange | (() => SyncChange)) {
  after(() => {
    const c = typeof change === "function" ? change() : change;
    return broadcast([{ topic: syncChannel(workspaceId), event: "changed", payload: c?.tasks ? { tasks: c.tasks.slice(0, 50) } : {} }]);
  });
}

export function readOnlyResponse() {
  return NextResponse.json({ error: "You have view-only access to Tasks" }, { status: 403 });
}

/** CEO (super_admin) and team leads create and manage brands, and can manage any task. */
export function isLead(role: string): boolean {
  return role === "super_admin" || role === "team_lead";
}
