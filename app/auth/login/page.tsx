"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "@/components/shared/fa-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthCard, GoogleButton, Notice, OrDivider, PasswordInput } from "@/components/auth/auth-ui";
import { createClient, setRemember } from "@/lib/supabase/client";

/** Messages for ?error= / ?inactive= / ?done= set by other steps. */
const MESSAGES: Record<string, { tone: "warn" | "info" | "ok"; text: string }> = {
  not_invited: { tone: "warn", text: "This Google account doesn't have access." },
  google_failed: { tone: "warn", text: "Google sign-in didn't finish. Please try again." },
  no_account: { tone: "warn", text: "This account doesn't have access." },
  inactive: { tone: "warn", text: "Your account is deactivated." },
  reset: { tone: "ok", text: "Password changed. Sign in again." },
};

/** Sign in only. There is no sign-up: the CEO adds people in User Management. */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRememberState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "warn" | "info" | "ok"; text: string } | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const key = q.get("inactive") === "1" ? "inactive" : q.get("error") ?? q.get("done");
    if (key && MESSAGES[key]) setNotice(MESSAGES[key]);
    const e = q.get("email");
    if (e) setEmail(e);
    try { if (document.cookie.includes("vv-remember=0")) setRememberState(false); } catch {}
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      setRemember(remember);
      const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (signInError) {
        setError(
          signInError.status === 429 ? "Too many attempts. Wait a few minutes and try again."
          : /banned/i.test(signInError.message) ? "This account is deactivated."
          : /invalid login|invalid credentials/i.test(signInError.message) ? "Wrong email or password."
          : /not confirmed/i.test(signInError.message) ? "Activate your account first."
          : "We couldn't sign you in. Please try again.",
        );
        return;
      }
      // The dashboard decides what comes next (two-factor step, required password change).
      window.location.href = "/dashboard";
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <GoogleButton />
      <OrDivider />
      <form onSubmit={handleLogin} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" className="h-10" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-xs font-medium text-purple-600 transition-colors hover:text-purple-700">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRememberState(v === true)} />
          Remember me
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" className="h-10 w-full bg-purple-700 font-medium text-white hover:bg-purple-800" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        First time here?{" "}
        <Link href={`/auth/activate${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="font-medium text-purple-600 hover:text-purple-700">Activate your account</Link>
      </p>
    </AuthCard>
  );
}
