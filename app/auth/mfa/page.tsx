"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLogo } from "@/components/shared/auth-logo";
import { createClient } from "@/lib/supabase/client";

/** Second sign-in step for accounts with an authenticator app: asks for the 6-digit code. */
export default function MfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // Nothing to verify (no 2FA, already verified, or not signed in): carry on.
      if (!level || level.nextLevel !== "aal2" || level.currentLevel === "aal2") { window.location.href = "/dashboard"; return; }
      const { data } = await supabase.auth.mfa.listFactors();
      const id = data?.totp?.[0]?.id;
      if (!id) { window.location.href = "/dashboard"; return; }
      setFactorId(id);
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length < 6 || busy) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { setBusy(false); setCode(""); toast.error("That code is not right. Try the newest code from your app."); return; }
    window.location.href = "/dashboard";
  }

  async function cancel() {
    await createClient().auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <div className="animate-fade-in">
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/50">
        <div className="mb-7 flex flex-col items-center text-center">
          <AuthLogo className="mb-6" />
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" /></span>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Two-factor sign-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </div>
        {factorId ? (
          <form onSubmit={verify} className="space-y-4">
            <Input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className="h-12 text-center text-xl font-semibold tracking-[0.5em]" />
            <Button type="submit" className="h-11 w-full" disabled={busy || code.length < 6}>
              {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Verify
            </Button>
            <button type="button" onClick={cancel} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">Sign in with a different account</button>
          </form>
        ) : (
          <div className="flex justify-center py-6"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>
        )}
      </div>
    </div>
  );
}
