"use client";

import { CodeFlow } from "@/components/auth/code-flow";

/** Forgot password: email, then a 6-digit code and a new password, all on this device. */
export default function ForgotPasswordPage() {
  return <CodeFlow mode="reset" />;
}
