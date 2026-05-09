"use client";
import { useCallback, useEffect, useState } from "react";
import type { InboxThread, InboxMessage, InboxTag } from "../types";

const MOCK_THREADS: InboxThread[] = [
  {
    id: "th1", contact_id: "c1", contact_name: "Sarah Chen", contact_email: "sarah@techflow.com",
    avatar_initials: "SC", subject: "Re: Enterprise License Proposal", unread: true, tag: "hot_lead",
    assigned_to: "Alex Kumar", last_message: "This looks great! Can we schedule a call to discuss pricing?",
    created_at: "2026-05-07T10:00:00Z", updated_at: "2026-05-07T14:30:00Z",
    messages: [
      { id: "m1", thread_id: "th1", from_name: "Alex Kumar", from_email: "alex@vividview.com", body: "Hi Sarah,\n\nPlease find attached our enterprise license proposal. Looking forward to your feedback.\n\nBest,\nAlex", direction: "outbound", created_at: "2026-05-07T10:00:00Z" },
      { id: "m2", thread_id: "th1", from_name: "Sarah Chen", from_email: "sarah@techflow.com", body: "This looks great! Can we schedule a call to discuss pricing? We're particularly interested in the multi-seat option.", direction: "inbound", created_at: "2026-05-07T14:30:00Z" },
    ],
  },
  {
    id: "th2", contact_id: "c3", contact_name: "Elena Vasquez", contact_email: "elena@cloudbase.co",
    avatar_initials: "EV", subject: "Re: Demo Follow-up", unread: true, tag: "needs_follow_up",
    assigned_to: "Alex Kumar", last_message: "Thank you for the demo! I'll need to discuss with our board.",
    created_at: "2026-05-06T09:00:00Z", updated_at: "2026-05-06T16:00:00Z",
    messages: [
      { id: "m3", thread_id: "th2", from_name: "Alex Kumar", from_email: "alex@vividview.com", body: "Hi Elena,\n\nThank you for attending the demo yesterday. I've attached the slide deck as requested.", direction: "outbound", created_at: "2026-05-06T09:00:00Z" },
      { id: "m4", thread_id: "th2", from_name: "Elena Vasquez", from_email: "elena@cloudbase.co", body: "Thank you for the demo! I'll need to discuss with our board before we can move forward. Will get back to you by end of week.", direction: "inbound", created_at: "2026-05-06T16:00:00Z" },
    ],
  },
  {
    id: "th3", contact_id: "c2", contact_name: "Marcus Webb", contact_email: "m.webb@nexus.io",
    avatar_initials: "MW", subject: "Re: Partnership Proposal", unread: false, tag: "replied",
    assigned_to: "Priya Singh", last_message: "Sounds good, I'll have our legal team review the terms.",
    created_at: "2026-05-05T11:00:00Z", updated_at: "2026-05-05T15:00:00Z",
    messages: [
      { id: "m5", thread_id: "th3", from_name: "Priya Singh", from_email: "priya@vividview.com", body: "Hi Marcus,\n\nExcited to explore partnership opportunities with Nexus Digital. Please review the attached terms.", direction: "outbound", created_at: "2026-05-05T11:00:00Z" },
      { id: "m6", thread_id: "th3", from_name: "Marcus Webb", from_email: "m.webb@nexus.io", body: "Sounds good, I'll have our legal team review the terms. Expect a response within 3-5 business days.", direction: "inbound", created_at: "2026-05-05T15:00:00Z" },
    ],
  },
  {
    id: "th4", contact_id: "c5", contact_name: "Lily Nguyen", contact_email: "lily@spark.com",
    avatar_initials: "LN", subject: "Re: Analytics Integration Quote", unread: false, tag: "not_interested",
    assigned_to: "Sam Tiwari", last_message: "We've decided to go with another provider for now. Thank you.",
    created_at: "2026-05-04T09:00:00Z", updated_at: "2026-05-04T17:00:00Z",
    messages: [
      { id: "m7", thread_id: "th4", from_name: "Sam Tiwari", from_email: "sam@vividview.com", body: "Hi Lily,\n\nHere is the quote for the analytics integration as discussed.", direction: "outbound", created_at: "2026-05-04T09:00:00Z" },
      { id: "m8", thread_id: "th4", from_name: "Lily Nguyen", from_email: "lily@spark.com", body: "We've decided to go with another provider for now. Thank you for your time — may revisit in Q3.", direction: "inbound", created_at: "2026-05-04T17:00:00Z" },
    ],
  },
  {
    id: "th5", contact_id: "c4", contact_name: "James Okafor", contact_email: "jokafor@meridian.com",
    avatar_initials: "JO", subject: "Re: Industrial Suite Pricing", unread: false, tag: null,
    assigned_to: "Sam Tiwari", last_message: "I'll need the breakdown for 500+ seat licenses.",
    created_at: "2026-05-03T10:00:00Z", updated_at: "2026-05-03T14:00:00Z",
    messages: [
      { id: "m9", thread_id: "th5", from_name: "Sam Tiwari", from_email: "sam@vividview.com", body: "Hi James,\n\nHere are the pricing tiers for the Industrial Suite.", direction: "outbound", created_at: "2026-05-03T10:00:00Z" },
      { id: "m10", thread_id: "th5", from_name: "James Okafor", from_email: "jokafor@meridian.com", body: "I'll need the breakdown for 500+ seat licenses. Also, what's the discount for annual commitment?", direction: "inbound", created_at: "2026-05-03T14:00:00Z" },
    ],
  },
];

export function useInbox() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 300));
      setThreads(MOCK_THREADS);
      setLoading(false);
    };
    load();
  }, []);

  const markRead = useCallback((id: string) => {
    setThreads((p) => p.map((t) => t.id === id ? { ...t, unread: false } : t));
  }, []);

  const setTag = useCallback((id: string, tag: InboxTag) => {
    setThreads((p) => p.map((t) => t.id === id ? { ...t, tag } : t));
  }, []);

  const assignThread = useCallback((id: string, assignee: string) => {
    setThreads((p) => p.map((t) => t.id === id ? { ...t, assigned_to: assignee } : t));
  }, []);

  const addReply = useCallback((threadId: string, body: string, from_name: string, from_email: string) => {
    const msg: InboxMessage = {
      id: crypto.randomUUID(), thread_id: threadId,
      from_name, from_email, body, direction: "outbound",
      created_at: new Date().toISOString(),
    };
    setThreads((p) => p.map((t) =>
      t.id === threadId
        ? { ...t, messages: [...t.messages, msg], last_message: body.slice(0, 80), updated_at: msg.created_at }
        : t
    ));
  }, []);

  const unreadCount = threads.filter((t) => t.unread).length;
  return { threads, loading, markRead, setTag, assignThread, addReply, unreadCount };
}
