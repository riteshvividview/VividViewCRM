"use client";
import { useCallback, useEffect, useState } from "react";
import type { CallLog, CallOutcome } from "../types";

const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

export const MOCK_CALLS: CallLog[] = [
  { id: "cl1", contact_id: "c1", contact_name: "Sarah Chen", phone_number: "+91 98765 43210", duration: 1842, direction: "outbound", outcome: "answered", notes: "Discussed Q2 proposal. She'll review and get back within 48hrs.", created_by: "Alex Kumar", created_at: ago(2) },
  { id: "cl2", contact_id: "c3", contact_name: "Elena Vasquez", phone_number: "+91 76543 21098", duration: 0, direction: "outbound", outcome: "no_answer", notes: "", created_by: "Alex Kumar", created_at: ago(4) },
  { id: "cl3", contact_id: "c2", contact_name: "Marcus Webb", phone_number: "+91 87654 32109", duration: 634, direction: "inbound", outcome: "answered", notes: "Marcus called to clarify partnership terms. Sending revised draft.", created_by: "Priya Singh", created_at: ago(6) },
  { id: "cl4", contact_id: "c4", contact_name: "James Okafor", phone_number: "+91 65432 10987", duration: 112, direction: "outbound", outcome: "voicemail", notes: "Left message about pricing follow-up.", created_by: "Sam Tiwari", created_at: ago(24) },
  { id: "cl5", contact_id: "c5", contact_name: "Lily Nguyen", phone_number: "+91 54321 09876", duration: 423, direction: "outbound", outcome: "answered", notes: "Confirmed they're going with a competitor for now. Scheduled Q3 follow-up.", created_by: "Sam Tiwari", created_at: ago(28) },
  { id: "cl6", contact_id: "c6", contact_name: "David Kim", phone_number: "+91 43210 98765", duration: 2180, direction: "inbound", outcome: "answered", notes: "Onboarding questions. Resolved all issues. Very satisfied.", created_by: "Priya Singh", created_at: ago(48) },
  { id: "cl7", contact_id: "c3", contact_name: "Elena Vasquez", phone_number: "+91 76543 21098", duration: 891, direction: "outbound", outcome: "answered", notes: "Demo follow-up. They need board approval.", created_by: "Alex Kumar", created_at: ago(50) },
];

export function useCalls() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 300));
      setCalls(MOCK_CALLS);
      setLoading(false);
    };
    load();
  }, []);

  const addCall = useCallback((partial: Partial<CallLog>): CallLog => {
    const n: CallLog = {
      id: crypto.randomUUID(),
      contact_id: partial.contact_id ?? null,
      contact_name: partial.contact_name ?? "Unknown",
      phone_number: partial.phone_number ?? "",
      duration: partial.duration ?? 0,
      direction: partial.direction ?? "outbound",
      outcome: partial.outcome ?? "answered",
      notes: partial.notes ?? "",
      created_by: "You",
      created_at: new Date().toISOString(),
    };
    setCalls((p) => [n, ...p]);
    return n;
  }, []);

  const updateCall = useCallback((id: string, updates: Partial<CallLog>) => {
    setCalls((p) => p.map((c) => c.id === id ? { ...c, ...updates } : c));
  }, []);

  return { calls, loading, addCall, updateCall };
}
