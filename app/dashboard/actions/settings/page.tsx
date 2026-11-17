"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBroom, faBell, faUserShield, faTrashCan, faSpinner, faLock, faCloud, faDatabase, faCircleCheck, faEye, faEyeSlash, faUserPen,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { FILE_SECTIONS } from "@/modules/tasks/components/task-files";
import { formatFileSize } from "@/modules/tasks/lib/upload";
import { cn } from "@/lib/utils";

type HrAccess = "full" | "view" | "hidden";
type DeleteRule = "creator" | "leads";
interface Settings { retention_enabled: boolean; retention_days: number; last_cleanup_at: string | null; hr_access: HrAccess; delete_rule: DeleteRule; notif_read_days: number; notif_unread_days: number; trash_days: number }
interface Amount { files: number; bytes: number }
interface Payload { settings: Settings; storage: Record<string, Amount>; removed: number; cleanup: { due: Amount; all: Amount }; cloudflare: boolean }

const DAY_PRESETS = [15, 30, 60, 90, 180];
const amount = (a: Amount) => (a.files ? `${a.files} file${a.files === 1 ? "" : "s"} · ${formatFileSize(a.bytes) || "0 B"}` : "nothing");

function Card({ icon, title, hint, children }: { icon: IconDefinition; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FontAwesomeIcon icon={icon} className="h-4 w-4" /></span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; title: string; hint: string; icon: IconDefinition }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("rounded-xl border p-3.5 text-left transition-colors", value === o.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/30 hover:bg-muted/40")}>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FontAwesomeIcon icon={o.icon} className={cn("h-3.5 w-3.5", value === o.value ? "text-primary" : "text-muted-foreground")} />{o.title}
            {value === o.value && <FontAwesomeIcon icon={faCircleCheck} className="ml-auto h-3.5 w-3.5 text-primary" />}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{o.hint}</p>
        </button>
      ))}
    </div>
  );
}

