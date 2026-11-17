"use client";

import { CodeFlow } from "@/components/auth/code-flow";

/** First time here: email, then a 6-digit code and a password, all on this device. */
export default function ActivatePage() {
  return <CodeFlow mode="activate" />;
}
