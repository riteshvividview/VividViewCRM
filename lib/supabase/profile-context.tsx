"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/types";

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile | null;
  children: React.ReactNode;
}) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useShellProfile(): Profile | null {
  return useContext(ProfileContext);
}
