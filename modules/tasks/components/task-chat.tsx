"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell as faBellRegular, faFile } from "@fortawesome/free-regular-svg-icons";
import { faBell, faPaperclip, faAt, faPaperPlane, faXmark, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { TaskActivityEntry, TaskMember } from "../types";
import { formatActivity } from "../lib/activity";
import { initials } from "../lib/bordio";
import { cn } from "@/lib/utils";

interface ChatFile { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; url: string | null }
interface ChatMessage { id: string; body: string; author: TaskMember | null; created_at: string; attachments?: ChatFile[] }

type Item =
  | { kind: "message"; at: string; msg: ChatMessage }
  | { kind: "activity"; at: string; entry: TaskActivityEntry };

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

function Avatar({ m, size = 28 }: { m: TaskMember | null; size?: number }) {
  return m?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground" style={{ width: size, height: size }}>
      {initials(m?.full_name)}
    </span>
  );
}

/** Highlights @Full Name mentions of workspace members. */
function renderBody(body: string, members: TaskMember[]) {
  if (!body.includes("@")) return body;
  const names = members.map((m) => m.full_name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return body;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "gi");
  const lower = new Set(names.map((n) => `@${n.toLowerCase()}`));
  return body.split(re).map((part, i) => (lower.has(part.toLowerCase()) ? <span key={i} className="font-medium text-sky-500">{part}</span> : <Fragment key={i}>{part}</Fragment>));
}

