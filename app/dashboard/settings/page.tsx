"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Moon, Sun, Monitor, Palette, Bell, Lock, User, LogOut, Loader2, CheckCircle2, Eye, EyeOff, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { applyAccent, ACCENT_KEY, type AccentColor } from "@/components/shared/theme-accent-provider";
import Link from "next/link";

type Tab = "appearance" | "notifications" | "security";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
];

const ACCENT_OPTIONS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "purple",  label: "Violet",  hex: "#7c3aed" },
  { value: "blue",    label: "Blue",    hex: "#2563eb" },
  { value: "emerald", label: "Emerald", hex: "#059669" },
  { value: "rose",    label: "Rose",    hex: "#f43f5e" },
  { value: "amber",   label: "Amber",   hex: "#f59e0b" },
  { value: "slate",   label: "Neutral", hex: "#64748b" },
];

const NOTIFICATION_DEFAULTS = {
  deal_updates: true,
  lead_assignments: true,
  task_reminders: true,
  team_mentions: true,
  weekly_summary: true,
  marketing_reports: false,
  system_announcements: true,
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("appearance");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentColor>("purple");
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFAULTS);

  // Security / password change — 3-step OTP flow
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwStep, setPwStep] = useState<"form" | "otp" | "done">("form");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem(ACCENT_KEY) ?? "purple") as AccentColor;
    setAccent(stored);
    const notifStored = localStorage.getItem("vividview-notifications");
    if (notifStored) {
      try { setNotifications({ ...NOTIFICATION_DEFAULTS, ...JSON.parse(notifStored) }); } catch {}
    }
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const focusOtpNext = (i: number) => { if (i < 5) otpRefs.current[i + 1]?.focus(); };
  const focusOtpPrev = (i: number) => { if (i > 0) otpRefs.current[i - 1]?.focus(); };

  const handleOtpChange = (i: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[i] = char;
    setOtpDigits(next);
    if (char) focusOtpNext(i);
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[i]) focusOtpPrev(i);
    if (e.key === "ArrowLeft") focusOtpPrev(i);
    if (e.key === "ArrowRight") focusOtpNext(i);
  };

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((c, idx) => { if (idx < 6) next[idx] = c; });
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  }, [otpDigits]);

  function handleAccentChange(a: AccentColor) {
    setAccent(a);
    applyAccent(a);
  }

  function handleNotifToggle(key: keyof typeof NOTIFICATION_DEFAULTS) {
    setNotifications((n) => {
      const updated = { ...n, [key]: !n[key] };
      localStorage.setItem("vividview-notifications", JSON.stringify(updated));
      return updated;
    });
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "password_change" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send code"); return; }
      toast.success("Verification code sent to your email");
      setPwStep("otp");
      setOtpDigits(Array(6).fill(""));
      setOtpCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch { toast.error("Something went wrong"); }
    finally { setOtpLoading(false); }
  }

  async function handleResendOtp() {
    if (otpCooldown > 0) return;
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "password_change" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to resend"); return; }
      toast.success("New code sent");
      setOtpDigits(Array(6).fill(""));
      setOtpCooldown(60);
      otpRefs.current[0]?.focus();
    } catch { toast.error("Something went wrong"); }
    finally { setOtpLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const otp = otpDigits.join("");
    if (otp.length < 6) { toast.error("Enter all 6 digits"); return; }
    setVerifyLoading(true);
    try {
      // Verify OTP
      const verifyRes = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, type: "password_change" }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) { toast.error(verifyData.error ?? "Invalid code"); return; }

      // Update password via Supabase client (user already has a session)
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.updateUser({ password: newPw });
      if (error) { toast.error(error.message); return; }

      toast.success("Password updated successfully");
      setPwStep("done");
      setTimeout(() => {
        setPwStep("form");
        setNewPw(""); setConfirmPw("");
        setOtpDigits(Array(6).fill(""));
      }, 2500);
    } catch { toast.error("Something went wrong"); }
    finally { setVerifyLoading(false); }
  }

  async function handleSignOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
    }
    window.location.href = "/auth/login";
  }

  return (
    <div>
      <PageHeader title="Settings" description="Customize your Vivid View experience" />

      <div className="flex flex-col sm:flex-row gap-6 max-w-4xl">
        {/* Tab sidebar */}
        <div className="sm:w-48 shrink-0">
          <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    tab === t.id
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t.label}
                </button>
              );
            })}
            <div className="hidden sm:block mt-4 pt-4 border-t border-border">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <User className="h-4 w-4 shrink-0" />Edit Profile
              </Link>
            </div>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Appearance ── */}
          {tab === "appearance" && (
            <>
              {/* Color mode */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Color Mode</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose between light, dark, or system theme</p>
                </div>
                {mounted && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "light", label: "Light", icon: Sun, preview: "bg-white border-slate-200" },
                      { value: "dark", label: "Dark", icon: Moon, preview: "bg-slate-900 border-slate-700" },
                      { value: "system", label: "System", icon: Monitor, preview: "bg-gradient-to-br from-white to-slate-900 border-slate-400" },
                    ].map((m) => {
                      const Icon = m.icon;
                      const active = theme === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => setTheme(m.value)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all",
                            active ? "border-purple-600 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-border/80 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn("w-full h-10 sm:h-12 rounded-lg border", m.preview)} />
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn("h-3.5 w-3.5", active ? "text-purple-600" : "text-muted-foreground")} />
                            <span className={cn("text-xs font-medium", active ? "text-purple-700 dark:text-purple-300" : "text-foreground")}>
                              {m.label}
                            </span>
                          </div>
                          {active && <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Accent color */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Accent Colour</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Changes button, ring, and sidebar highlight colours</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      title={a.label}
                      onClick={() => handleAccentChange(a.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all min-w-[56px]",
                        accent === a.value ? "border-foreground" : "border-transparent hover:border-border"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full" style={{ backgroundColor: a.hex }} />
                      <span className="text-[10px] text-muted-foreground">{a.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Changes buttons, focus rings, active sidebar highlights, and the logo gradient across the entire app.
                </p>
              </div>
            </>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Notification Preferences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Control which events trigger notifications. Stored locally.</p>
              </div>

              {[
                { key: "deal_updates" as const, label: "Deal updates", desc: "When a deal status or stage changes" },
                { key: "lead_assignments" as const, label: "Lead assignments", desc: "When a lead is assigned to you" },
                { key: "task_reminders" as const, label: "Task reminders", desc: "Due date reminders for your action items" },
                { key: "team_mentions" as const, label: "Team mentions", desc: "When someone mentions you in a note" },
                { key: "weekly_summary" as const, label: "Weekly summary", desc: "Pipeline and activity digest every Monday" },
                { key: "marketing_reports" as const, label: "Campaign reports", desc: "Marketing campaign performance updates" },
                { key: "system_announcements" as const, label: "System announcements", desc: "Product updates and maintenance notices" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleNotifToggle(item.key)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                      notifications[item.key] ? "bg-purple-600" : "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
                      notifications[item.key] ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <>
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">A verification code will be sent to your email</p>
                </div>

                {/* Step: done */}
                {pwStep === "done" && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Password updated successfully!</p>
                  </div>
                )}

                {/* Step: form — enter new password */}
                {pwStep === "form" && (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-pw" className="text-xs">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-pw"
                          type={showNew ? "text" : "password"}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="h-9 pr-9 text-sm"
                          minLength={8}
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-pw" className="text-xs">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-pw"
                          type={showConfirm ? "text" : "password"}
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          placeholder="Repeat new password"
                          className="h-9 pr-9 text-sm"
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {confirmPw && newPw !== confirmPw && (
                        <p className="text-[11px] text-red-500">Passwords don&apos;t match</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={otpLoading || !newPw || !confirmPw || newPw !== confirmPw}
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      {otpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      {otpLoading ? "Sending code…" : "Send OTP to verify change"}
                    </Button>
                  </form>
                )}

                {/* Step: OTP — enter verification code */}
                {pwStep === "otp" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="flex items-start gap-2 rounded-lg border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/20 px-3 py-2.5 text-xs text-purple-700 dark:text-purple-400">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Enter the 6-digit code sent to your email to confirm this change</span>
                    </div>

                    {/* 6-digit OTP inputs */}
                    <div className="flex justify-center gap-2">
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          onPaste={handleOtpPaste}
                          className="w-10 h-11 text-center text-lg font-bold border-2 rounded-lg
                            bg-slate-50 dark:bg-slate-800
                            border-slate-200 dark:border-slate-700
                            text-slate-900 dark:text-white
                            focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20
                            transition-all"
                          autoComplete="one-time-code"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => { setPwStep("form"); setOtpDigits(Array(6).fill("")); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpLoading || otpCooldown > 0}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={verifyLoading || otpDigits.join("").length < 6}
                      className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      {verifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {verifyLoading ? "Verifying…" : "Verify & update password"}
                    </Button>
                  </form>
                )}
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Active Session</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">You are signed in on this device</p>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-foreground">This browser</p>
                    <p className="text-xs text-muted-foreground">Current session</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />Active
                  </span>
                </div>
              </div>

              <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-2xl p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Irreversible actions — proceed with care</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-3.5 w-3.5" />Sign out of all devices
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
