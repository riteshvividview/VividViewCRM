"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLogo } from "@/components/shared/auth-logo";
import { toast } from "sonner";

const PENDING_KEY = "vvcrm_signup_pending";

const TYPE_COPY = {
  password_reset: {
    heading: "Check your inbox",
    subheading: "We sent a 6-digit password reset code to",
    icon: Mail,
    backHref: "/auth/forgot-password",
    backLabel: "Back",
  },
  registration: {
    heading: "Verify your email",
    subheading: "We sent a 6-digit code to confirm your account for",
    icon: UserPlus,
    backHref: "/auth/signup",
    backLabel: "Back to sign up",
  },
} as const;

type OtpType = keyof typeof TYPE_COPY;

export default function VerifyOtpPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const rawType = params.get("type") ?? "registration";
  const type: OtpType = rawType in TYPE_COPY ? (rawType as OtpType) : "registration";
  const copy = TYPE_COPY[type];
  const Icon = copy.icon;

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) router.replace("/auth/login");
    inputRefs.current[0]?.focus();
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const focusNext = (i: number) => { if (i < 5) inputRefs.current[i + 1]?.focus(); };
  const focusPrev = (i: number) => { if (i > 0) inputRefs.current[i - 1]?.focus(); };

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char) focusNext(i);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i]) focusPrev(i);
    if (e.key === "ArrowLeft") focusPrev(i);
    if (e.key === "ArrowRight") focusNext(i);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }, []);

  const otp = digits.join("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Enter all 6 digits"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, type }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Verification failed"); return; }

      if (type === "password_reset") {
        router.push(`/auth/reset-password?token=${encodeURIComponent(data.resetToken)}&email=${encodeURIComponent(data.email)}`);
        return;
      }

      if (type === "registration") {
        let pending: { fullName: string; email: string; password: string } | null = null;
        try {
          const raw = sessionStorage.getItem(PENDING_KEY);
          if (raw) pending = JSON.parse(raw);
        } catch {}

        if (!pending) {
          toast.error("Session expired. Please sign up again.");
          router.push("/auth/signup");
          return;
        }

        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: pending.email,
            password: pending.password,
            fullName: pending.fullName,
            creationToken: data.creationToken,
          }),
        });
        const regData = await regRes.json();
        sessionStorage.removeItem(PENDING_KEY);

        if (!regRes.ok) {
          toast.error(regData.error ?? "Failed to create account");
          return;
        }

        toast.success("Account created! You can now sign in.");
        router.push("/auth/login");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to resend");
      } else {
        toast.success("A new code has been sent");
        setDigits(Array(6).fill(""));
        inputRefs.current[0]?.focus();
        setCooldown(60);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="animate-fade-in w-full">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <AuthLogo className="mb-6" />
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center mb-4">
            <Icon className="h-7 w-7 text-purple-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white text-center">
            {copy.heading}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 text-center max-w-xs">
            {copy.subheading}
          </p>
          {email && (
            <p className="text-sm font-semibold text-foreground mt-0.5 text-center break-all">{email}</p>
          )}
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 rounded-xl
                  bg-slate-50 dark:bg-slate-800
                  border-slate-200 dark:border-slate-700
                  text-slate-900 dark:text-white
                  focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20
                  transition-all duration-150"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-medium"
            disabled={loading || otp.length < 6}
          >
            {loading && <Loader2 className="animate-spin h-4 w-4" />}
            {loading ? "Verifying…" : "Verify code"}
          </Button>
        </form>

        <div className="flex items-center justify-center gap-2 mt-5">
          <span className="text-sm text-muted-foreground">Didn&apos;t receive it?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || cooldown > 0}
            className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>

        <Link
          href={copy.backHref}
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {copy.backLabel}
        </Link>
      </div>
    </div>
  );
}
