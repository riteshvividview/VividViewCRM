"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import { useShellProfile } from "@/lib/supabase/profile-context";
import { StorageBrowser } from "@/modules/tasks/components/storage-browser";

/** Cloudflare storage browser. The CEO only (the API checks this as well). */
export default function StoragePage() {
  const profile = useShellProfile();
  if (profile && profile.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <FontAwesomeIcon icon={faLock} className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-medium">Only the CEO can open storage</p>
      </div>
    );
  }
  return <StorageBrowser />;
}
