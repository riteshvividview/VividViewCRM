"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, Delete, PhoneOff, PhoneIncoming } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = [
  { digit: "1", sub: "" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*", sub: "" },
  { digit: "0", sub: "+" },
  { digit: "#", sub: "" },
];

type CallState = "idle" | "dialing" | "connected" | "ended";

interface DialPadProps {
  onCallEnd: (phoneNumber: string, duration: number) => void;
}

export function DialPad({ onCallEnd }: DialPadProps) {
  const [number, setNumber] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dialTimeoutRef.current) clearTimeout(dialTimeoutRef.current);
    };
  }, []);

  function pressKey(digit: string) {
    if (callState !== "idle") return;
    setNumber((n) => n + digit);
  }

  function backspace() {
    if (callState !== "idle") return;
    setNumber((n) => n.slice(0, -1));
  }

  function startCall() {
    if (!number.trim() || callState !== "idle") return;
    setCallState("dialing");
    setElapsed(0);
    dialTimeoutRef.current = setTimeout(() => {
      setCallState("connected");
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }, 2000);
  }

  function endCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dialTimeoutRef.current) clearTimeout(dialTimeoutRef.current);
    const dur = elapsed;
    setCallState("ended");
    onCallEnd(number, dur);
    setTimeout(() => {
      setCallState("idle");
      setElapsed(0);
    }, 500);
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden w-72">
      {/* Status banner */}
      {callState !== "idle" && (
        <div className={cn(
          "px-4 py-2.5 text-center text-sm font-medium",
          callState === "dialing" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
          callState === "connected" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
          "bg-muted text-muted-foreground"
        )}>
          {callState === "dialing" && "Dialing…"}
          {callState === "connected" && (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {formatElapsed(elapsed)}
            </span>
          )}
          {callState === "ended" && "Call ended"}
        </div>
      )}

      {/* Number display */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className={cn("flex-1 text-center text-2xl font-mono tracking-widest transition-all", !number && "text-muted-foreground/30")}>
            {number || "Enter number"}
          </div>
          {number && callState === "idle" && (
            <button onClick={backspace} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-2">
              <Delete className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dial grid */}
      <div className="grid grid-cols-3 gap-1 px-4 pb-3">
        {KEYS.map(({ digit, sub }) => (
          <button
            key={digit}
            onClick={() => pressKey(digit)}
            disabled={callState !== "idle"}
            className={cn(
              "flex flex-col items-center justify-center h-14 rounded-xl transition-all",
              callState === "idle"
                ? "bg-muted/60 hover:bg-purple-50 dark:hover:bg-purple-950/20 active:scale-95"
                : "bg-muted/30 opacity-50 cursor-not-allowed"
            )}
          >
            <span className="text-lg font-semibold text-foreground leading-none">{digit}</span>
            {sub && <span className="text-[9px] text-muted-foreground mt-0.5 tracking-widest">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Call / End button */}
      <div className="px-4 pb-5">
        {callState === "idle" || callState === "ended" ? (
          <Button
            onClick={startCall}
            disabled={!number.trim()}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 text-base"
          >
            <Phone className="h-5 w-5" />Call
          </Button>
        ) : callState === "dialing" ? (
          <Button
            onClick={endCall}
            className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl gap-2 text-base"
          >
            <PhoneOff className="h-5 w-5" />Cancel
          </Button>
        ) : (
          <Button
            onClick={endCall}
            className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl gap-2 text-base"
          >
            <PhoneOff className="h-5 w-5" />End Call
          </Button>
        )}

        {callState === "idle" && (
          <button
            className="w-full mt-2 h-9 rounded-xl border border-border bg-background text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <PhoneIncoming className="h-3.5 w-3.5" />Log inbound call
          </button>
        )}
      </div>
    </div>
  );
}
