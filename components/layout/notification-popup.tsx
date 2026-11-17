"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment } from "@fortawesome/free-regular-svg-icons";
import { faXmark, faPaperPlane, faCheck, faSpinner, faBell, faPaperclip } from "@fortawesome/free-solid-svg-icons";
import { attachmentLabel, parseNotificationBody } from "@/modules/notifications/body";
import { toast } from "sonner";
import type { Notification } from "@/modules/notifications/types";

/** A short two-note chime, generated in the browser (no audio file to load). */
export function playNotificationSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const note = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    };
    note(880, 0);
    note(1174.66, 0.14);
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    // Browsers block sound until the user has clicked somewhere on the page; nothing to do then.
  }
}

export const isTaskMessage = (n: Notification) => n.entity_type === "task_message" && !!n.entity_id;

/** Popup for one new notification. Chat messages can be answered right from it. */
export function NotificationPopup({ n, toastId, onRead, onOpen }: { n: Notification; toastId: string | number; onRead: () => void; onOpen: () => void }) {
  const message = isTaskMessage(n);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const close = () => toast.dismiss(toastId);
  const { text, attachments } = parseNotificationBody(n.body);

  async function send() {
    if (!reply.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/tasks/${n.entity_id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply.trim() }),
    });
    setSending(false);
    if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? "Could not send reply"); return; }
    onRead();
    close();
    toast.success("Reply sent");
  }

  return (
    <div className="w-[356px] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FontAwesomeIcon icon={message ? faComment : faBell} className="h-3.5 w-3.5" />
        </span>
        <button type="button" onClick={() => { onOpen(); close(); }} className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug">{n.title}</p>
          {text && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{text}</p>}
          {attachments && (
            <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
              <FontAwesomeIcon icon={faPaperclip} className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="truncate">{attachmentLabel(attachments)}</span>
            </span>
          )}
        </button>
        <button type="button" onClick={close} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" /></button>
      </div>

      {message && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:ring-1 focus-within:ring-ring">
          <input
            value={reply} placeholder="Reply…" maxLength={5000}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") send(); }}
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none"
          />
          <button type="button" onClick={send} disabled={!reply.trim() || sending} aria-label="Send reply" className="rounded p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40">
            <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} spin={sending} className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-1">
        <button type="button" onClick={() => { onRead(); close(); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />Mark as read
        </button>
        <button type="button" onClick={() => { onOpen(); close(); }} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
          {n.entity_id ? "Open task" : "Open"}
        </button>
      </div>
    </div>
  );
}
