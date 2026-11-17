"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyAccent, ACCENT_KEY, type AccentColor } from "@/components/shared/theme-accent-provider";
import { DEFAULT_USER_PREFS, TIME_ZONES, USER_PREFS_EVENT, getUserPrefs, saveUserPrefs, type UserPrefs } from "@/lib/user-prefs";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "purple", label: "Violet", hex: "#7c3aed" },
  { value: "blue", label: "Blue", hex: "#2563eb" },
  { value: "emerald", label: "Emerald", hex: "#059669" },
  { value: "rose", label: "Rose", hex: "#f43f5e" },
  { value: "amber", label: "Amber", hex: "#f59e0b" },
  { value: "slate", label: "Neutral", hex: "#64748b" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("h-10 min-w-[150px] rounded-lg border px-4 text-sm font-medium transition-colors",
            value === o.value ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Time zone, theme, date / time format and first day of the week. Saved on the account. */
export function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [accent, setAccent] = useState<AccentColor>("purple");

  useEffect(() => {
    setMounted(true);
    const read = () => setPrefs(getUserPrefs());
    read();
    setAccent((localStorage.getItem(ACCENT_KEY) ?? "purple") as AccentColor);
    window.addEventListener(USER_PREFS_EVENT, read);
    return () => window.removeEventListener(USER_PREFS_EVENT, read);
  }, []);

  async function update(patch: Partial<UserPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const err = await saveUserPrefs(next);
    if (err) toast.error(err); else toast.success("Saved");
  }

  const deviceZone = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <div className="max-w-xl space-y-6">
      <Field label="Time zone" hint={prefs.timeZone === "auto" && deviceZone ? `Following this device: ${deviceZone}` : "Used for chat and activity times."}>
        <Select value={prefs.timeZone} onValueChange={(v) => update({ timeZone: v })}>
          <SelectTrigger className="h-10 w-full max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {TIME_ZONES.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Theme">
        {mounted && (
          <Select value={theme ?? "system"} onValueChange={(v) => {
            const root = document.documentElement;
            root.classList.add("theme-switching");
            window.setTimeout(() => root.classList.remove("theme-switching"), 450);
            setTheme(v);
          }}>
            <SelectTrigger className="h-10 w-full max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Auto (follow this device)</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Accent colour" hint="Buttons, highlights and the active sidebar item.">
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((a) => (
            <button key={a.value} type="button" title={a.label} onClick={() => { setAccent(a.value); applyAccent(a.value); }}
              className={cn("flex min-w-[56px] flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all", accent === a.value ? "border-foreground" : "border-transparent hover:border-border")}>
              <span className="h-7 w-7 rounded-full" style={{ backgroundColor: a.hex }} />
              <span className="text-[10px] text-muted-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Date format">
        <Choice value={prefs.dateFormat} onChange={(v) => update({ dateFormat: v })} options={[{ value: "dmy", label: "31 Dec 2026" }, { value: "mdy", label: "Dec 31, 2026" }]} />
      </Field>

      <Field label="Time format">
        <Choice value={prefs.timeFormat} onChange={(v) => update({ timeFormat: v })} options={[{ value: "12", label: "12 hours: 9:00 PM" }, { value: "24", label: "24 hours: 21:00" }]} />
      </Field>

      <Field label="Week starts on" hint="The first column of the Planner, Schedule and Team calendar.">
        <Choice value={prefs.weekStart} onChange={(v) => update({ weekStart: v })} options={[{ value: "monday", label: "Monday" }, { value: "sunday", label: "Sunday" }]} />
      </Field>
    </div>
  );
}
