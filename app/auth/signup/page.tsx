"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLogo } from "@/components/shared/auth-logo";
import { toast } from "sonner";

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const PENDING_KEY = "vvcrm_signup_pending";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!SUPABASE_CONFIGURED) { toast.error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local"); return; }

    setLoading(true);
    try {
      // Save signup data temporarily — used after OTP is verified
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ fullName, email, password }));

      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: "registration" }),
      });
      const data = await res.json();
      if (!res.ok) {
        sessionStorage.removeItem(PENDING_KEY);
        toast.error(data.error ?? "Failed to send verification code");
        return;
      }

      router.push(`/auth/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&type=registration`);
    } catch {
      sessionStorage.removeItem(PENDING_KEY);
      toast.error("Authentication service unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <AuthLogo className="mb-6" />
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Create your account</h2>
          <p className="text-sm text-muted-foreground mt-1">Start your free workspace today</p>
        </div>

        {!SUPABASE_CONFIGURED && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 mb-5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Supabase not configured. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="font-mono">.env.local</code>.</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-medium mt-2"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin h-4 w-4" />}
            {loading ? "Sending verification code…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By creating an account, you agree to our{" "}
          <span className="underline cursor-pointer hover:text-foreground">Terms of Service</span>
        </p>
      </div>
    </div>
  );
}