/** Task Management settings. Only the CEO can open and change these. */
export default function TaskSettingsPage() {
  const isCeo = useShellProfile()?.role === "super_admin";
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState("30");
  const [confirm, setConfirm] = useState<"due" | "all" | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks/settings");
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.settings) { setData(json); setDays(String(json.settings.retention_days)); }
  }, []);
  useEffect(() => { if (isCeo) load(); }, [isCeo, load]);

  async function save(patch: Partial<Settings>) {
    if (!data) return;
    const before = data;
    setData({ ...data, settings: { ...data.settings, ...patch } });
    const res = await fetch("/api/tasks/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setData(before); setDays(String(before.settings.retention_days)); toast.error(json.error ?? "Could not save"); return; }
    toast.success("Saved");
    load();
  }

  async function cleanup(scope: "due" | "all") {
    setRunning(true);
    const res = await fetch("/api/tasks/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope }) });
    const json = await res.json().catch(() => ({}));
    setRunning(false);
    setConfirm(null);
    if (!res.ok) { toast.error(json.error ?? "Cleanup failed"); return; }
    const parts = [json.removed && `${json.removed} file${json.removed === 1 ? "" : "s"}`, json.notifications && `${json.notifications} old notification${json.notifications === 1 ? "" : "s"}`].filter(Boolean);
    toast.success(parts.length ? `Removed ${parts.join(" and ")}` : "Nothing to remove");
    load();
  }

  if (!isCeo) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <FontAwesomeIcon icon={faLock} className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-medium">Only the CEO can open task settings</p>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-24"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>;

  const s = data.settings;
  const commitDays = () => {
    const n = Math.round(Number(days));
    if (!Number.isFinite(n) || n < 1 || n > 3650) { toast.error("Enter a number of days between 1 and 3650"); setDays(String(s.retention_days)); return; }
    if (n !== s.retention_days) save({ retention_days: n });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Task settings</h1>
        <p className="text-sm text-muted-foreground">Only you (the CEO) can see and change these. Changes apply to everyone straight away.</p>
      </div>

      <Card icon={faBroom} title="Automatic file cleanup" hint="Removes reference files and chat media once a task is completed and has its main file. Briefs, main files, chat text and activity logs are never removed.">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Clean up automatically</p>
            <p className="text-xs text-muted-foreground">{s.retention_enabled ? `On. Files are removed ${s.retention_days} days after their task is completed.` : "Off. Nothing is removed unless you run a cleanup yourself."}</p>
          </div>
          <Toggle checked={s.retention_enabled} onChange={(v) => save({ retention_enabled: v })} label="Clean up automatically" />
        </div>

        <div className={cn("mt-4", !s.retention_enabled && "opacity-50")}>
          <p className="mb-2 text-sm font-medium">Remove files after</p>
          <div className="flex flex-wrap items-center gap-2">
            {DAY_PRESETS.map((d) => (
              <button key={d} type="button" disabled={!s.retention_enabled} onClick={() => { setDays(String(d)); if (d !== s.retention_days) save({ retention_days: d }); }}
                className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-medium", s.retention_days === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {d} days
              </button>
            ))}
            <label className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px]">
              Custom
              <input type="number" min={1} max={3650} value={days} disabled={!s.retention_enabled} onChange={(e) => setDays(e.target.value)} onBlur={commitDays}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="w-16 bg-transparent text-right font-medium focus:outline-none" />
              days
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
          <Button variant="outline" size="sm" onClick={() => setConfirm("due")}><FontAwesomeIcon icon={faBroom} className="mr-2 h-3.5 w-3.5" />Run cleanup now</Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600" onClick={() => setConfirm("all")}>
            <FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Clean all completed tasks now
          </Button>
          <span className="text-xs text-muted-foreground">
            Last manual cleanup: {s.last_cleanup_at ? new Date(s.last_cleanup_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}
          </span>
        </div>
      </Card>

      <Card icon={faDatabase} title="Storage in use" hint="What the task files take up right now.">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["brief", "main", "reference"] as const).map((k) => (
            <div key={k} className="rounded-xl border p-3.5">
              <p className={cn("flex items-center gap-2 text-xs font-medium", FILE_SECTIONS[k].accent)}><FontAwesomeIcon icon={FILE_SECTIONS[k].icon} className="h-3 w-3" />{FILE_SECTIONS[k].title}</p>
              <p className="mt-1.5 text-lg font-semibold">{formatFileSize(data.storage[k]?.bytes ?? 0) || "0 B"}</p>
              <p className="text-xs text-muted-foreground">{data.storage[k]?.files ?? 0} files · {k === "reference" ? "cleaned up" : "kept forever"}</p>
            </div>
          ))}
          <div className="rounded-xl border p-3.5">
            <p className="text-xs font-medium text-muted-foreground">Chat media</p>
            <p className="mt-1.5 text-lg font-semibold">{formatFileSize(data.storage.chat?.bytes ?? 0) || "0 B"}</p>
            <p className="text-xs text-muted-foreground">{data.storage.chat?.files ?? 0} files · cleaned up</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <FontAwesomeIcon icon={faCloud} className="h-3 w-3" />
          {data.cloudflare ? "New files are stored in Cloudflare R2." : "Cloudflare R2 is not connected yet, so files are stored in Supabase (25 MB per file)."}
          {data.removed > 0 && ` ${data.removed} file${data.removed === 1 ? " has" : "s have"} been removed by cleanup so far.`}
        </p>
      </Card>

      <Card icon={faBell} title="Notification cleanup" hint="Old notifications are removed from everyone's bell automatically. Tasks, chat and activity are not affected.">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["notif_read_days", "Read notifications", "Removed this long after they were read.", [7, 15, 30, 60]],
            ["notif_unread_days", "Unread notifications", "Removed this long after they arrived.", [30, 60, 90, 180]],
          ] as const).map(([key, label, help, presets]) => (
            <div key={key} className="rounded-xl border p-4">
              <p className="text-sm font-medium">{label}</p>
              <p className="mb-3 text-xs text-muted-foreground">{help}</p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((d) => (
                  <button key={d} type="button" onClick={() => d !== s[key] && save({ [key]: d } as Partial<Settings>)}
                    className={cn("rounded-full border px-3 py-1 text-[13px] font-medium", s[key] === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {d} days
                  </button>
                ))}
                {!(presets as readonly number[]).includes(s[key]) && <span className="rounded-full border border-primary bg-primary px-3 py-1 text-[13px] font-medium text-primary-foreground">{s[key]} days</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">When a task is deleted, its notifications are removed straight away and only the &quot;deleted a task&quot; notice is kept. &quot;Run cleanup now&quot; above also clears old notifications.</p>
      </Card>

      <div id="trash" className="scroll-mt-4">
        <Card icon={faTrashCan} title="Deleted tasks" hint="A deleted task goes to the trash with its files and chat. You can restore it until it is removed for good.">
          <p className="mb-2 text-sm font-medium">Keep deleted tasks for</p>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 15, 30, 60].map((d) => (
              <button key={d} type="button" onClick={() => d !== s.trash_days && save({ trash_days: d })}
                className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-medium", s.trash_days === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {d} days
              </button>
            ))}
            {![7, 15, 30, 60].includes(s.trash_days) && <span className="rounded-full border border-primary bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground">{s.trash_days} days</span>}
            <Link href="/dashboard/actions/trash" className="ml-auto text-sm font-medium text-primary hover:underline">Open trash</Link>
          </div>
        </Card>
      </div>

      <Card icon={faUserShield} title="HR access to Tasks" hint="Decide what people with the HR role can do in Task Management.">
        <Choice<HrAccess> value={s.hr_access} onChange={(v) => v !== s.hr_access && save({ hr_access: v })} options={[
          { value: "hidden", title: "No access", hint: "The Tasks app is not shown to HR at all.", icon: faEyeSlash },
          { value: "view", title: "View only", hint: "HR can open and read tasks but cannot create or change anything.", icon: faEye },
          { value: "full", title: "Full access", hint: "HR can create, assign and work on tasks like an employee.", icon: faUserPen },
        ]} />
      </Card>

      <Card icon={faTrashCan} title="Who can delete tasks" hint="A deleted task goes to the trash first; removing it for good also removes its files.">
        <Choice<DeleteRule> value={s.delete_rule} onChange={(v) => v !== s.delete_rule && save({ delete_rule: v })} options={[
          { value: "creator", title: "Creator and leads", hint: "The person who created the task, team leads and the CEO.", icon: faUserPen },
          { value: "leads", title: "Leads only", hint: "Only team leads and the CEO. Employees cannot delete tasks.", icon: faUserShield },
        ]} />
      </Card>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && !running && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{confirm === "all" ? "Clean all completed tasks now?" : "Run cleanup now?"}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              {confirm === "all"
                ? "This removes reference files and chat media from every completed task that has a main file, without waiting."
                : `This removes reference files and chat media from tasks completed more than ${s.retention_days} days ago.`}
            </p>
            <p className="rounded-lg bg-muted px-3 py-2 font-medium">Will be removed: {amount(confirm === "all" ? data.cleanup.all : data.cleanup.due)}</p>
            <p className="text-muted-foreground">Removed files cannot be recovered. Briefs, main files and all text stay.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={running} onClick={() => setConfirm(null)}>Cancel</Button>
            <Button disabled={running} className={confirm === "all" ? "bg-red-600 text-white hover:bg-red-700" : ""} onClick={() => confirm && cleanup(confirm)}>
              {running && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Remove files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
