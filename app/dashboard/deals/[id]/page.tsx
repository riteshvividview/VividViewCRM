"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Clock, Calendar, MapPin, User, DollarSign, FileText,
  Upload, MessageSquare, CheckCircle, XCircle, Edit2, Save, X, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MOCK_DEALS } from "@/modules/deals/hooks/use-deals";
import { DEAL_STAGES, DEAL_LOCATIONS, LOCATION_CONFIG, STAGE_CONFIG, type Deal, type DealStage, type DealLocation } from "@/modules/deals/types";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";

type ActivityType = "note" | "status_change" | "file_upload";
interface Activity {
  id: string; type: ActivityType; content: string; author: string; time: string;
}

const MOCK_ACTIVITIES: Activity[] = [
  { id: "a1", type: "status_change", content: "Deal moved to Samples Sent from Av. Leads", author: "Alex Kumar", time: "2 days ago" },
  { id: "a2", type: "note", content: "Client confirmed interest in the enterprise package. Follow up needed by end of week.", author: "Priya Singh", time: "1 day ago" },
  { id: "a3", type: "file_upload", content: "proposal-q2-2026.pdf", author: "Alex Kumar", time: "5 hours ago" },
];

function ActivityIcon({ type }: { type: ActivityType }) {
  if (type === "status_change") return <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center"><CheckCircle className="h-3.5 w-3.5 text-purple-600" /></div>;
  if (type === "file_upload") return <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center"><Paperclip className="h-3.5 w-3.5 text-blue-600" /></div>;
  return <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><MessageSquare className="h-3.5 w-3.5 text-slate-600" /></div>;
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
  const [newNote, setNewNote] = useState("");
  const [isDroppingFile, setIsDroppingFile] = useState(false);
  const [wonLostModal, setWonLostModal] = useState<"won" | "lost" | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setLoading(true);
    const found = MOCK_DEALS.find((d) => d.id === id);
    if (found) { setDeal(found); setTitle(found.title); setNotes(found.notes ?? ""); }
    setLoading(false);
  }, [id]);

  const updateField = useCallback((key: keyof Deal, value: unknown) => {
    setDeal((prev) => prev ? { ...prev, [key]: value } : prev);
    toast.success("Updated");
  }, []);

  function addNote() {
    if (!newNote.trim()) return;
    setActivities((prev) => [{ id: Date.now().toString(), type: "note", content: newNote, author: "You", time: "Just now" }, ...prev]);
    setNewNote("");
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDroppingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setActivities((prev) => [{ id: Date.now().toString(), type: "file_upload", content: file.name, author: "You", time: "Just now" }, ...prev]);
      toast.success(`${file.name} uploaded`);
    }
  }

  function handleWonLost() {
    if (!wonLostModal) return;
    updateField("stage", wonLostModal === "won" ? "Sales" : "Av. Leads");
    setActivities((prev) => [{ id: Date.now().toString(), type: "status_change", content: `Deal marked as ${wonLostModal === "won" ? "Won" : "Lost"}${reason ? `: ${reason}` : ""}`, author: "You", time: "Just now" }, ...prev]);
    setWonLostModal(null);
    setReason("");
    toast.success(wonLostModal === "won" ? "Deal won!" : "Deal marked as lost");
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>;
  if (!deal) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Deal not found. <Link href="/dashboard/deals" className="ml-2 text-purple-600">Go back</Link></div>;

  const locCfg = deal.location ? LOCATION_CONFIG[deal.location] : LOCATION_CONFIG.Other;
  const stageCfg = STAGE_CONFIG[deal.stage];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 h-8" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />Back to Deals
        </Button>
      </div>

      {/* Title block */}
      <div className="mb-6">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="text-2xl font-bold bg-transparent border-b-2 border-purple-400 outline-none flex-1 pb-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { updateField("title", title); setEditingTitle(false); } if (e.key === "Escape") { setTitle(deal.title); setEditingTitle(false); } }}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { updateField("title", title); setEditingTitle(false); }}><Save className="h-4 w-4 text-emerald-600" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setTitle(deal.title); setEditingTitle(false); }}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingTitle(true)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", stageCfg.bg, stageCfg.color)}>{deal.stage}</span>
          {deal.location && <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", locCfg.bg, locCfg.color, locCfg.border)}>{deal.location}</span>}
          <span className="text-xs text-muted-foreground">Created {formatDate(deal.created_at)}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-6">
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setWonLostModal("won")}>
          <CheckCircle className="h-3.5 w-3.5" />Mark Won
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setWonLostModal("lost")}>
          <XCircle className="h-3.5 w-3.5" />Mark Lost
        </Button>
      </div>

      {/* Won/Lost reason modal */}
      {wonLostModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold mb-3">{wonLostModal === "won" ? "Mark as Won" : "Mark as Lost"}</h3>
            <label className="text-sm text-muted-foreground">Reason (optional)</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={wonLostModal === "won" ? "What closed the deal?" : "Why was this lost?"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setWonLostModal(null)}>Cancel</Button>
              <Button className={cn("flex-1 text-white", wonLostModal === "won" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90")} onClick={handleWonLost}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Notes */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><FileText className="h-4 w-4 text-purple-600" />Notes</h2>
              {!editingNotes && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNotes(true)}>Edit</Button>}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring min-h-[120px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this deal…"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white" onClick={() => { updateField("notes", notes); setEditingNotes(false); }}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => { setNotes(deal.notes ?? ""); setEditingNotes(false); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground min-h-[48px] cursor-pointer hover:text-foreground transition-colors" onClick={() => setEditingNotes(true)}>
                {notes || <span className="italic opacity-50">Click to add notes…</span>}
              </p>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-purple-600" />Activity
            </h2>

            {/* Add note */}
            <div className="flex gap-2 mb-5">
              <textarea
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                placeholder="Add a note or comment…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
              />
              <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white self-end" onClick={addNote}>Post</Button>
            </div>

            <div className="space-y-4">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <ActivityIcon type={act.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{act.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{act.author} · {act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Files */}
          <div
            className={cn("bg-card border-2 border-dashed border-border rounded-xl p-5 transition-colors", isDroppingFile && "border-purple-500 bg-purple-50/30")}
            onDragOver={(e) => { e.preventDefault(); setIsDroppingFile(true); }}
            onDragLeave={() => setIsDroppingFile(false)}
            onDrop={handleFileDrop}
          >
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Paperclip className="h-4 w-4 text-purple-600" />Files
            </h2>
            {isDroppingFile ? (
              <div className="text-center py-4 text-sm text-purple-600 font-medium">Drop to upload</div>
            ) : (
              <div className="space-y-2">
                {activities.filter((a) => a.type === "file_upload").map((a) => (
                  <div key={a.id} className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground flex-1">{a.content}</span>
                    <span className="text-xs text-muted-foreground">{a.time}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                  <Upload className="h-3.5 w-3.5" />Drag files here to upload
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: deal properties */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Deal Properties</h2>

            <PropertyRow icon={DollarSign} label="Value">
              <span className="text-sm font-bold text-foreground">{formatCurrency(deal.value, "INR")}</span>
            </PropertyRow>

            <PropertyRow icon={CheckCircle} label="Stage">
              <Select value={deal.stage} onValueChange={(v) => updateField("stage", v as DealStage)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow icon={MapPin} label="Location">
              <Select value={deal.location ?? ""} onValueChange={(v) => updateField("location", v as DealLocation)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{DEAL_LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow icon={User} label="Assigned">
              <span className="text-sm text-foreground">{deal.assigned_name || "—"}</span>
            </PropertyRow>

            <PropertyRow icon={Calendar} label="Close Date">
              <span className="text-sm text-foreground">{deal.close_date ? formatDate(deal.close_date) : "—"}</span>
            </PropertyRow>

            <PropertyRow icon={Clock} label="Days in Stage">
              <span className="text-sm text-foreground font-medium">{deal.days_in_stage} days</span>
            </PropertyRow>
          </div>

          {/* Linked contact */}
          {deal.contact_name && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contact</h2>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-semibold">{getInitials(deal.contact_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{deal.contact_name}</p>
                  {deal.company && <p className="text-xs text-muted-foreground">{deal.company}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      {children}
    </div>
  );
}