/** Bordio task chat: followers, chronological messages + activity, composer with files, emoji and @mentions. */
export function TaskChat({ taskId, members, currentUserId, refreshKey }: {
  taskId: string; members: TaskMember[]; currentUserId: string | null; refreshKey?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, TaskMember>>({});
  const [watchers, setWatchers] = useState<TaskMember[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const [c, a, w] = await Promise.all([
      fetch(`/api/tasks/${taskId}/comments`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/tasks/${taskId}/activity`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/tasks/${taskId}/watchers`).then((r) => r.json()).catch(() => ({})),
    ]);
    setMessages(c.comments ?? []);
    setActivity(a.activity ?? []);
    setProfiles(a.profiles ?? {});
    setWatchers(w.watchers ?? []);
  }, [taskId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  // Light polling so conversations feel live while the task is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/tasks/${taskId}/comments`).then((r) => r.json()).then((c) => setMessages((prev) => (c.comments?.length !== prev.length ? c.comments : prev))).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [taskId]);

  const items = useMemo<Item[]>(() => [
    ...messages.map((msg) => ({ kind: "message" as const, at: msg.created_at, msg })),
    ...activity.filter((e) => e.action !== "created").map((entry) => ({ kind: "activity" as const, at: entry.created_at, entry })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [messages, activity]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [items.length]);

  const following = !!currentUserId && watchers.some((w) => w.id === currentUserId);

  async function toggleFollow() {
    const res = await fetch(`/api/tasks/${taskId}/watchers`, { method: following ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const json = await res.json();
    if (res.ok) setWatchers(json.watchers ?? []);
  }

  async function upload(list: FileList) {
    const arr = Array.from(list);
    if (arr.some((f) => f.size > 25 * 1024 * 1024)) { toast.error("Files must be under 25 MB"); return; }
    setUploading(true);
    const form = new FormData();
    arr.forEach((f) => form.append("file", f));
    const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { toast.error(json.error ?? "Upload failed"); return; }
    setFiles((f) => [...f, ...(json.attachments ?? []).map((a: ChatFile) => ({ ...a, url: null }))]);
  }

  async function send() {
    if ((!text.trim() && !files.length) || sending) return;
    setSending(true);
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text.trim(), attachment_ids: files.map((f) => f.id) }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { toast.error(json.error ?? "Could not send"); return; }
    setMessages((m) => [...m, json.comment]);
    setText("");
    setFiles([]);
  }

  function onChangeText(v: string) {
    setText(v);
    const caret = inputRef.current?.selectionStart ?? v.length;
    const m = /(?:^|\s)@([\w ]{0,20})$/.exec(v.slice(0, caret));
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }

  function insertMention(m: TaskMember) {
    const caret = inputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\w ]{0,20})$/, `@${m.full_name} `);
    setText(before + text.slice(caret));
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  const suggestions = mentionQuery === null ? [] : members.filter((m) => m.full_name.toLowerCase().includes(mentionQuery)).slice(0, 6);

  let lastDay = "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Followers */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button onClick={toggleFollow} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors", following ? "border-sky-500/40 text-sky-500" : "text-muted-foreground hover:text-foreground")}>
          <FontAwesomeIcon icon={following ? faBell : faBellRegular} className="h-3 w-3" />{following ? "Following" : "Follow"}
        </button>
        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground" title={watchers.map((w) => w.full_name).join(", ")}>
          {watchers.length} follower{watchers.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-3">
        {items.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">No messages yet. Start the conversation — type @ to mention someone.</p>}
        {items.map((it) => {
          const d = new Date(it.at);
          const day = d.toDateString();
          const sep = day !== lastDay ? (lastDay = day, <div className="flex justify-center py-1"><span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{dayLabel(d)}</span></div>) : null;
          if (it.kind === "activity") {
            return (
              <Fragment key={`a-${it.entry.id}`}>
                {sep}
                <p className="px-2 text-center text-[11px] text-muted-foreground">{formatActivity(it.entry, profiles)} <span className="opacity-70">{timeLabel(d)}</span></p>
              </Fragment>
            );
          }
          const mine = it.msg.author?.id === currentUserId;
          return (
            <Fragment key={`m-${it.msg.id}`}>
              {sep}
              <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
                <Avatar m={it.msg.author} />
                <div className={cn("max-w-[78%]", mine && "items-end text-right")}>
                  <p className="mb-0.5 text-[11px] text-muted-foreground">{mine ? "You" : it.msg.author?.full_name ?? "Unknown"}</p>
                  <div className={cn("inline-block rounded-xl px-3 py-2 text-left text-[13px] leading-snug", mine ? "bg-sky-600 text-white" : "bg-muted")}>
                    {(it.msg.attachments ?? []).map((f) => (
                      f.mime_type?.startsWith("image/") && f.url ? (
                        <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="mb-1.5 block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url} alt={f.file_name} className="max-h-48 rounded-lg object-cover" />
                        </a>
                      ) : (
                        <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-1.5 underline-offset-2 hover:underline">
                          <FontAwesomeIcon icon={faFile} className="h-3 w-3" />{f.file_name}
                        </a>
                      )
                    ))}
                    {it.msg.body && <span className="whitespace-pre-wrap break-words">{renderBody(it.msg.body, members)}</span>}
                    <span className={cn("ml-2 align-bottom text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>{timeLabel(d)}</span>
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="relative border-t p-3">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-3 mb-1 w-56 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {suggestions.map((m) => (
              <button key={m.id} onClick={() => insertMention(m)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                <Avatar m={m} size={20} />{m.full_name}
              </button>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                <FontAwesomeIcon icon={faFile} className="h-3 w-3" />{f.file_name}
                <button onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} aria-label="Remove"><FontAwesomeIcon icon={faXmark} className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="rounded-xl border bg-background focus-within:border-sky-500/60">
          <textarea
            ref={inputRef} rows={1} value={text} placeholder="Type a message…"
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !suggestions.length) { e.preventDefault(); send(); }
              if (e.key === "Escape") setMentionQuery(null);
            }}
            className="block max-h-32 min-h-[40px] w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] focus:outline-none"
          />
          <div className="flex items-center gap-1 px-2 pb-1.5 text-muted-foreground">
            <button title="Attach file" className="rounded p-1.5 hover:bg-muted hover:text-foreground" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FontAwesomeIcon icon={uploading ? faSpinner : faPaperclip} spin={uploading} className="h-3.5 w-3.5" />
            </button>
            <button title="Mention someone" className="rounded p-1.5 hover:bg-muted hover:text-foreground" onClick={() => { onChangeText(text + (text && !text.endsWith(" ") ? " @" : "@")); inputRef.current?.focus(); }}>
              <FontAwesomeIcon icon={faAt} className="h-3.5 w-3.5" />
            </button>
            <button title="Send" onClick={send} disabled={sending || (!text.trim() && !files.length)}
              className="ml-auto rounded-full p-1.5 text-sky-500 hover:bg-sky-500/10 disabled:opacity-40">
              <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}
