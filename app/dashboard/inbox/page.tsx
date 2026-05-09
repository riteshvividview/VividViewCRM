"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search, RefreshCw, Tag, UserCheck, Send, ChevronDown,
  Inbox, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInbox } from "@/modules/inbox/hooks/use-inbox";
import type { InboxThread, InboxTag } from "@/modules/inbox/types";
import { TAG_CONFIG } from "@/modules/inbox/types";
import { cn } from "@/lib/utils";

const ASSIGNEES = ["Alex Kumar", "Priya Singh", "Sam Tiwari"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-red-500", "bg-pink-500", "bg-indigo-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

// ── Thread Row ───────────────────────────────────────────────────────────────
function ThreadRow({ thread, selected, onClick }: { thread: InboxThread; selected: boolean; onClick: () => void }) {
  const tag = thread.tag ? TAG_CONFIG[thread.tag] : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border transition-colors",
        selected ? "bg-purple-50 dark:bg-purple-950/20" : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5", avatarColor(thread.contact_name))}>
          {getInitials(thread.contact_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm truncate", thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
              {thread.contact_name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(thread.updated_at)}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{thread.subject}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{thread.last_message}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {thread.unread && <Circle className="h-2 w-2 fill-purple-500 text-purple-500 shrink-0" />}
            {tag && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", tag.bg, tag.color)}>
                {tag.label}
              </span>
            )}
            {thread.assigned_to && (
              <span className="text-[10px] text-muted-foreground/60 truncate">{thread.assigned_to}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Thread View ───────────────────────────────────────────────────────────────
function ThreadView({ thread, onMarkRead, onSetTag, onAssign, onReply }: {
  thread: InboxThread;
  onMarkRead: () => void;
  onSetTag: (t: InboxTag) => void;
  onAssign: (a: string) => void;
  onReply: (body: string) => void;
}) {
  const [replyBody, setReplyBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.messages.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onMarkRead(); }, [thread.id]);

  function sendReply() {
    if (!replyBody.trim()) return;
    onReply(replyBody.trim());
    setReplyBody("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-foreground">{thread.subject}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {thread.contact_name} &lt;{thread.contact_email}&gt;
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Tag className="h-3 w-3" />
                {thread.tag ? TAG_CONFIG[thread.tag].label : "Tag"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onSetTag(null)}>Remove tag</DropdownMenuItem>
              {(Object.keys(TAG_CONFIG) as Array<Exclude<InboxTag, null>>).map((k) => (
                <DropdownMenuItem key={k} onClick={() => onSetTag(k)}>
                  <span className={cn("mr-2 text-xs px-1.5 py-0.5 rounded-full", TAG_CONFIG[k].bg, TAG_CONFIG[k].color)}>
                    {TAG_CONFIG[k].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <UserCheck className="h-3 w-3" />
                {thread.assigned_to ?? "Assign"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {ASSIGNEES.map((a) => (
                <DropdownMenuItem key={a} onClick={() => onAssign(a)}>{a}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {thread.messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.direction === "outbound" && "flex-row-reverse")}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1", msg.direction === "outbound" ? "bg-purple-500" : avatarColor(msg.from_name))}>
              {getInitials(msg.from_name)}
            </div>
            <div className={cn("max-w-[72%]", msg.direction === "outbound" && "items-end flex flex-col")}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">{msg.from_name}</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(msg.created_at)}</span>
              </div>
              <div className={cn(
                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.direction === "outbound"
                  ? "bg-purple-600 text-white rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}>
                {msg.body}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
        <Textarea
          className="resize-none text-sm min-h-[80px]"
          placeholder="Write a reply…"
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendReply(); }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Ctrl+Enter to send</p>
          <Button
            onClick={sendReply}
            disabled={!replyBody.trim()}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-8"
          >
            <Send className="h-3.5 w-3.5" />Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { threads, loading, markRead, setTag, assignThread, addReply } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "hot_lead" | "needs_follow_up">("all");

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;
  const unreadCount = threads.filter((t) => t.unread).length;

  const filtered = threads.filter((t) => {
    const matchSearch = !search || t.contact_name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "unread" ? t.unread :
      t.tag === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: Thread list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-background">
        <div className="px-4 py-3 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-purple-600 text-white rounded-full px-1.5 py-0.5 font-medium">{unreadCount}</span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search threads…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "hot_lead", label: "Hot" },
              { key: "needs_follow_up", label: "Follow-up" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as typeof filter)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  filter === key ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No threads found</p>
            </div>
          ) : (
            filtered.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                selected={selectedId === t.id}
                onClick={() => setSelectedId(t.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Thread view */}
      <div className="flex-1 overflow-hidden bg-background">
        {selectedThread ? (
          <ThreadView
            thread={selectedThread}
            onMarkRead={() => markRead(selectedThread.id)}
            onSetTag={(tag) => setTag(selectedThread.id, tag)}
            onAssign={(a) => assignThread(selectedThread.id, a)}
            onReply={(body) => addReply(selectedThread.id, body, "You", "you@vividview.com")}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a thread to read</p>
            <p className="text-xs text-muted-foreground max-w-xs">Choose a conversation from the left panel to view messages and reply</p>
          </div>
        )}
      </div>
    </div>
  );
}
