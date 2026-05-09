"use client";

import { useState } from "react";
import { Phone, Mail, Calendar, FileText, Link2, MessageSquare, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContactActivity } from "../types";
import { formatDate, getInitials } from "@/lib/utils";

const TYPE_CONFIG = {
  call:    { icon: Phone,       color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  email:   { icon: Mail,        color: "text-amber-500",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  meeting: { icon: Calendar,    color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
  note:    { icon: MessageSquare, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" },
  deal:    { icon: Link2,       color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  file:    { icon: FileText,    color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30" },
};

interface ContactActivityProps {
  activities: ContactActivity[];
  onAddNote: (content: string) => void;
}

export function ContactActivityFeed({ activities, onAddNote }: ContactActivityProps) {
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  function handleSubmit() {
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      {adding ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Write a note…"
            className="text-sm resize-none"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSubmit} disabled={!note.trim()}>
              Save note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNote(""); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />Add note
        </Button>
      )}

      {/* Timeline */}
      <div className="relative">
        {activities.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />}
        <div className="space-y-4">
          {activities.map((a) => {
            const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.note;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className="flex gap-3 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${cfg.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] bg-muted">{getInitials(a.created_by ?? "?")}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{a.created_by ?? "Unknown"}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{a.content}</p>
                </div>
              </div>
            );
          })}
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
