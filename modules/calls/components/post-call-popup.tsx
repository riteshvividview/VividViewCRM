"use client";

import { useState } from "react";
import { Phone, Clock, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CallOutcome } from "../types";
import { formatDuration } from "../types";
import { cn } from "@/lib/utils";

interface PostCallPopupProps {
  phoneNumber: string;
  duration: number;
  onSave: (data: {
    contact_name: string;
    outcome: CallOutcome;
    notes: string;
    follow_up_date?: string;
  }) => void;
  onDismiss: () => void;
}

const OUTCOME_OPTIONS: { value: CallOutcome; label: string; color: string }[] = [
  { value: "answered",  label: "Answered",  color: "text-emerald-600" },
  { value: "voicemail", label: "Voicemail", color: "text-blue-600" },
  { value: "no_answer", label: "No Answer", color: "text-amber-600" },
  { value: "busy",      label: "Busy",      color: "text-red-600" },
];

export function PostCallPopup({ phoneNumber, duration, onSave, onDismiss }: PostCallPopupProps) {
  const [contactName, setContactName] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [addFollowUp, setAddFollowUp] = useState(false);

  function handleSave() {
    onSave({
      contact_name: contactName || phoneNumber,
      outcome,
      notes,
      follow_up_date: addFollowUp ? followUpDate : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
              <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Log Call</p>
              <p className="text-xs text-muted-foreground">{phoneNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {duration > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />{formatDuration(duration)}
              </span>
            )}
            <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
            <Input
              className="mt-1 h-9 text-sm"
              placeholder="Search or enter name…"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Outcome</label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as CallOutcome)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={cn("font-medium", o.color)}>{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Call Notes</label>
            <Textarea
              className="mt-1 text-sm resize-none"
              rows={3}
              placeholder="What was discussed? Next steps?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Follow-up task */}
          <div>
            <button
              onClick={() => setAddFollowUp((v) => !v)}
              className={cn(
                "flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2 border transition-colors w-full",
                addFollowUp
                  ? "bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {addFollowUp ? "Follow-up task added" : "Add follow-up task"}
            </button>
            {addFollowUp && (
              <div className="mt-2">
                <label className="text-xs text-muted-foreground">Follow-up Date</label>
                <Input
                  type="datetime-local"
                  className="mt-1 h-9 text-sm"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1 h-9" onClick={onDismiss}>Skip</Button>
          <Button
            className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleSave}
          >
            Save Log
          </Button>
        </div>
      </div>
    </div>
  );
}
