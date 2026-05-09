"use client";

import { useState } from "react";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, Search, Filter, StickyNote
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCalls } from "@/modules/calls/hooks/use-calls";
import { DialPad } from "@/modules/calls/components/dial-pad";
import { PostCallPopup } from "@/modules/calls/components/post-call-popup";
import type { CallLog, CallOutcome } from "@/modules/calls/types";
import { OUTCOME_CONFIG, formatDuration } from "@/modules/calls/types";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DirectionIcon({ direction }: { direction: CallLog["direction"] }) {
  if (direction === "inbound") return <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />;
  return <PhoneOutgoing className="h-3.5 w-3.5 text-emerald-500" />;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Call Log Row ──────────────────────────────────────────────────────────────
function CallRow({ call, onClick, selected }: { call: CallLog; onClick: () => void; selected: boolean }) {
  const cfg = OUTCOME_CONFIG[call.outcome];
  const isMissed = call.outcome === "no_answer" || call.outcome === "busy";
  return (
    <tr
      onClick={onClick}
      className={cn("cursor-pointer transition-colors", selected ? "bg-purple-50 dark:bg-purple-950/20" : "hover:bg-muted/30")}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(call.contact_name))}>
            {getInitials(call.contact_name)}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{call.contact_name}</p>
            <p className="text-xs text-muted-foreground">{call.phone_number}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <DirectionIcon direction={call.direction} />
          <span className="text-xs text-muted-foreground capitalize">{call.direction}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
          {isMissed && <PhoneMissed className="h-3 w-3" />}
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {call.duration > 0 ? formatDuration(call.duration) : "—"}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{call.created_by ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(call.created_at)}</td>
      <td className="px-4 py-3">
        {call.notes && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            <span className="truncate max-w-[160px]">{call.notes}</span>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Call Detail Panel ─────────────────────────────────────────────────────────
function CallDetail({ call, onClose }: { call: CallLog; onClose: () => void }) {
  const cfg = OUTCOME_CONFIG[call.outcome];
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold", avatarColor(call.contact_name))}>
            {getInitials(call.contact_name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{call.contact_name}</p>
            <p className="text-xs text-muted-foreground">{call.phone_number}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Close</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Direction", value: <span className="capitalize flex items-center gap-1"><DirectionIcon direction={call.direction} />{call.direction}</span> },
          { label: "Outcome",   value: <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>{cfg.label}</span> },
          { label: "Duration",  value: call.duration > 0 ? formatDuration(call.duration) : "—" },
          { label: "Agent",     value: call.created_by ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <div className="text-sm text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {call.notes && (
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{call.notes}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        {new Date(call.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CallsPage() {
  const { calls, loading, addCall, updateCall } = useCalls();
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [pendingCall, setPendingCall] = useState<{ phone: string; duration: number } | null>(null);

  const filtered = calls.filter((c) => {
    const matchSearch = !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search);
    const matchDir = dirFilter === "all" || c.direction === dirFilter;
    return matchSearch && matchDir;
  });

  const totalCalls = calls.length;
  const answered = calls.filter((c) => c.outcome === "answered").length;
  const avgDuration = calls.filter((c) => c.duration > 0).reduce((s, c, _, a) => s + c.duration / a.length, 0);
  const missed = calls.filter((c) => c.outcome === "no_answer" || c.outcome === "busy").length;

  function handleCallEnd(phone: string, duration: number) {
    setPendingCall({ phone, duration });
  }

  function handlePostCallSave(data: { contact_name: string; outcome: CallOutcome; notes: string; follow_up_date?: string }) {
    if (!pendingCall) return;
    addCall({
      contact_name: data.contact_name,
      phone_number: pendingCall.phone,
      duration: pendingCall.duration,
      direction: "outbound",
      outcome: data.outcome,
      notes: data.notes,
    });
    setPendingCall(null);
  }

  return (
    <div className="p-6 space-y-5">
      {pendingCall && (
        <PostCallPopup
          phoneNumber={pendingCall.phone}
          duration={pendingCall.duration}
          onSave={handlePostCallSave}
          onDismiss={() => setPendingCall(null)}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Click-to-Call</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Dial contacts and manage your call history</p>
      </div>

      {/* Main layout */}
      <div className="flex gap-5 items-start">
        {/* Dial pad */}
        <div className="shrink-0">
          <DialPad onCallEnd={handleCallEnd} />
        </div>

        {/* Right: stats + log */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard icon={Phone}         label="Total Calls"   value={totalCalls}                    color="bg-slate-500" />
            <StatCard icon={PhoneOutgoing} label="Answered"      value={answered}                      color="bg-emerald-600" />
            <StatCard icon={Clock}         label="Avg Duration"  value={formatDuration(Math.round(avgDuration))} color="bg-purple-600" />
            <StatCard icon={PhoneMissed}   label="Missed"        value={missed}                        color="bg-red-500" />
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-9 h-9 text-sm" placeholder="Search calls…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground self-center" />
              {(["all", "inbound", "outbound"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirFilter(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                    dirFilter === d ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Two-column: table + detail */}
          <div className="flex gap-4">
            <div className={cn("rounded-xl border border-border overflow-hidden", selectedCall ? "flex-1" : "w-full")}>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      {["Contact", "Direction", "Outcome", "Duration", "Agent", "Time", "Notes"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          No calls found
                        </td>
                      </tr>
                    ) : filtered.map((c) => (
                      <CallRow
                        key={c.id}
                        call={c}
                        selected={selectedCall?.id === c.id}
                        onClick={() => setSelectedCall(selectedCall?.id === c.id ? null : c)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {selectedCall && (
              <div className="w-72 shrink-0">
                <CallDetail call={selectedCall} onClose={() => setSelectedCall(null)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
