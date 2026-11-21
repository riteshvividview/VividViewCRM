"use client";

import { useCallback, useEffect, useState } from "react";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faMobileScreen, faDesktop, faCircle, faEye, faEyeSlash, faKey } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatDay, formatTime } from "@/lib/user-prefs";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b pb-7 last:border-0">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Email codes can be up to 10 digits (Supabase setting); authenticator codes are 6.
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

// ── Password ─────────────────────────────────────────────────────────────────
/** New password, confirmed with a 6-digit code sent to the account's email. */
function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "code">("form");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => { if (open) { setStep("form"); setPw(""); setConfirm(""); setCode(""); } }, [open]);

  async function sendCode() {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/d/.test(pw)) { toast.error("Use at least 8 characters with a letter and a number"); return; }
    if (pw !== confirm) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "code" }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Could not send the code"); return; }
      toast.success("Verification code sent to your email");
      setStep("code"); setCode(""); setCooldown(60);
    } finally { setBusy(false); }
  }

  async function verify() {
    if (code.length < 6) return;
    setBusy(true);
    try {
      // Code and new password are checked together on the server.
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change", code, password: pw }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Could not change the password"); return; }
      toast.success("Password updated. We emailed you a confirmation.");
      setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <Card title="Password">
      <Button onClick={() => setOpen(true)}>Change password</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
          {step === "form" ? (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">New password</Label>
                <div className="relative">
                  <Input id="new-pw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters, a letter and a number" className="pr-9" autoComplete="new-password" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <FontAwesomeIcon icon={show ? faEyeSlash : faEye} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">Confirm new password</Label>
                <Input id="confirm-pw" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" onKeyDown={(e) => { if (e.key === "Enter") sendCode(); }} />
                {confirm && pw !== confirm && <p className="text-xs text-red-500">Passwords don&apos;t match</p>}
              </div>
              <p className="text-xs text-muted-foreground">We&apos;ll email you a code to confirm the change.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Enter the code sent to your email.</p>
              <Input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                placeholder="000000" className="h-12 text-center text-xl font-semibold tracking-[0.5em]" />
              <button type="button" disabled={busy || cooldown > 0} onClick={sendCode} className="justify-self-start text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => (step === "code" ? setStep("form") : setOpen(false))}>{step === "code" ? "Back" : "Cancel"}</Button>
            <Button disabled={busy || (step === "form" ? !pw || pw !== confirm : code.length < 6)} onClick={step === "form" ? sendCode : verify}>
              {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}{step === "form" ? "Send code" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Two-factor ───────────────────────────────────────────────────────────────
/** Authenticator-app 2FA (TOTP). Once on, signing in asks for a 6-digit code after the password. */
/** The 10 backup codes, shown once: copy, download or print, then confirm they're saved. */
function BackupCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (codes) setSaved(false); }, [codes]);
  const text = codes ? `Vivid View backup codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n` : "";
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "vivid-view-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    setSaved(true);
  }
  return (
    <Dialog open={!!codes} onOpenChange={(o) => { if (!o && saved) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Save your backup codes</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">If you lose your phone, sign in with one of these instead of the app code. Each works once. They won&apos;t be shown again.</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          {(codes ?? []).map((c) => <span key={c} className="text-center tracking-wider">{c}</span>)}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(text).then(() => { setSaved(true); toast.success("Copied"); }, () => toast.error("Couldn't copy")); }}>Copy</Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={download}>Download</Button>
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={!saved} onClick={onClose}>{saved ? "I've saved them" : "Copy or download them first"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TwoFactorCard() {
  const isCeo = useShellProfile()?.role === "super_admin";
  const [codes, setCodes] = useState<string[] | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined); // undefined = loading
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactorId(data?.totp?.[0]?.id ?? null);
    const r = await fetch("/api/auth/backup-codes", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setLeft((await r.json()).left ?? 0);
  }, []);
  async function makeCodes() {
    const r = await fetch("/api/auth/backup-codes", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(j.error ?? "Could not make backup codes"); return; }
    setCodes(j.codes); setLeft(j.codes.length);
  }
  useEffect(() => { load(); }, [load]);

  async function start() {
    setBusy(true);
    try {
      const supabase = createClient();
      // Remove any half-finished set-up first, otherwise a second one is refused.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
      if (error || !data) { toast.error(error?.message ?? "Could not start set-up"); return; }
      setCode("");
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!enroll || code.length < 6) return;
    setBusy(true);
    try {
      const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
      if (error) { toast.error("That code is not right. Check the app and try again."); return; }
      toast.success("Two-factor sign-in is on");
      setEnroll(null);
      await load();
      await makeCodes(); // shown once, right away
    } finally { setBusy(false); }
  }

  async function cancelEnroll() {
    if (enroll) await createClient().auth.mfa.unenroll({ factorId: enroll.id });
    setEnroll(null);
  }

  async function disable() {
    if (!factorId) return;
    if (!window.confirm("Turn off two-factor sign-in? Your account will be protected by the password only.")) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await fetch("/api/auth/backup-codes", { method: "DELETE" }).catch(() => {});
    toast.success("Two-factor sign-in is off");
    load();
  }

  const on = !!factorId;
  return (
    <Card title="Two-factor authentication (2FA)" hint="A second step when signing in, on top of your password.">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FontAwesomeIcon icon={faMobileScreen} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Authenticator app</p>
          <p className="text-xs text-muted-foreground">Google Authenticator, Microsoft Authenticator, 1Password and others</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <FontAwesomeIcon icon={faCircle} className={on ? "h-2 w-2 text-emerald-500" : "h-2 w-2 text-muted-foreground/50"} />
          {factorId === undefined ? "Checking" : on ? "Enabled" : "Disabled"}
        </span>
        {factorId !== undefined && (on
          ? <Button variant="outline" size="sm" disabled={busy} onClick={disable}>Disable</Button>
          : <Button variant="outline" size="sm" disabled={busy} onClick={start}>{busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3 w-3" />}Enable</Button>)}
      </div>
      {on && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FontAwesomeIcon icon={faKey} className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Backup codes</p>
            <p className="text-xs text-muted-foreground">{left === null ? "Checking" : left > 0 ? `${left} of 10 left. Use one if you lose your phone.` : "None yet. Make some in case you lose your phone."}</p>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (!left || window.confirm("Make new backup codes? Your old codes will stop working.")) void makeCodes(); }}>{left ? "Get new codes" : "Make codes"}</Button>
        </div>
      )}
      {on && <p className="mt-2 text-xs text-muted-foreground">{isCeo
        ? "If you lose your phone, sign in with a backup code, or ask another CEO to reset two-factor for you in User Management."
        : "If you lose your phone, sign in with a backup code, or ask the CEO to reset two-factor on your account."}</p>}
      <BackupCodesDialog codes={codes} onClose={() => setCodes(null)} />

      <Dialog open={!!enroll} onOpenChange={(o) => { if (!o && !busy) cancelEnroll(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Set up your authenticator app</DialogTitle></DialogHeader>
          {enroll && (
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">1. Scan this code with your authenticator app.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="QR code for the authenticator app" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
              <p className="text-xs text-muted-foreground">Can&apos;t scan? Type this key into the app instead:</p>
              <code className="break-all rounded-md bg-muted px-2 py-1.5 text-center text-xs">{enroll.secret}</code>
              <p className="text-muted-foreground">2. Enter the 6-digit code the app shows.</p>
              <Input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
                placeholder="000000" className="h-12 text-center text-xl font-semibold tracking-[0.5em]" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={cancelEnroll}>Cancel</Button>
            <Button disabled={busy || code.length < 6} onClick={confirm}>{busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Turn on</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Sessions ─────────────────────────────────────────────────────────────────
interface SessionRow { id: string; created_at: string; last_active: string; user_agent: string | null; ip: string | null; is_current: boolean }

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  // Sessions kept alive by the app's server record its name instead of the browser's.
  if (/Next.js/i.test(ua)) return "Web browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /node|undici/i.test(ua) ? "Script" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
const when = (iso: string) => { const d = new Date(iso); return `${formatDay(d, { year: true })}, ${formatTime(d)}`; };

function SessionsCard() {
  const [rows, setRows] = useState<SessionRow[] | null | "unavailable">(null);
  const [busy, setBusy] = useState(false);
  const [signedInAt, setSignedInAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await createClient().auth.getUser();
    setSignedInAt(auth.user?.last_sign_in_at ?? null);
    const { data, error } = await createClient().rpc("my_sessions");
    setRows(error ? "unavailable" : ((data ?? []) as SessionRow[]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function end(id: string) {
    setBusy(true);
    const { error } = await createClient().rpc("end_my_session", { p_session: id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("That device will be signed out");
    load();
  }

  async function signOut(scope: "others" | "global") {
    if (scope === "global" && !window.confirm("Sign out on every device, including this one?")) return;
    setBusy(true);
    const { error } = await createClient().auth.signOut({ scope });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (scope === "global") { window.location.href = "/auth/login"; return; }
    toast.success("Signed out on your other devices");
    load();
  }

  // Without the full device list, at least show the device the person is using now.
  // The device in use is described from this browser itself, which is always accurate.
  const here = typeof navigator === "undefined" ? null : navigator.userAgent;
  const list: SessionRow[] = Array.isArray(rows) ? rows.map((r) => (r.is_current && here ? { ...r, user_agent: here } : r))
    : rows === "unavailable" ? [{ id: "this-device", created_at: signedInAt ?? new Date().toISOString(), last_active: new Date().toISOString(), user_agent: typeof navigator === "undefined" ? null : navigator.userAgent, ip: null, is_current: true }]
    : [];
  return (
    <Card title="Sessions" hint="The devices where you are signed in. End any you don't recognise.">
      {rows === null && <FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" />}
      {rows === "unavailable" && <p className="mb-3 text-xs text-muted-foreground">Only this device can be shown right now. Your other devices can still be signed out below.</p>}
      {list.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Device</th><th className="pb-2 font-medium">IP address</th><th className="pb-2 font-medium">Last active</th><th className="pb-2 font-medium">Signed in</th><th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3"><span className="flex items-center gap-2.5 font-medium"><FontAwesomeIcon icon={/Android|iPhone|iPad/.test(s.user_agent ?? "") ? faMobileScreen : faDesktop} className="h-3.5 w-3.5 text-muted-foreground" />{describeAgent(s.user_agent)}</span></td>
                  <td className="py-3 text-muted-foreground">{s.ip ?? "—"}</td>
                  <td className="py-3 text-muted-foreground">{when(s.last_active)}</td>
                  <td className="py-3 text-muted-foreground">{when(s.created_at)}</td>
                  <td className="py-3 text-right">{s.is_current ? <span className="text-muted-foreground">Current</span> : <Button variant="outline" size="sm" className="h-7" disabled={busy} onClick={() => end(s.id)}>Sign out</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => signOut("others")}>Sign out other devices</Button>
        <Button disabled={busy} onClick={() => signOut("global")}>Sign out everywhere</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A device that is signed out from here stops working within an hour at most.</p>
    </Card>
  );
}

export function SecurityTab() {
  return (
    <div className="max-w-3xl space-y-7">
      <PasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}
