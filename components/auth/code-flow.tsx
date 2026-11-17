"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "@/components/shared/fa-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, GoogleButton, OrDivider, PasswordInput, PasswordRules, passwordProblem, postJson } from "@/components/auth/auth-ui";
import { createClient, setRemember } from "@/lib/supabase/client";

const COPY = {
  activate: {
    title: "Activate your account",
    intro: "We'll email you a code to set your password.",
    send: "Send code",
    codeTitle: "Set your password",
    codeIntro: (email: string) => <>Code sent to <b className="font-medium text-foreground">{email}</b> if it has access.</>,
    save: "Activate and sign in",
    newPw: "Choose a password",
  },
  reset: {
    title: "Forgot your password?",
    intro: "We'll email you a code to set a new one.",
    send: "Send code",
    codeTitle: "Reset your password",
    codeIntro: (email: string) => <>Code sent to <b className="font-medium text-foreground">{email}</b> if it has an account.</>,
    save: "Set password and sign in",
    newPw: "New password",
  },
};

/**
 * Email → 6-digit code + new password, all on this screen and this device.
 * "activate" for first-time users, "reset" for "Forgot password?".
 */
export function CodeFlow({ mode }: { mode: "activate" | "reset" }) {
  const c = COPY[mode];
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { const e = new URLSearchParams(window.location.search).get("email"); if (e) setEmail(e); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    const r = await postJson("/api/auth/forgot", { email });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? "We could not send the email. Try again."); return; }
    setCooldown(60);
    setStep("code");
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(code)) { setError("Enter the code from the email"); return; }
    const weak = passwordProblem(pw);
    if (weak) { setError(weak); return; }
    if (pw !== confirm) { setError("The two passwords don't match"); return; }
    setBusy(true); setError(null);
    const r = await postJson("/api/auth/reset", { email, code, password: pw });
    if (!r.ok) { setBusy(false); setError(r.data.error ?? "Could not set the password"); return; }
    // Signed straight in on this device.
    setRemember(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
    window.location.href = signInError ? `/auth/login?done=reset&email=${encodeURIComponent(email.trim().toLowerCase())}` : "/dashboard";
  }

  const back = (
    <Link href="/auth/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />Back to sign in
    </Link>
  );
  const err = error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  if (step === "code") {
    return (
      <AuthCard title={c.codeTitle} subtitle={c.codeIntro(email.trim().toLowerCase())}>
        <form onSubmit={finish} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="code">Code from the email</Label>
            <Input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} placeholder="Enter code"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-11 text-center text-lg font-semibold tracking-[0.35em] placeholder:font-normal placeholder:tracking-normal" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-pw">{c.newPw}</Label>
            <PasswordInput id="new-pw" value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pw">Confirm password</Label>
            <PasswordInput id="confirm-pw" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
            <PasswordRules value={pw} confirm={confirm} />
          </div>
          {/* Lets password managers save it under the right account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          {err}
          <Button type="submit" className="h-10 w-full bg-purple-700 font-medium text-white hover:bg-purple-800" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{c.save}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep("email"); setError(null); setCode(""); }} className="text-muted-foreground hover:text-foreground">Use a different email</button>
            <button type="button" disabled={busy || cooldown > 0} onClick={() => send()} className="font-medium text-purple-600 hover:text-purple-700 disabled:text-muted-foreground">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
        {back}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={c.title} subtitle={c.intro}>
      <form onSubmit={send} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus className="h-10" />
        </div>
        {err}
        <Button type="submit" className="h-10 w-full bg-purple-700 font-medium text-white hover:bg-purple-800" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{c.send}
        </Button>
      </form>
      {mode === "activate" && (
        <>
          <OrDivider />
          <GoogleButton label="Activate with Google" />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Already activated? <Link href="/auth/login" className="font-medium text-purple-600 hover:text-purple-700">Sign in</Link>
          </p>
        </>
      )}
      {mode === "reset" && back}
    </AuthCard>
  );
}
