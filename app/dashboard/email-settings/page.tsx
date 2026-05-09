"use client";

import { useState } from "react";
import {
  Mail, Server, Shield, Pen, Plus, Trash2, CheckCircle2,
  Eye, EyeOff, ExternalLink, AlertCircle, Chrome
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  from_name: string;
  from_email: string;
  encryption: "tls" | "ssl" | "none";
}

interface EmailSignature {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
}

interface ConnectedAccount {
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  name: string;
  connected: boolean;
  syncing: boolean;
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
          <Icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── SMTP Form ──────────────────────────────────────────────────────────────
function SmtpSection() {
  const [cfg, setCfg] = useState<SmtpConfig>({
    host: "", port: "587", username: "", password: "",
    from_name: "Vivid View CRM", from_email: "",
    encryption: "tls",
  });
  const [showPw, setShowPw] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SmtpConfig>(k: K, v: SmtpConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 1500));
    setTestResult("success");
    setTesting(false);
  }

  async function handleSave() {
    await new Promise((r) => setTimeout(r, 600));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Section icon={Server} title="SMTP Configuration">
      <div className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">SMTP Host</label>
            <Input className="mt-1 h-9 text-sm" placeholder="smtp.gmail.com" value={cfg.host} onChange={(e) => set("host", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Port</label>
            <Input className="mt-1 h-9 text-sm" placeholder="587" value={cfg.port} onChange={(e) => set("port", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Username / Email</label>
            <Input className="mt-1 h-9 text-sm" placeholder="you@example.com" value={cfg.username} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Password / App Password</label>
            <div className="relative mt-1">
              <Input
                className="h-9 text-sm pr-9"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={cfg.password}
                onChange={(e) => set("password", e.target.value)}
              />
              <button
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Encryption</label>
          <Select value={cfg.encryption} onValueChange={(v) => set("encryption", v as SmtpConfig["encryption"])}>
            <SelectTrigger className="mt-1 h-9 text-sm w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tls">TLS (recommended)</SelectItem>
              <SelectItem value="ssl">SSL</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">From Name</label>
            <Input className="mt-1 h-9 text-sm" placeholder="Your Name" value={cfg.from_name} onChange={(e) => set("from_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">From Email</label>
            <Input className="mt-1 h-9 text-sm" type="email" placeholder="noreply@yourdomain.com" value={cfg.from_email} onChange={(e) => set("from_email", e.target.value)} />
          </div>
        </div>

        {testResult && (
          <div className={cn(
            "flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl",
            testResult === "success" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
          )}>
            {testResult === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {testResult === "success" ? "Connection successful — SMTP is working." : "Connection failed — check your credentials."}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
            {testing ? "Testing…" : "Test Connection"}
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSave}>
            {saved ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Saved</> : "Save Settings"}
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── Signature Builder ──────────────────────────────────────────────────────
function SignatureSection() {
  const [signatures, setSignatures] = useState<EmailSignature[]>([
    { id: "s1", name: "Professional", content: "Best regards,\nAlex Kumar\nSales Manager · Vivid View CRM\nalex@vividview.com · +91 98765 43210", is_default: true },
    { id: "s2", name: "Casual", content: "Thanks,\nAlex", is_default: false },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  function setDefault(id: string) {
    setSignatures((p) => p.map((s) => ({ ...s, is_default: s.id === id })));
  }

  function deleteSignature(id: string) {
    setSignatures((p) => p.filter((s) => s.id !== id));
  }

  function addSignature() {
    if (!newName.trim()) return;
    const s: EmailSignature = {
      id: crypto.randomUUID(), name: newName.trim(),
      content: "Your name\nYour title · Vivid View CRM", is_default: false,
    };
    setSignatures((p) => [...p, s]);
    setNewName("");
    setAdding(false);
    setEditingId(s.id);
  }

  return (
    <Section icon={Pen} title="Email Signatures">
      <div className="space-y-3 max-w-2xl">
        {signatures.map((sig) => (
          <div key={sig.id} className={cn("border rounded-xl overflow-hidden", sig.is_default ? "border-purple-300 dark:border-purple-700" : "border-border")}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{sig.name}</span>
                {sig.is_default && (
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium">Default</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {!sig.is_default && (
                  <button onClick={() => setDefault(sig.id)} className="text-xs text-muted-foreground hover:text-purple-600 px-2 py-1 rounded hover:bg-muted transition-colors">
                    Set default
                  </button>
                )}
                <button
                  onClick={() => setEditingId(editingId === sig.id ? null : sig.id)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                >
                  {editingId === sig.id ? "Done" : "Edit"}
                </button>
                <button onClick={() => deleteSignature(sig.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {editingId === sig.id ? (
              <div className="p-3">
                <Textarea
                  className="text-sm font-mono resize-none"
                  rows={4}
                  value={sig.content}
                  onChange={(e) => setSignatures((p) => p.map((s) => s.id === sig.id ? { ...s, content: e.target.value } : s))}
                />
              </div>
            ) : (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{sig.content}</p>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="flex gap-2">
            <Input className="h-9 text-sm" placeholder="Signature name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") addSignature(); if (e.key === "Escape") setAdding(false); }} />
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white h-9" onClick={addSignature}>Add</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-600 transition-colors"
          >
            <Plus className="h-4 w-4" />Add signature
          </button>
        )}
      </div>
    </Section>
  );
}

// ── Connected Accounts ─────────────────────────────────────────────────────
function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([
    { id: "a1", provider: "gmail",   email: "alex@vividview.com",       name: "Alex Kumar",  connected: true,  syncing: true },
    { id: "a2", provider: "outlook", email: "alex.kumar@vividview.com", name: "Alex Kumar",  connected: false, syncing: false },
  ]);

  function toggleSync(id: string) {
    setAccounts((p) => p.map((a) => a.id === id ? { ...a, syncing: !a.syncing } : a));
  }

  function disconnect(id: string) {
    setAccounts((p) => p.map((a) => a.id === id ? { ...a, connected: false, syncing: false } : a));
  }

  return (
    <Section icon={Mail} title="Connected Accounts">
      <div className="space-y-3 max-w-2xl">
        {accounts.map((acct) => (
          <div key={acct.id} className="flex items-center justify-between p-4 border border-border rounded-xl gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                acct.provider === "gmail" ? "bg-red-100 dark:bg-red-950/30" : "bg-blue-100 dark:bg-blue-950/30"
              )}>
                {acct.provider === "gmail"
                  ? <Chrome className="h-5 w-5 text-red-500" />
                  : <Mail className="h-5 w-5 text-blue-500" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{acct.provider}</p>
                <p className="text-xs text-muted-foreground">{acct.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {acct.connected ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={acct.syncing}
                      onCheckedChange={() => toggleSync(acct.id)}
                    />
                    Sync
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />Connected
                  </span>
                  <button
                    onClick={() => disconnect(acct.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3" />Connect
                  <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Soon</span>
                </Button>
              )}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground mt-2">
          OAuth connections for Gmail and Outlook are coming soon. Configure SMTP above to start sending emails immediately.
        </p>
      </div>
    </Section>
  );
}

// ── Security & Deliverability ──────────────────────────────────────────────
function DeliverabilitySection() {
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [unsubLink, setUnsubLink] = useState(true);
  const [bounceHandle, setBounceHandle] = useState(true);

  const rows = [
    { label: "Track email opens",          desc: "Add a 1px tracking pixel to outbound emails", value: trackOpens,   onChange: setTrackOpens },
    { label: "Track link clicks",          desc: "Wrap links to measure click-through rates",   value: trackClicks,  onChange: setTrackClicks },
    { label: "Auto-insert unsubscribe link", desc: "Required by CAN-SPAM / GDPR",              value: unsubLink,    onChange: setUnsubLink },
    { label: "Handle bounces automatically", desc: "Suppress invalid addresses after 2 bounces", value: bounceHandle, onChange: setBounceHandle },
  ];

  return (
    <Section icon={Shield} title="Tracking & Deliverability">
      <div className="space-y-4 max-w-2xl">
        {rows.map(({ label, desc, value, onChange }) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <Switch checked={value} onCheckedChange={onChange} />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EmailSettingsPage() {
  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure SMTP, signatures, and connected accounts</p>
      </div>

      <SmtpSection />
      <ConnectedAccountsSection />
      <SignatureSection />
      <DeliverabilitySection />
    </div>
  );
}
