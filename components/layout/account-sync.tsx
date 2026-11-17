"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cacheUserPrefs } from "@/lib/user-prefs";
import { cacheNotificationPrefs } from "@/modules/notifications/preferences";

/**
 * Loads the preferences saved on the signed-in account into this browser once
 * per page load, so a choice made on one device applies on every other one.
 */
export function AccountSync() {
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      if (meta.prefs && typeof meta.prefs === "object") cacheUserPrefs(meta.prefs);
      if (meta.notification_prefs && typeof meta.notification_prefs === "object") cacheNotificationPrefs(meta.notification_prefs);
    }).catch(() => {});
  }, []);
  return null;
}
