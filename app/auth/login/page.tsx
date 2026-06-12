"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLogo } from "@/components/shared/auth-logo";
import { toast } from "sonner";

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (!SUPABASE_CONFIGURED) {
      toast.error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local");
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (error.status === 429) {
          toast.error("Too many login attempts. Please wait a few minutes before trying again.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      toast.error("Authentication service unavailable");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <AuthLogo className="mb-6" />
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
        </div>

        {!SUPABASE_CONFIGURED && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 mb-5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Supabase not configured. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="font-mono">.env.local</code>.</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
            className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-medium"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin h-4 w-4" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

      </div>
    </div>
  );
}
