"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faComments } from "@fortawesome/free-regular-svg-icons";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { faDownload, faPaperclip, faAt, faPaperPlane, faXmark, faSpinner, faCircle } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import type { TaskActivityEntry, TaskMember } from "../types";
import { formatActivity } from "../lib/activity";
import { initials } from "../lib/bordio";
import { formatFileSize, uploadTaskFile } from "../lib/upload";
import { fileIcon } from "./task-files";
import { createClient } from "@/lib/supabase/client";
import { formatMomentDay, formatTime } from "@/lib/user-prefs";
import { cn } from "@/lib/utils";

interface ChatFile { id: string; file_name: string; mime_type: string | null; size_bytes: number | null; url: string | null; download_url?: string | null; purged?: boolean }
interface ChatMessage { id: string; body: string; author: TaskMember | null; created_at: string; attachments?: ChatFile[] }

type Item =
  | { kind: "message"; at: string; msg: ChatMessage }
  | { kind: "activity"; at: string; entry: TaskActivityEntry };

// Chat times follow the date / time format and time zone chosen in Preferences.
const dayLabel = formatMomentDay;
const timeLabel = formatTime;

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

/** One file in a chat bubble: a small preview for media, a file card otherwise, always with a download button. */
function ChatAttachment({ f, mine }: { f: ChatFile; mine: boolean }) {
  if (f.purged) {
    return (
      <div className={cn("mb-1.5 flex w-56 max-w-full items-center gap-2.5 rounded-lg p-2 opacity-75", mine ? "bg-white/15" : "bg-background/70")} title="This file was attached, but it has been cleaned up">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", mine ? "bg-white/20" : "bg-muted")}><FontAwesomeIcon icon={faFile} className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium line-through">{f.file_name}</span>
          <span className="block text-[10px] opacity-80">Cleaned up, no longer available</span>
        </span>
      </div>
    );
  }
  const download = f.url && (
    <a href={f.download_url ?? f.url} title={`Download ${f.file_name}`} aria-label={`Download ${f.file_name}`} onClick={(e) => e.stopPropagation()}
      className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors", mine ? "bg-white/20 text-white hover:bg-white/35" : "bg-background text-foreground shadow-sm hover:bg-background/70")}>
      <FontAwesomeIcon icon={faDownload} className="h-3 w-3" />
    </a>
  );
  const isImage = f.mime_type?.startsWith("image/");
  const isVideo = f.mime_type?.startsWith("video/");
  if ((isImage || isVideo) && f.url) {
    return (
      <div className="mb-1.5 w-56 max-w-full overflow-hidden rounded-lg bg-black/10">
        {isImage ? (
          <a href={f.url} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.file_name} loading="lazy" className="h-36 w-full object-cover" />
          </a>
        ) : (
          <video src={f.url} controls preload="metadata" className="h-36 w-full bg-black object-contain" />
        )}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{f.file_name}</span>
            <span className="block text-[10px] opacity-70">{formatFileSize(f.size_bytes)}</span>
          </span>
          {download}
        </div>
      </div>
    );
  }
  if (f.mime_type?.startsWith("audio/") && f.url) {
    return (
      <div className="mb-1.5 w-56 max-w-full">
        <audio src={f.url} controls preload="metadata" className="h-9 w-full" />
        <div className="mt-1 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>{download}</div>
      </div>
    );
  }
  const ext = f.file_name.includes(".") ? f.file_name.split(".").pop()!.toUpperCase().slice(0, 5) : "FILE";
  return (
    <div className={cn("mb-1.5 flex w-56 max-w-full items-center gap-2.5 rounded-lg p-2", mine ? "bg-white/15" : "bg-background/70")}>
      <a href={f.url ?? "#"} target="_blank" rel="noreferrer" title="Open" className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md", mine ? "bg-white/20" : "bg-muted")}>
        <FontAwesomeIcon icon={fileIcon(f.mime_type)} className="h-4 w-4" />
        <span className="mt-0.5 text-[8px] font-semibold leading-none">{ext}</span>
      </a>
      <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium hover:underline">{f.file_name}</span>
        <span className="block text-[10px] opacity-70">{formatFileSize(f.size_bytes)}</span>
      </a>
      {download}
    </div>
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

/** Task chat: live messages + activity, composer with files and @mentions. */
export function TaskChat({ taskId, members, currentUserId, refreshKey, readOnly }: {
  taskId: string; members: TaskMember[]; currentUserId: string | null; refreshKey?: string;
  /** View only: the conversation is shown but nothing can be sent. */
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // True until the conversation has been read once, so "No messages yet" never flashes.
  const [loadingChat, setLoadingChat] = useState(true);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, TaskMember>>({});
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [live, setLive] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const lastTypingSent = useRef(0);

  // Newest message time we have, so updates fetch only what came after it.
  const lastAt = useRef<string | null>(null);
  useEffect(() => { lastAt.current = messages.length ? messages[messages.length - 1].created_at : null; }, [messages]);

  /** Adds messages, skipping ones already shown, keeping the order. */
  const merge = useCallback((fresh: ChatMessage[]) => {
    if (!fresh.length) return;
    setMessages((m) => {
      const have = new Set(m.map((x) => x.id));
      const add = fresh.filter((x) => !have.has(x.id));
      return add.length ? [...m, ...add].sort((a, b) => a.created_at.localeCompare(b.created_at)) : m;
    });
  }, []);

  const loadActivity = useCallback(async () => {
    const a = await fetch(`/api/tasks/${taskId}/activity`).then((r) => r.json()).catch(() => ({}));
    if (a.activity) { setActivity(a.activity); setProfiles(a.profiles ?? {}); }
  }, [taskId]);

  // Older messages load on request ("Load earlier messages").
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  async function loadEarlier() {
    const first = messages[0]?.created_at;
    if (!first) return;
    setLoadingEarlier(true);
    try {
      const c = await fetch(`/api/tasks/${taskId}/comments?limit=50&before=${encodeURIComponent(first)}`).then((r) => r.json());
      if (c.comments) { setMessages((m) => [...c.comments.filter((x: ChatMessage) => !m.some((y) => y.id === x.id)), ...m]); setHasEarlier(!!c.has_more); }
    } catch {} finally { setLoadingEarlier(false); }
  }

  // Opening a task: the latest 50 messages and its activity, once.
  useEffect(() => {
    let cancelled = false;
    setLoadingChat(true); setMessages([]); setActivity([]); setHasEarlier(false);
    Promise.all([
      fetch(`/api/tasks/${taskId}/comments?limit=50`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/tasks/${taskId}/activity`).then((r) => r.json()).catch(() => ({})),
    ]).then(([c, a]) => {
      if (cancelled) return;
      setMessages(c.comments ?? []);
      setHasEarlier(!!c.has_more);
      setActivity(a.activity ?? []);
      setProfiles(a.profiles ?? {});
      setLoadingChat(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  // The task changed (status, dates, files…): only its activity needs reading again.
  const firstKey = useRef(true);
  useEffect(() => {
    if (firstKey.current) { firstKey.current = false; return; }
    loadActivity();
  }, [refreshKey, loadActivity]);
  // While this chat is on screen, its messages need no popup.
  useEffect(() => {
    document.body.dataset.openTaskChat = taskId;
    return () => { if (document.body.dataset.openTaskChat === taskId) delete document.body.dataset.openTaskChat; };
  }, [taskId]);

  /** Only messages newer than the last one shown. */
  const loadMessages = useCallback(() => {
    const after = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
    fetch(`/api/tasks/${taskId}/comments${after}`).then((r) => r.json()).then((c) => { if (c.comments) merge(c.comments); }).catch(() => {});
  }, [taskId, merge]);

  // Real time: everyone with the task open shares a WebSocket channel. A sender pings it
  // after saving, and the others re-read the messages (the ping itself carries no content).
  useEffect(() => {
    const supabase = createClient();
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`task-chat:${taskId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "message" }, () => { setTyping(null); loadMessages(); })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        setTyping(typeof payload?.name === "string" ? payload.name : null);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setTyping(null), 3000);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => { clearTimeout(typingTimer); channelRef.current = null; setLive(false); supabase.removeChannel(channel); };
  }, [taskId, loadMessages]);

  // Safety net only while the live connection is down: a slow check for new messages.
  useEffect(() => {
    if (live) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") loadMessages(); }, 45000);
    return () => clearInterval(t);
  }, [live, loadMessages]);

  const items = useMemo<Item[]>(() => [
    ...messages.map((msg) => ({ kind: "message" as const, at: msg.created_at, msg })),
    ...activity.filter((e) => e.action !== "created" && (!hasEarlier || !messages.length || e.created_at >= messages[0].created_at))
      .map((entry) => ({ kind: "activity" as const, at: entry.created_at, entry })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [messages, activity, hasEarlier]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [items.length]);

  async function upload(list: FileList) {
    setUploading(true);
    for (const file of Array.from(list)) {
      try {
        const a = await uploadTaskFile(taskId, file, "chat");
        setFiles((f) => [...f, { id: a.id, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes, url: null }]);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    }
    setUploading(false);
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
    merge([json.comment]);
    channelRef.current?.send({ type: "broadcast", event: "message", payload: {} });
    setText("");
    setFiles([]);
  }

  function onChangeText(v: string) {
    setText(v);
    if (v && Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      const me = members.find((m) => m.id === currentUserId)?.full_name?.split(" ")[0];
      if (me) channelRef.current?.send({ type: "broadcast", event: "typing", payload: { name: me } });
    }
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
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><FontAwesomeIcon icon={faComments} className="h-3.5 w-3.5 text-muted-foreground" />Chat</p>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title={live ? "Messages arrive instantly" : "Reconnecting…"}>
          <FontAwesomeIcon icon={faCircle} className={cn("h-1.5 w-1.5", live ? "text-emerald-500" : "text-amber-500")} />{live ? "Live" : "Connecting"}
        </span>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-3">
        {loadingChat && (
          <div className="space-y-3 py-2" aria-label="Loading chat">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("flex gap-2", i === 1 && "flex-row-reverse")}>
                <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
                <span className={cn("h-10 animate-pulse rounded-xl bg-muted", i === 1 ? "w-40" : "w-52")} />
              </div>
            ))}
          </div>
        )}
        {!loadingChat && hasEarlier && (
          <button type="button" onClick={loadEarlier} disabled={loadingEarlier}
            className="mx-auto mb-2 block rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60">
            {loadingEarlier ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {!loadingChat && items.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">No messages yet. Start the conversation — type @ to mention someone.</p>}
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
                    {(it.msg.attachments ?? []).map((f) => <ChatAttachment key={f.id} f={f} mine={mine} />)}
                    {it.msg.body && <span className="whitespace-pre-wrap break-words">{renderBody(it.msg.body, members)}</span>}
                    <span className={cn("ml-2 align-bottom text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>{timeLabel(d)}</span>
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        {typing && <p className="px-2 text-[11px] italic text-muted-foreground">{typing} is typing…</p>}
        <div ref={bottomRef} />
      </div>

      {readOnly && <p className="border-t px-4 py-3 text-center text-xs text-muted-foreground">You can read this chat. Only the people working on this task can reply.</p>}
      {/* Composer */}
      {!readOnly && <div className="relative border-t p-3">
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
      </div>}
    </div>
  );
}
