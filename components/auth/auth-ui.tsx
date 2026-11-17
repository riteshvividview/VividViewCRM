"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, AlertTriangle } from "@/components/shared/fa-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faCircleCheck, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** The white card every sign-in page sits in. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-7 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/50">
      <div className="mb-5 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const style = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  }[tone];
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={cn("mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]", style)}>
      {tone === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <FontAwesomeIcon icon={tone === "ok" ? faCircleCheck : faCircleInfo} className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/** "Continue with Google". Works only for emails the CEO added. */
export function GoogleButton({ label = "Continue with Google", next }: { label?: string; next?: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (error) { setBusy(false); toast.error("Google sign-in is not available right now"); }
  }
  return (
    <button type="button" onClick={go} disabled={busy}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FontAwesomeIcon icon={faGoogle} className="h-4 w-4 text-[#4285F4]" />}
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function PasswordInput({ id, value, onChange, autoComplete = "current-password", placeholder = "••••••••", autoFocus }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete?: string; placeholder?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required
        autoComplete={autoComplete} placeholder={placeholder} autoFocus={autoFocus} className="h-10 pr-10" maxLength={72} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Same rule as the server: 8+ characters with a letter and a number. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number";
  return null;
}

/** Ticks under a new-password field. */
export function PasswordRules({ value, confirm }: { value: string; confirm?: string }) {
  const rules = [
    { ok: value.length >= 8, label: "8 or more characters" },
    { ok: /[A-Za-z]/.test(value) && /\d/.test(value), label: "A letter and a number" },
    ...(confirm !== undefined ? [{ ok: !!confirm && confirm === value, label: "Both passwords match" }] : []),
  ];
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      {rules.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1.5", r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          <FontAwesomeIcon icon={faCircleCheck} className={cn("h-3 w-3", !r.ok && "opacity-30")} />{r.label}
        </li>
      ))}
    </ul>
  );
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: "No connection. Check your internet and try again." } as T & { error?: string } };
  }
}
