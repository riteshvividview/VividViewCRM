import { redirect } from "next/navigation";

// The profile now lives in Profile settings, next to preferences, notifications and security.
export default function ProfilePage() {
  redirect("/dashboard/settings?tab=profile");
}
