import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/brevo/client";
import { addedEmail, codeEmail, passwordChangedEmail, type CodePurpose } from "@/lib/brevo/auth-emails";

/**
 * Sign-in helpers. Only people the CEO adds in User Management can get in:
 * - added without a password: nothing is sent; they open "Activate your account",
 *   get a 6-digit code by email and choose a password on that same screen,
 * - added with a password the CEO chose: they must replace it right after signing in,
 * - Google works for the same emails only.
 * Codes (never links) keep every step on the device the person started on.
 * Every email goes out through Brevo, so it comes from the company's domain.
 */

export const admin = (): SupabaseClient => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
/** A throwaway public client, e.g. to check a code the person typed. */
export const anon = (): SupabaseClient => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export function appUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return request ? new URL(request.url).origin : "http://localhost:3000";
}

export const normEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

/** At least 8 characters with a letter and a number. Returns what is wrong, or null. */
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Use at least 8 characters";
  if (pw.length > 72) return "Use at most 72 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number";
  return null;
}

// ── Flags kept on the account (only the server can change app_metadata) ──
export interface AccessFlags {
  /** Added by the CEO without a password and not activated yet. */
  invite_pending?: boolean;
  /** The CEO set the password: it must be changed at the next sign-in. */
  must_change_password?: boolean;
  /** When the last code email went out (to slow down repeats). */
  last_email_at?: string | null;
}
export const flagsOf = (u: Pick<User, "app_metadata">): AccessFlags => (u.app_metadata ?? {}) as AccessFlags;

export async function setFlags(db: SupabaseClient, userId: string, patch: AccessFlags & Record<string, unknown>): Promise<void> {
  const { data } = await db.auth.admin.getUserById(userId);
  const current = data.user?.app_metadata ?? {};
  await db.auth.admin.updateUserById(userId, { app_metadata: { ...current, ...patch } });
}

/** The account for an email plus its profile, or null (unknown, or switched off). */
export async function findMember(db: SupabaseClient, email: string) {
  const { data: id } = await db.rpc("get_user_id_by_email", { user_email: email });
  if (!id) return null;
  const [{ data: u }, { data: profile }] = await Promise.all([
    db.auth.admin.getUserById(id as string),
    db.from("profiles").select("full_name, role, workspace_id, disabled").eq("user_id", id).maybeSingle(),
  ]);
  if (!u.user || !profile?.workspace_id || profile.disabled) return null;
  return { user: u.user, profile };
}

/** At most one email of this kind a minute per person. */
export function tooSoon(flags: AccessFlags, seconds = 60): boolean {
  return !!flags.last_email_at && Date.now() - new Date(flags.last_email_at).getTime() < seconds * 1000;
}

/** Emails a 6-digit code (Supabase makes and checks it; it works once and expires). */
export async function sendCode(db: SupabaseClient, user: User, purpose: CodePurpose, name?: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: user.email! });
  if (error || !data.properties?.email_otp) throw new Error(error?.message ?? "Could not create a code");
  await setFlags(db, user.id, { last_email_at: new Date().toISOString() });
  const { subject, htmlContent } = codeEmail(data.properties.email_otp, purpose, name);
  await sendEmail({ to: user.email!, subject, htmlContent });
}

/** A short "you've been added" note pointing to the activation page (no code, no link that does anything by itself). */
export async function sendAddedNotice(db: SupabaseClient, user: User, name: string, request?: Request, addedBy?: string) {
  await setFlags(db, user.id, { last_email_at: new Date().toISOString() });
  const { subject, htmlContent } = addedEmail({ name, page: `${appUrl(request)}/auth/activate`, addedBy });
  await sendEmail({ to: user.email!, subject, htmlContent });
}

/** Checks a 6-digit code. Returns the account and the check's own short session token. */
export async function checkCode(email: string, code: unknown): Promise<{ user: User; accessToken: string } | null> {
  // As long as Supabase makes them (its "Email OTP length" setting, 6 to 10 digits).
  if (typeof code !== "string" || !/^\d{6,10}$/.test(code.trim())) return null;
  const { data, error } = await anon().auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
  if (error || !data.user || !data.session) return null;
  return { user: data.user, accessToken: data.session.access_token };
}

/** Sets a new password and tidies up: flags cleared, optionally signed out everywhere, a notice emailed. */
export async function applyPassword(db: SupabaseClient, user: User, password: string, opts: { signOutEverywhere?: string; notify?: boolean } = {}) {
  const { error } = await db.auth.admin.updateUserById(user.id, { password });
  if (error) throw new Error(/different from the old/i.test(error.message) ? "Choose a password you have not used here before" : error.message);
  await setFlags(db, user.id, { invite_pending: false, must_change_password: false });
  if (opts.signOutEverywhere) await db.auth.admin.signOut(opts.signOutEverywhere, "global").catch(() => {});
  if (opts.notify !== false) {
    const { data: p } = await db.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const { subject, htmlContent } = passwordChangedEmail(p?.full_name ?? "");
    await sendEmail({ to: user.email!, subject, htmlContent }).catch(() => {});
  }
}
