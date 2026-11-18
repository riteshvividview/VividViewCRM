"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/types";
import type { ModuleId } from "@/lib/rbac/modules";

interface ProfileContextValue {
  profile: Profile | null;
  allowedModuleIds: ModuleId[];
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  allowedModuleIds: [],
});

export function ProfileProvider({
  profile,
  allowedModuleIds,
  children,
}: {
  profile: Profile | null;
  allowedModuleIds: ModuleId[];
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={{ profile, allowedModuleIds }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useShellProfile(): Profile | null {
  return useContext(ProfileContext).profile;
}

/** Whether a developer-console feature is on for the signed-in person. */
export function useFeature(key: string): boolean {
  return !!useContext(ProfileContext).profile?.features?.includes(key);
}

export function useIsDeveloper(): boolean {
  return !!useContext(ProfileContext).profile?.is_developer;
}

export function useAllowedModuleIds(): ModuleId[] {
  return useContext(ProfileContext).allowedModuleIds;
}
