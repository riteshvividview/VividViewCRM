"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faMagnifyingGlass, faSpinner, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_COLORS, type TaskMember, type TaskTeam } from "../types";
import { initials } from "../lib/bordio";
import { cn } from "@/lib/utils";

/** Create or edit a team: name, colour and who is in it. CEO and team leads only. */
export function TeamDialog({ open, team, members, onClose, onSaved, onDeleted }: {
  open: boolean;
  /** The team being edited, or null to create a new one. */
  team: TaskTeam | null;
  members: TaskMember[];
  onClose: () => void;
  onSaved: (team: TaskTeam) => void;
  onDeleted?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TASK_COLORS[6]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? "");
    setColor(team?.color ?? TASK_COLORS[6]);
    setMemberIds(team?.member_ids ?? []);
    setQuery("");
  }, [open, team]);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await fetch(team ? `/api/tasks/teams/${team.id}` : "/api/tasks/teams", {
      method: team ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, member_ids: memberIds }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(json.error ?? "Could not save the team"); return; }
    toast.success(team ? "Team updated" : "Team created");
    onSaved(json.team);
  }

  async function remove() {
    if (!team || busy) return;
    if (!window.confirm(`Delete the team "${team.name}"? Completed tasks are kept and become visible to everyone. A team with open tasks cannot be deleted.`)) return;
    setBusy(true);
    const res = await fetch(`/api/tasks/teams/${team.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? "Could not delete the team"); return; }
    toast.success("Team deleted");
    onDeleted?.(team.id);
  }

  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => m.full_name.toLowerCase().includes(q));
  const toggle = (id: string) => setMemberIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{team ? "Edit team" : "New team"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Input autoFocus placeholder="Team name, e.g. Design Team" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          <div className="flex gap-1.5">
            {TASK_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`}
                className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Members <span className="font-normal text-muted-foreground">({memberIds.length} selected)</span></p>
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-3">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3 w-3 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {shown.map((m) => {
                  const on = memberIds.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                        {on && <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />}
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{initials(m.full_name)}</span>
                      <span className="truncate">{m.full_name}</span>
                    </button>
                  );
                })}
                {shown.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No one found.</p>}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Tasks created in this team are only seen by these people, team leads and the CEO.</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {team ? (
            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-600" disabled={busy} onClick={remove}>
              <FontAwesomeIcon icon={faTrashCan} className="mr-2 h-3.5 w-3.5" />Delete team
            </Button>
          ) : <span />}
          <span className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={save} disabled={!name.trim() || busy}>
              {busy && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}{team ? "Save" : "Create team"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
