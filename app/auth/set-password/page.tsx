"use client";

import { useState } from "react";
import { Loader2 } from "@/components/shared/fa-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard, PasswordInput, PasswordRules, passwordProblem, postJson } from "@/components/auth/auth-ui";
import { createClient } from "@/lib/supabase/client";

/** Right after signing in with a password the CEO chose: the person picks their own before going on. */
export default function SetPasswordPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const weak = passwordProblem(pw);
    if (weak) { setError(weak); return; }
    if (pw !== confirm) { setError("The two passwords don't match"); return; }
    setBusy(true); setError(null);
    const r = await postJson("/api/auth/password", { action: "first", password: pw });
    if (!r.ok) { setBusy(false); setError(r.data.error ?? "Could not change the password"); return; }
    // Pick up the cleared flag in this session before going on.
    await createClient().auth.refreshSession().catch(() => {});
    window.location.href = "/dashboard";
  }

  async function signOut() {
    await createClient().auth.signOut({ scope: "local" });
    window.location.href = "/auth/login";
  }

  return (
    <AuthCard title="Choose your own password" subtitle="Replace your temporary password to continue.">
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 8 characters" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">Confirm new password</Label>
          <PasswordInput id="pw2" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
          <PasswordRules value={pw} confirm={confirm} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" className="h-10 w-full bg-purple-700 font-medium text-white hover:bg-purple-800" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save and continue
        </Button>
      </form>
      <button type="button" onClick={signOut} className="mt-5 block w-full text-center text-sm text-muted-foreground hover:text-foreground">Sign out</button>
    </AuthCard>
  );
}
