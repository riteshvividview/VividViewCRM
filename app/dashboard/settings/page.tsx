"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NotificationSettings } from "@/modules/notifications/components/notification-settings";
import { ProfileTab } from "./_components/profile-tab";
import { PreferencesTab } from "./_components/preferences-tab";
import { SecurityTab } from "./_components/security-tab";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "My profile" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

function ProfileSettings() {
  const search = useSearchParams();
  const initial = search.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "profile");

  // Keep the open tab in the address, so a link or a refresh lands on the same one.
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${tab}`);
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Profile settings</h1>
      <div className="mt-5 flex gap-6 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn("-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-7">
        {tab === "profile" && <ProfileTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "notifications" && <div className="max-w-3xl"><NotificationSettings /></div>}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSettings />
    </Suspense>
  );
}
