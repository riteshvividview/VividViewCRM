"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AssigneeAvatar } from "./assignee-picker";
import type { TaskMember } from "../types";
import { cn } from "@/lib/utils";

interface Message { id: string; author_id: string | null; author: TaskMember | null; body: string; created_at: string; mine: boolean }

/** Project chat with light polling (every 8s while visible). */
export function ProjectChat({ projectId, members, canModerate }: { projectId: string; members: TaskMember[]; canModerate: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);

  const load = useCallback(async (incremental: boolean) => {
    const qs = incremental && lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
    const res = await fetch(`/api/tasks/projects/${projectId}/messages${qs}`);
    if (!res.ok) return;
    const json = await res.json();
    const incoming: Message[] = json.messages ?? [];
    if (incoming.length) lastRef.current = incoming[incoming.length - 1].created_at;
    setMessages((m) => (incremental ? [...m, ...incoming.filter((x) => !m.some((y) => y.id === x.id))] : incoming));
  }, [projectId]);

  useEffect(() => {
    lastRef.current = null;
    load(false);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(true); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/tasks/projects/${projectId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (!res.ok) { toast.error((await res.json()).error ?? "Could not send"); return; }
    setText("");
    load(true);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/projects/${projectId}/messages?message_id=${id}`, { method: "DELETE" });
    if (res.ok) setMessages((m) => m.filter((x) => x.id !== id));
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="flex h-[65vh] flex-col rounded-xl border bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Start the conversation — use @Name to mention someone.</p>}
        {messages.map((m, i) => {
          const author = m.author ?? (m.author_id ? memberById.get(m.author_id) ?? null : null);
          const grouped = i > 0 && messages[i - 1].author_id === m.author_id &&
            new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() < 5 * 60_000;
          return (
            <div key={m.id} className={cn("group flex gap-2.5", grouped && "-mt-2")}>
              <div className="w-7 shrink-0">{!grouped && author && <AssigneeAvatar member={author} />}</div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="text-xs">
                    <span className="font-semibold">{author?.full_name ?? "Unknown"}</span>{" "}
                    <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </div>
              {(m.mine || canModerate) && (
                <button className="opacity-0 group-hover:opacity-60" onClick={() => remove(m.id)} aria-label="Delete message"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          rows={1} className="min-h-[40px] resize-none" placeholder="Message the project… (Enter to send, Shift+Enter for a new line)"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button size="icon" onClick={send} disabled={!text.trim() || sending}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
